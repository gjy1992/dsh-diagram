/**
 * 往返一致性检查（PLAN §P2.7 验收 1）。
 *
 * 链路：YAML → validateArchSpec → layoutSpec → buildDrawio → parseDrawio → YAML
 *
 * 断言三件事：
 *   ① 语义不变：groups / nodes / edges 的 id 集合与语义字段
 *      （title / desc / items / variant / group / parent / from / to / label / style）逐条一致；
 *   ② 反解出的 YAML **自身可再校验**（能直接喂回 `yaml_to_drawio`），且二次往返是幂等的；
 *   ③ 反解不产生「意料之外」的降级：引擎自己导出的文件只应出现「几何丢弃 + layout 缺失」
 *      两条 warning，一旦出现配色回落 / HTML 结构回落等告警就说明写出侧与反解侧口径漂了。
 *
 * 另外覆盖 draw.io 的压缩页分支（`<diagram>` 里是 encodeURIComponent + deflateRaw + base64）：
 * 解压器由本脚本用 node:zlib 注入，与宿主侧 `plugin/src/tools/files.ts` 注入的是同一种函数。
 *
 * 用法：pnpm exec tsx scripts/roundtrip-check.ts [spec.yaml ...]
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { validateArchSpec, type NormalizedSpec } from '@dsh-diagram/schema';
import { layoutSpec } from '@dsh-diagram/layout';
import { buildDrawio, CompressedDiagramError, parseDrawio, type InflateRaw } from '@dsh-diagram/drawio';

const DEFAULT_SPECS = ['examples/03-rpc-items.yaml', 'examples/04-nested-groups.yaml'];

/** 引擎自己导出的文件，反解时允许出现的 warning 前缀（其余一律视为口径漂移）。 */
const EXPECTED_WARNING_PREFIXES = ['已丢弃', 'layout 三项'];

interface Failure {
  scope: string;
  detail: string;
}

/** node:zlib 版的解压器：base64 → inflateRaw → decodeURIComponent，即 draw.io 的解压算法。 */
const inflate: InflateRaw = (base64) =>
  decodeURIComponent(inflateRawSync(Buffer.from(base64, 'base64')).toString('utf8'));

/** 压缩器（只用于造测试夹具）：与 draw.io 保存压缩页时一致。 */
function deflate(xml: string): string {
  return Buffer.from(deflateRawSync(Buffer.from(encodeURIComponent(xml), 'utf8'))).toString('base64');
}

function groupFingerprint(spec: NormalizedSpec): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of spec.groups) {
    map.set(group.id, JSON.stringify({
      title: group.title,
      variant: group.variant,
      parent: group.parent ?? null,
    }));
  }
  return map;
}

function nodeFingerprint(spec: NormalizedSpec): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of spec.nodes) {
    map.set(node.id, JSON.stringify({
      title: node.title,
      desc: node.desc ?? null,
      variant: node.variant,
      group: node.group ?? null,
      items: node.items,
    }));
  }
  return map;
}

/** 边没有 id，用「排序后的指纹多重集」比对。 */
function edgeFingerprint(spec: NormalizedSpec): string[] {
  return spec.edges
    .map((edge) => JSON.stringify({
      from: edge.from,
      to: edge.to,
      label: edge.label ?? null,
      style: edge.style,
    }))
    .sort();
}

function compareMaps(scope: string, before: Map<string, string>, after: Map<string, string>, failures: Failure[]): void {
  const beforeIds = [...before.keys()].sort();
  const afterIds = [...after.keys()].sort();
  if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
    failures.push({ scope, detail: `id 集合不一致：${JSON.stringify(beforeIds)} → ${JSON.stringify(afterIds)}` });
  }
  for (const id of beforeIds) {
    const left = before.get(id);
    const right = after.get(id);
    if (left !== right && right !== undefined) {
      failures.push({ scope, detail: `${id} 字段不一致：${left} → ${right}` });
    }
  }
}

function compare(a: NormalizedSpec, b: NormalizedSpec, titleGuard: boolean, failures: Failure[]): void {
  compareMaps('groups', groupFingerprint(a), groupFingerprint(b), failures);
  compareMaps('nodes', nodeFingerprint(a), nodeFingerprint(b), failures);

  const leftEdges = edgeFingerprint(a);
  const rightEdges = edgeFingerprint(b);
  if (JSON.stringify(leftEdges) !== JSON.stringify(rightEdges)) {
    const missing = leftEdges.filter((edge) => !rightEdges.includes(edge));
    const extra = rightEdges.filter((edge) => !leftEdges.includes(edge));
    failures.push({
      scope: 'edges',
      detail: `边集合不一致：丢失 ${JSON.stringify(missing)}，多出 ${JSON.stringify(extra)}`,
    });
  }

  if (titleGuard && (a.meta.title ?? null) !== (b.meta.title ?? null)) {
    failures.push({ scope: 'meta', detail: `meta.title 不一致：${a.meta.title ?? 'undefined'} → ${b.meta.title ?? 'undefined'}` });
  }
}

/** 压缩页夹具：把明文 `<diagram>` 的 inner 换成 draw.io 的压缩 payload。 */
function compressDiagram(xml: string): string {
  const open = /<diagram(?=[\s/>])((?:"[^"]*"|'[^']*'|[^>"'])*?)>/i.exec(xml);
  if (open === null) throw new Error('夹具构造失败：XML 里没有 <diagram>');
  const innerStart = open.index + open[0].length;
  const innerEnd = xml.indexOf('</diagram>', innerStart);
  if (innerEnd < 0) throw new Error('夹具构造失败：XML 里没有 </diagram>');
  const inner = xml.slice(innerStart, innerEnd).trim();
  return xml.slice(0, innerStart) + deflate(inner) + xml.slice(innerEnd);
}

async function checkSpec(relativePath: string, failures: Failure[]): Promise<string> {
  const absolute = join(process.cwd(), relativePath);
  const yaml = await readFile(absolute, 'utf8');

  const validated = validateArchSpec(yaml);
  if (!validated.ok) {
    failures.push({ scope: relativePath, detail: `原始 YAML 就校验失败：${JSON.stringify(validated.diagnostics)}` });
    return 'FAIL';
  }
  const original = validated.spec;

  const layout = await layoutSpec(original);
  const title = original.meta.title ?? relativePath.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  const artifact = buildDrawio({ title, spec: original, layout });
  if (artifact.xml.includes('<mxGraphModel') === false) {
    failures.push({ scope: relativePath, detail: '导出的 .drawio 里没有 <mxGraphModel>，不是明文' });
  }

  const parsed = parseDrawio(artifact.xml);
  const unexpected = parsed.warnings.filter(
    (warning) => !EXPECTED_WARNING_PREFIXES.some((prefix) => warning.startsWith(prefix)),
  );
  for (const warning of unexpected) {
    failures.push({ scope: relativePath, detail: `出现意料之外的 warning：${warning}` });
  }

  const roundOne = validateArchSpec(parsed.yamlSpec);
  if (!roundOne.ok) {
    failures.push({
      scope: relativePath,
      detail: `反解出的 YAML 自身校验失败：${JSON.stringify(roundOne.diagnostics)}`,
    });
    return 'FAIL';
  }
  compare(original, roundOne.spec, original.meta.title !== undefined, failures);

  // 二次往返幂等：反解产物再走一遍必须逐字节相同（否则每次交给模型都在抖）。
  const layout2 = await layoutSpec(roundOne.spec);
  const artifact2 = buildDrawio({ title: roundOne.spec.meta.title ?? title, spec: roundOne.spec, layout: layout2 });
  const parsed2 = parseDrawio(artifact2.xml);
  if (parsed2.yamlSpec !== parsed.yamlSpec) {
    failures.push({ scope: relativePath, detail: '二次往返的 YAML 与首次不同（反解不幂等）' });
  }

  // 压缩页分支：注入解压器应得到与明文完全相同的反解结果；不注入解压器应明确报错。
  const compressed = parseDrawio(compressDiagram(artifact.xml), inflate);
  if (compressed.yamlSpec !== parsed.yamlSpec) {
    failures.push({ scope: relativePath, detail: '压缩页解压后的反解结果与明文不一致' });
  }
  let threw = false;
  try {
    parseDrawio(compressDiagram(artifact.xml));
  } catch (error) {
    threw = error instanceof CompressedDiagramError;
  }
  if (!threw) {
    failures.push({ scope: relativePath, detail: '压缩页在未注入解压器时没有抛出 CompressedDiagramError' });
  }

  return `${original.groups.length} 分组 / ${original.nodes.length} 节点 / ${original.edges.length} 连线`;
}

/** 把某个 cell 的 style 属性整体换成给定值（造「用户手改」夹具）。 */
function mutateStyle(xml: string, id: string, next: string): string {
  const pattern = new RegExp(`(<mxCell id="${id}"[^>]*?style=")[^"]*(")`);
  if (!pattern.test(xml)) throw new Error(`夹具构造失败：找不到 cell '${id}' 的 style`);
  return xml.replace(pattern, `$1${next}$2`);
}

/**
 * 降级路径检查：「用户手改过 .drawio」时，反解必须**明确报告**识别不了的部分，而不是静默丢。
 * 这里对 03 的产物做 5 处外科手术，断言每处都落在 warnings 里，且语义没被带歪。
 */
async function checkDegradations(failures: Failure[]): Promise<void> {
  const relativePath = 'examples/03-rpc-items.yaml';
  const yaml = await readFile(join(process.cwd(), relativePath), 'utf8');
  const validated = validateArchSpec(yaml);
  if (!validated.ok) throw new Error('夹具构造失败：03 原始 YAML 校验不过');
  const layout = await layoutSpec(validated.spec);
  const artifact = buildDrawio({ title: validated.spec.meta.title ?? 'fixture', spec: validated.spec, layout });

  let xml = artifact.xml;
  // ① 自由图形：用户随手加的文本框（vertex=1 但不是我们的卡片配色）。
  xml = xml.replace(
    '</root>',
    '<mxCell id="free_note" value="备注：这里是被手加的文本框" style="text;html=1;" vertex="1" parent="1">'
    + '<mxGeometry x="0" y="0" width="120" height="30" as="geometry"/></mxCell></root>',
  );
  // ② 自定义配色。
  xml = mutateStyle(xml, 'director', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#123456;strokeColor=#654321;fontColor=#ffffff;');
  // ③ 分组框样式被改没了 dashed / fillColor。
  xml = mutateStyle(xml, 'g_infra', 'container=1;collapsible=0;rounded=1;');
  // ④ 连线的箭头被抹掉（边 id 是写出侧的下标序号 e_<n>，DSL 里没有边 id）。
  xml = mutateStyle(xml, 'e_0', 'edgeStyle=orthogonalEdgeStyle;');
  // ⑤ 第二个 diagram 页（draw.io 多页文件）。
  xml = xml.replace('</mxfile>', '<diagram id="page-2" name="第二页"></diagram></mxfile>');

  const parsed = parseDrawio(xml);
  const expected = [
    '看起来不是本工具导出的卡片',
    '配色不在引擎调色板里',
    '既没有 dashed 也没有 fillColor',
    '两个方向都没有箭头',
    '只反解了第一页',
    '已丢弃',
    'layout 三项',
  ];
  for (const needle of expected) {
    if (!parsed.warnings.some((warning) => warning.includes(needle))) {
      failures.push({ scope: `${relativePath}（手改夹具）`, detail: `缺少预期告警：${needle}` });
    }
  }

  const round = validateArchSpec(parsed.yamlSpec);
  if (!round.ok) {
    failures.push({ scope: `${relativePath}（手改夹具）`, detail: `反解出的 YAML 不再合法：${JSON.stringify(round.diagnostics)}` });
  } else {
    const directors = round.spec.nodes.filter((node) => node.id === 'director');
    if (directors.length !== 1 || directors[0]?.variant !== 'default') {
      failures.push({ scope: `${relativePath}（手改夹具）`, detail: '自定义配色的节点没有回落成 variant=default' });
    }
    // 自由新增的文本框按「收下 + 告警」处置：必须在 nodes 里，且文本被当作 title 保留下来。
    const free = round.spec.nodes.filter((node) => node.id === 'free_note');
    if (free.length !== 1) {
      failures.push({ scope: `${relativePath}（手改夹具）`, detail: '自由新增的文本框没有被收进 nodes' });
    } else {
      if (free[0]?.variant !== 'default' || free[0]?.title !== '备注：这里是被手加的文本框') {
        failures.push({ scope: `${relativePath}（手改夹具）`, detail: `自由顶点反解不完整：${JSON.stringify(free[0])}` });
      }
    }
    if (round.spec.nodes.length !== validated.spec.nodes.length + 1) {
      failures.push({ scope: `${relativePath}（手改夹具）`, detail: '自由顶点导致了额外的节点增减' });
    }
    const gInfra = round.spec.groups.filter((group) => group.id === 'g_infra');
    if (gInfra.length !== 1 || gInfra[0]?.variant !== 'dashed') {
      failures.push({ scope: `${relativePath}（手改夹具）`, detail: '丢了 dashed/fillColor 的分组没有回落成 variant=dashed' });
    }
  }

  console.log(`\n手改夹具（${relativePath}，5 处外科手术）反解告警 ${parsed.warnings.length} 条：`);
  for (const warning of parsed.warnings) console.log(`  · ${warning}`);
}

const specs = process.argv.slice(2);
const targets = specs.length > 0 ? specs : DEFAULT_SPECS;
const failures: Failure[] = [];

console.log('往返一致性检查：YAML → buildDrawio → parseDrawio → YAML\n');
for (const target of targets) {
  const before = failures.length;
  const summary = await checkSpec(target, failures);
  const status = failures.length === before ? '✅ 一致' : '❌ 不一致';
  console.log(`${status}  ${target}  (${summary})`);
}

await checkDegradations(failures);

if (failures.length > 0) {
  console.log(`\n${failures.length} 处断言失败：`);
  for (const failure of failures) console.log(`  · [${failure.scope}] ${failure.detail}`);
  process.exitCode = 1;
} else {
  console.log(`\n全部 ${targets.length} 个样例通过：语义字段一致 + 反解可再校验 + 二次往返幂等 + 压缩页分支正确；`
    + '手改夹具的 7 类降级告警全部命中。');
}
