/**
 * `.drawio` 明文 XML → YAML DSL 反解（回程）。
 *
 * 为什么需要回程：`yaml_to_drawio` 只解决「用户改 YAML → 看效果」这一个方向。用户完全可能
 * **直接改 `.drawio`**（拖个位置、加个框、改个标题），这时需要把语义捡回来交给模型继续改。
 *
 * 三条硬约束决定了下面的实现形状：
 *
 * ① **本模块必须零依赖、零 `node:*` 内置模块。** 包根 `index.ts` 会被插件客户端产物内联
 *    （`plugin/src/client.tsx` → `@dsh-diagram/drawio`）。esbuild 会把这个模块整块 tree-shake 掉
 *    （实测客户端产物里 0 B），但只要有**一个** `node:*` 导入，浏览器半的打包就会在解析阶段直接失败。
 *    因此 draw.io 默认的**压缩 diagram** 只做识别，解压由宿主侧注入 `InflateRaw` 完成 ——
 *    这样压缩路径也能在 `scripts/roundtrip-check.ts` 里用 node:zlib 注入同一个函数验证。
 * ② **几何一律丢弃**：DSL 里没有坐标，重新渲染时由引擎重排。丢掉多少要如实报进 `warnings`。
 * ③ **反解不可能无损**：自由图形、自定义样式、`layout` 三项都会进 `warnings`，绝不静默吞掉
 *    （这是当初冻结 `drawio_to_yaml` 时就点明的风险点）。
 *
 * 反解口径（与 `mxgraph-model.ts` / `style-map.ts` / `html-value.ts` 的写出侧逐条对应）：
 *   - `vertex="1"` 且 style 含 `container=1` → group；`parent` 由 cell 的 parent 链还原；
 *     `variant` 由 `dashed` 反推、缺失时用 `fillColor` 兜底。
 *   - 普通 `vertex="1"` → node；`variant` 用 `NODE_THEME` 的 `fillColor+strokeColor` 反查
 *     （`default` 与 `muted` 共用填充/描边，必须再拿 `fontColor` 区分）；
 *     `title/desc/items` 从 HTML value 反解；`group` 由 parent 还原。
 *   - `edge="1"` → edge；`from/to` 取 `source`/`target`；`style` 由 `dashed`/`startArrow`/`endArrow`
 *     反推；`label` 取 value。
 */
import type {
  ArchSpec,
  EdgeSpec,
  EdgeStyle,
  GroupSpec,
  GroupVariant,
  NodeSpec,
  NodeVariant,
} from '@dsh-diagram/schema';
import { GROUP_THEME, NODE_THEME } from './style-map';

/**
 * 宿主注入的原生解压：base64 → 明文内容。
 * 纯函数模块不能自己 import `node:zlib`（见文件头 ①），所以由调用方注入。
 */
export type InflateRaw = (base64: string) => string;

/** 反解结果：`spec` 供宿主/脚本做结构化断言，`yamlSpec` 是交给模型的文本。 */
export interface ParsedDrawio {
  spec: ArchSpec;
  yamlSpec: string;
  warnings: string[];
}

/** diagram 内容是 draw.io 默认压缩格式，而调用方没有注入解压器时抛出（附原始 payload 供宿主解压）。 */
export class CompressedDiagramError extends Error {
  /** `<diagram>` 的原始（base64）内容，宿主可直接拿去 decompress。 */
  readonly payload: string;

  constructor(payload: string) {
    super(
      '该 .drawio 的 <diagram> 是 draw.io 的压缩格式（decodeURIComponent + deflateRaw + base64），'
      + '无法按明文解析。请用 draw.io 另存为「未压缩 XML」，或让宿主注入解压器后重试。',
    );
    this.name = 'CompressedDiagramError';
    this.payload = payload;
  }
}

interface RawCell {
  id: string;
  value: string;
  style: string;
  parent: string;
  source?: string;
  target?: string;
  vertex: boolean;
  edge: boolean;
}

interface ClassifiedCell {
  cell: RawCell;
  style: Map<string, string>;
  kind: 'group' | 'node' | 'edge' | 'unknown';
}

/**
 * 解析明文 `.drawio`（或裸 `mxGraphModel`）为 YAML DSL。
 * @param xml - 文件全文。
 * @param decodeCompressed - 可选的压缩 diagram 解压器；不给则遇到压缩页抛 `CompressedDiagramError`。
 * @returns 结构化 spec、YAML 文本与「无法还原」清单。
 */
export function parseDrawio(xml: string, decodeCompressed?: InflateRaw): ParsedDrawio {
  const warnings: string[] = [];
  const diagram = readElement(xml, 'diagram');
  let modelSource = xml;
  let diagramName = '';

  if (diagram !== undefined) {
    const pages = (xml.match(/<diagram(?=[\s/>])/gi) ?? []).length;
    if (pages > 1) {
      warnings.push(`文件里有 ${pages} 个 <diagram> 页，只反解了第一页。`);
    }
    if (diagram.attributes.has('name')) {
      diagramName = diagram.attributes.get('name') ?? '';
    }

    const inner = diagram.inner.trim();
    // 明文页以 <mxGraphModel 开头；否则只可能是 draw.io 的压缩串。
    if (inner !== '' && !/^<mxGraphModel(?=[\s/>])/i.test(inner)) {
      if (decodeCompressed === undefined) throw new CompressedDiagramError(inner);
      const nested = parseDrawio(decodeCompressed(inner), decodeCompressed);
      // 图名写在**外层** <diagram name="…"> 上，解压出来的内容里没有它 —— 补回去，否则 meta.title 丢失。
      const spec: ArchSpec = diagramName === '' || nested.spec.meta?.title !== undefined
        ? nested.spec
        : { ...nested.spec, meta: { ...nested.spec.meta, title: diagramName } };
      return {
        spec,
        yamlSpec: emitYaml(spec),
        warnings: [
          ...warnings,
          '该 .drawio 的 <diagram> 是 draw.io 的压缩格式，已自动解压后解析。',
          ...nested.warnings,
        ],
      };
    }
    if (inner !== '') modelSource = inner;
  }

  const model = readElement(modelSource, 'mxGraphModel');
  if (model === undefined) {
    throw new Error(
      '不是可识别的 draw.io 文件：找不到 <mxGraphModel> 元素。'
      + '请确认这是未压缩的明文导出版本（draw.io 默认「压缩」保存的 diagram 需要解压器）。',
    );
  }

  const classified: ClassifiedCell[] = readCells(model.inner).map((cell) => {
    const style = readStyle(cell.style);
    return { cell, style, kind: classify(cell, style) };
  });
  const groupIds = new Set(
    classified.filter((entry) => entry.kind === 'group').map((entry) => entry.cell.id),
  );

  const groups: GroupSpec[] = [];
  const nodes: NodeSpec[] = [];
  const edges: EdgeSpec[] = [];
  let droppedGeometry = 0;

  for (const entry of classified) {
    const { cell, style, kind } = entry;
    // draw.io 的两个根图层（id 0 / 1）不是业务 cell，静默跳过，不进 warning。
    if (cell.id === '' || cell.id === '0' || cell.id === '1') continue;
    if (kind === 'unknown') {
      // 走到这里的是「既没有 vertex 也没有 edge」的 cell（draw.io 的图层/元数据 cell）。
      // 自由拖进来的文本框是 vertex，会走下面的 node 分支并按「外来顶点」告警。
      warnings.push(`cell '${cell.id}' 既没有 vertex 也没有 edge（不是可渲染的图形），已忽略。`);
      continue;
    }
    // 只要进 DSL 就一定要丢坐标：三种 cell 都带 <mxGeometry>。
    droppedGeometry += 1;

    if (kind === 'group') {
      const resolved = groupVariantOf(style);
      if (resolved.warning !== undefined) warnings.push(`分组 '${cell.id}'：${resolved.warning}`);
      const parent = cell.parent === '' || cell.parent === '0' || cell.parent === '1'
        ? undefined
        : cell.parent;
      if (parent !== undefined && !groupIds.has(parent)) {
        warnings.push(`分组 '${cell.id}' 的 parent '${parent}' 不在本文件中，已按顶层分组处理。`);
      }
      const title = decodeEntities(cell.value).trim();
      if (title === '') {
        warnings.push(`分组 '${cell.id}' 的标题为空，title 已回落为 id。`);
      }
      groups.push({
        id: cell.id,
        title: title === '' ? cell.id : title,
        ...(resolved.variant === 'dashed' ? {} : { variant: resolved.variant }),
        ...(parent !== undefined && groupIds.has(parent) ? { parent } : {}),
      });
      continue;
    }

    if (kind === 'node') {
      // 「外来顶点」：draw.io 里画什么都算 vertex，所以自由拖进来的文本框 / 形状必须单独识别，
      // 否则它会伪装成一张卡片。判据是「两边都不像」——样式没有本工具的 fillColor/strokeColor，
      // 值里也没有本工具的 <b> 卡片结构。
      // 处置口径：**收下**（用户手加的东西也是他改的内容，丢掉更糟），但只报一条合并告警，
      // 不再叠加「配色回落」「HTML 结构回落」两条推导出来的噪声。
      const foreign = !style.has('fillColor') && !style.has('strokeColor') && !/<b>/i.test(cell.value);
      let variant: NodeVariant = 'default';
      if (foreign) {
        warnings.push(
          `顶点 '${cell.id}' 看起来不是本工具导出的卡片（style 里没有 fillColor / strokeColor，`
          + 'value 里也没有 <b> 标题）：已按普通节点收下（title 取纯文本、variant=default），请人工确认是否保留。',
        );
      } else {
        const resolved = nodeVariantOf(style);
        variant = resolved.variant;
        if (resolved.warning !== undefined) warnings.push(`节点 '${cell.id}'：${resolved.warning}`);
      }
      const label = parseNodeValue(cell.value);
      if (!foreign) {
        for (const warning of label.warnings) warnings.push(`节点 '${cell.id}'：${warning}`);
      }
      const group = cell.parent === '' || cell.parent === '0' || cell.parent === '1'
        ? undefined
        : cell.parent;
      if (group !== undefined && !groupIds.has(group)) {
        warnings.push(`节点 '${cell.id}' 的 parent '${group}' 不是分组，已置于根画布。`);
      }
      if (label.title === '') {
        warnings.push(`节点 '${cell.id}' 的卡片文本为空，title 已回落为 id。`);
      }
      nodes.push({
        id: cell.id,
        title: label.title === '' ? cell.id : label.title,
        ...(group !== undefined && groupIds.has(group) ? { group } : {}),
        ...(label.desc === undefined || label.desc === '' ? {} : { desc: label.desc }),
        ...(variant === 'default' ? {} : { variant }),
        ...(label.items.length === 0 ? {} : { items: label.items }),
      });
      continue;
    }

    // edge
    const resolved = edgeStyleOf(style);
    if (resolved.warning !== undefined) warnings.push(`连线 '${cell.id}'：${resolved.warning}`);
    if (cell.source === undefined || cell.target === undefined) {
      warnings.push(
        `连线 '${cell.id}' 缺少 source / target（可能是手工画的浮动连线），已忽略。`,
      );
      droppedGeometry -= 1;
      continue;
    }
    edges.push({
      from: cell.source,
      to: cell.target,
      ...(cell.value === '' ? {} : { label: cell.value }),
      ...(resolved.style === 'solid' ? {} : { style: resolved.style }),
    });
  }

  if (droppedGeometry > 0) {
    warnings.push(
      `已丢弃 ${droppedGeometry} 个 cell 的几何坐标（x / y / width / height）：`
      + 'DSL 不含坐标，重新渲染时由布局引擎重排。',
    );
  }
  warnings.push(
    'layout 三项（direction / inner_direction / max_columns）不写在 .drawio 里，未还原；'
    + '需要时请手工补写。',
  );
  if (nodes.length === 0) {
    throw new Error('反解失败：该文件里没有任何节点 cell，无法产出可渲染的 YAML。');
  }
  if (edges.length === 0) {
    warnings.push('该图没有任何连线；DSL 要求 edges 至少 1 条，补上连线后才能重新渲染。');
  }

  const groupsOut = groups.length === 0 ? undefined : groups;
  const spec: ArchSpec = {
    version: '1.0',
    // diagram name 就是写出侧 `spec.meta.title ?? title`，无法区分子项与文件名回落，
    // 一律还原成 meta.title（幂等：再走一遍写出得到同一个图名）。
    ...(diagramName === '' ? {} : { meta: { title: diagramName } }),
    ...(groupsOut === undefined ? {} : { groups: groupsOut }),
    nodes,
    edges,
  };

  return { spec, yamlSpec: emitYaml(spec), warnings };
}

/** 分类：连线优先（edge 也可能带 container），其次容器，再次普通顶点。 */
function classify(cell: RawCell, style: Map<string, string>): ClassifiedCell['kind'] {
  if (cell.edge) return 'edge';
  if (!cell.vertex) return 'unknown';
  return style.get('container') === '1' ? 'group' : 'node';
}

function groupVariantOf(style: Map<string, string>): { variant: GroupVariant; warning?: string } {
  const dashed = style.get('dashed');
  if (dashed === '0') return { variant: 'filled' };
  if (dashed === '1') return { variant: 'dashed' };
  const fill = style.get('fillColor');
  if (fill !== undefined) {
    // 写出侧：filled → fillColor=#111c33，dashed → fillColor=none。
    return { variant: fill === GROUP_THEME.filled.fillColor ? 'filled' : 'dashed' };
  }
  return {
    variant: 'dashed',
    warning: 'style 里既没有 dashed 也没有 fillColor，variant 已回落为默认的 dashed。',
  };
}

/**
 * 节点 variant 反查（不建模块级反查表：本模块会被客户端产物内联，顶层副作用代码删不掉）。
 *
 * 两级匹配：先 `fillColor+strokeColor+fontColor` 精确命中 —— `default` 与 `muted` 共用填充与描边，
 * 只能靠 `fontColor` 区分；再退一步只按 `fillColor+strokeColor`（命中多个时取 NODE_VARIANTS 里靠前的）。
 */
function nodeVariantOf(style: Map<string, string>): { variant: NodeVariant; warning?: string } {
  const fill = style.get('fillColor');
  const stroke = style.get('strokeColor');
  const font = style.get('fontColor');
  let partial: NodeVariant | undefined;
  for (const variant of ['default', 'primary', 'danger', 'warning', 'muted'] as const) {
    const theme = NODE_THEME[variant];
    if (theme.fillColor !== fill || theme.strokeColor !== stroke) continue;
    if (theme.fontColor === font) return { variant };
    partial ??= variant;
  }
  if (partial !== undefined) return { variant: partial };
  return {
    variant: 'default',
    warning: `配色不在引擎调色板里（fillColor=${fill ?? '未设置'}），variant 已回落为 default。`,
  };
}

function edgeStyleOf(style: Map<string, string>): { style: EdgeStyle; warning?: string } {
  const startArrow = style.get('startArrow');
  const endArrow = style.get('endArrow');
  const hasStart = startArrow !== undefined && startArrow !== 'none' && startArrow !== '0';
  const hasEnd = endArrow !== undefined && endArrow !== 'none' && endArrow !== '0';
  const dashed = style.get('dashed') === '1';

  if (hasStart) {
    return hasEnd
      ? { style: 'bidirectional' }
      : {
        style: 'bidirectional',
        warning: '只有起点箭头（endArrow 被抹掉），DSL 无法表达单向入箭头，已按 bidirectional 处理。',
      };
  }
  if (!hasEnd) {
    return {
      style: dashed ? 'dashed' : 'solid',
      warning: '两个方向都没有箭头，DSL 无此形态，已按有无 dashed 处理。',
    };
  }
  return { style: dashed ? 'dashed' : 'solid' };
}

/** 反解卡片 HTML value（与 `html-value.ts` 的写出侧对称）。 */
function parseNodeValue(html: string): {
  title: string;
  desc?: string;
  items: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const source = html.trim();
  const titleMatch = /<b>([\s\S]*?)<\/b>/i.exec(source);
  if (titleMatch === null) {
    warnings.push(
      '卡片 value 里没有 <b> 标题（不是本工具导出的格式，或标题被手工删了），已把整段文本当作 title。',
    );
    return { title: decodeEntities(stripTags(source)).trim(), items: [], warnings };
  }

  const title = decodeEntities(titleMatch[1] ?? '').trim();
  const rest = source.slice(titleMatch.index + titleMatch[0].length);
  const hrIndex = rest.search(/<hr\b/i);
  const head = hrIndex < 0 ? rest : rest.slice(0, hrIndex);
  const tail = hrIndex < 0 ? '' : rest.slice(hrIndex);
  const headFonts = [...head.matchAll(/<font([^>]*)>([\s\S]*?)<\/font>/gi)];

  let desc: string | undefined;
  const items: string[] = [];

  if (hrIndex >= 0) {
    const chosen = headFonts.find((match) => /text-align\s*:\s*center/i.test(match[1] ?? ''))
      ?? headFonts[0];
    if (chosen === undefined) {
      const plain = decodeEntities(stripTags(head)).replace(/\s+/g, ' ').trim();
      if (plain !== '') desc = plain;
    } else {
      desc = decodeEntities(chosen[2] ?? '').trim();
    }
    const divMatch = /<div[^>]*>([\s\S]*?)<\/div>/i.exec(tail);
    for (const chunk of (divMatch === null ? tail : divMatch[1] ?? '').split(/<br\s*\/?>/i)) {
      const text = decodeEntities(stripTags(chunk)).trim();
      if (text !== '') items.push(text);
    }
    return { ...(desc === undefined || desc === '' ? {} : { desc }), title, items, warnings };
  }

  // 没有 <hr/> 分隔线：两种情况——① 写出侧的「有 desc 无 items」卡片本来就只有一个 <font>；
  // ② value 被手改成多段 <font> 但没有分隔线。只有 ② 才需要告警。
  if (headFonts.length === 0) {
    const plain = decodeEntities(stripTags(head)).replace(/\s+/g, ' ').trim();
    if (plain !== '') desc = plain;
    return { ...(desc === undefined ? {} : { desc }), title, items, warnings };
  }
  if (headFonts.length > 1) {
    warnings.push('卡片 value 里有多段 <font> 但没有 <hr/> 分隔线，已按段顺序拆成 desc + items。');
  }
  desc = decodeEntities(headFonts[0]?.[2] ?? '').trim();
  for (const match of headFonts.slice(1)) {
    const text = decodeEntities(match[2] ?? '').trim();
    if (text !== '') items.push(text);
  }
  return { ...(desc === '' ? {} : { desc }), title, items, warnings };
}

/** 找第一个 `<name …>` 元素；引号感知，属性值里的 `>` 不会提前结束标签。 */
function readElement(
  source: string,
  name: string,
): { attributes: Map<string, string>; inner: string } | undefined {
  const open = new RegExp(`<${name}(?=[\\s/>])`, 'i').exec(source);
  if (open === null) return undefined;

  const start = open.index + open[0].length;
  let cursor = start;
  let quote: string | undefined;
  let closed = false;
  while (cursor < source.length) {
    const char = source.charAt(cursor);
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      closed = true;
      break;
    }
    cursor += 1;
  }
  if (!closed) return undefined;

  const selfClosing = source.charAt(cursor - 1) === '/';
  const attributes = readAttributes(source.slice(start, selfClosing ? cursor - 1 : cursor));
  if (selfClosing) return { attributes, inner: '' };

  // 大小写不敏感地找闭合标签（draw.io 都是小写，但手工 XML 不一定）。
  const close = source.toLowerCase().indexOf(`</${name.toLowerCase()}>`, cursor + 1);
  return { attributes, inner: close < 0 ? '' : source.slice(cursor + 1, close) };
}

/** 读数所有 `<mxCell …>` 的属性（不需要解析闭合标签：cell 不嵌套）。 */
function readCells(model: string): RawCell[] {
  const cells: RawCell[] = [];
  const tag = /<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(model)) !== null) {
    if (match[1] === '/' || match[2] !== 'mxCell') continue;
    const attrs = readAttributes(match[3] ?? '');
    const source = attrs.get('source');
    const target = attrs.get('target');
    cells.push({
      id: attrs.get('id') ?? '',
      value: attrs.get('value') ?? '',
      style: attrs.get('style') ?? '',
      parent: attrs.get('parent') ?? '',
      ...(source === undefined ? {} : { source }),
      ...(target === undefined ? {} : { target }),
      vertex: attrs.get('vertex') === '1',
      edge: attrs.get('edge') === '1',
    });
  }
  return cells;
}

function readAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const key = match[1] ?? '';
    if (key === '') continue;
    attributes.set(key, decodeEntities(match[2] ?? match[3] ?? ''));
  }
  return attributes;
}

function readStyle(style: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const part of style.split(';')) {
    const at = part.indexOf('=');
    if (at <= 0) continue;
    entries.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  return entries;
}

/**
 * XML / HTML 实体解码。写入侧是「先 escapeHtml 再 escapeXmlAttribute」的两层转义，
 * 所以读回时按层各解一次即可 —— 本函数两层通用。`&amp;` 必须最后解，否则 `&amp;lt;`
 * 会被错解成 `<`。
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_whole, code: string) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_whole, code: string) => safeCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

/** 越界码点直接放弃解码，避免 `String.fromCodePoint` 抛异常把整次反解毁掉。 */
function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  return String.fromCodePoint(code);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * 手写 YAML 发射器。
 *
 * 为什么不引 js-yaml：`packages/drawio` 的依赖只有 layout / schema，且包根会被浏览器半内联；
 * 为了 30 行输出引一个解析库不划算，也把 browser 产物拖大。
 * 标量一律用**双引号**（`JSON.stringify` 的输出正好是合法的 YAML 双引号标量），
 * 这样 `: # - ? [ ] { } , & * ! | > ' " % @ \`` 这些 YAML 元字符全都不需要特判。
 */
function emitYaml(spec: ArchSpec): string {
  const lines: string[] = [`version: ${quote(spec.version ?? '1.0')}`];
  const title = spec.meta?.title;
  if (title !== undefined && title !== '') {
    lines.push('meta:', `  title: ${quote(title)}`);
  }

  const groups = spec.groups ?? [];
  if (groups.length === 0) {
    lines.push('groups: []');
  } else {
    lines.push('groups:');
    for (const group of groups) {
      lines.push(`  - id: ${quote(group.id)}`, `    title: ${quote(group.title)}`);
      if (group.variant !== undefined) lines.push(`    variant: ${group.variant}`);
      if (group.parent !== undefined) lines.push(`    parent: ${quote(group.parent)}`);
    }
  }

  lines.push('nodes:');
  for (const node of spec.nodes) {
    lines.push(`  - id: ${quote(node.id)}`, `    title: ${quote(node.title)}`);
    if (node.group !== undefined) lines.push(`    group: ${quote(node.group)}`);
    if (node.desc !== undefined && node.desc !== '') lines.push(`    desc: ${quote(node.desc)}`);
    if (node.variant !== undefined) lines.push(`    variant: ${node.variant}`);
    const items = node.items ?? [];
    if (items.length > 0) {
      lines.push('    items:');
      for (const item of items) lines.push(`      - ${quote(item)}`);
    }
  }

  if (spec.edges.length === 0) {
    lines.push('edges: []');
  } else {
    lines.push('edges:');
    for (const edge of spec.edges) {
      lines.push(`  - from: ${quote(edge.from)}`, `    to: ${quote(edge.to)}`);
      if (edge.label !== undefined && edge.label !== '') lines.push(`    label: ${quote(edge.label)}`);
      if (edge.style !== undefined) lines.push(`    style: ${edge.style}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function quote(value: string): string {
  return JSON.stringify(value);
}
