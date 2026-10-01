/**
 * dsh-diagram · 宿主半 · **文件级**双向工具对。
 *
 * 为什么与 `render_architecture` 分开（语义不同，那个的契约一个字都不动）：
 *   - `render_architecture`：**模型内联写 YAML** 的通道，参数里带 `title` + `yaml_spec`；
 *   - `yaml_to_drawio`   ：**以文件路径为入口**的渲染通道，用来响应「我改了 xxx.yaml，看看效果」；
 *   - `drawio_to_yaml`   ：回程，把用户手改过的 `.drawio` 反解回 YAML 交给模型继续改。
 *
 * 这一层的存在理由是一条用户裁决：`layout` 的三个旋钮（direction / inner_direction / max_columns）
 * **刻意不教模型**，是留给用户手改 YAML 的。用户改完必须能立刻看到效果，于是需要一条不经过
 * 模型上下文、以路径为入口的渲染通道。反过程同理：用户也可能直接改图。
 *
 * 依赖说明：`@deepseek-ai/dsh-tools` / `@deepseek-ai/cordis` 是 dsh 自带包（打包时 external），
 * `@dsh-diagram/*` 由 esbuild 内联；`node:zlib` 只用于解 draw.io 的压缩页，本文件**只进宿主半**。
 */
import { inflateRawSync } from 'node:zlib';
import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { Diagnostic } from '@dsh-diagram/schema';
import { validateArchSpec } from '@dsh-diagram/schema';
import { layoutSpec } from '@dsh-diagram/layout';
import { buildDrawio, parseDrawio, type InflateRaw } from '@dsh-diagram/drawio';

/**
 * 宿主侧注入项。
 *
 * `formatDiagnostics` 由 `host.ts` 提供而不是从那里 import：两个模块互相 import 会组成
 * 循环依赖（host.ts 要 register 本文件的工具），而错误载荷的文案必须只有一份实现。
 */
export interface FileToolDeps {
  formatDiagnostics(diagnostics: readonly Diagnostic[], subject?: string): string;
}

/** 本文件用到的 `ctx.fs` 最小切片（权威契约见 @deepseek-ai/dsh-fs 的 FsService）。 */
interface FsTargetLike {
  displayPath: string;
}

interface FsLike {
  resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTargetLike>;
  stat(target: FsTargetLike, signal?: AbortSignal): Promise<{ version: unknown } | undefined>;
  readText(target: FsTargetLike, signal?: AbortSignal): Promise<string>;
  writeText(
    target: FsTargetLike,
    content: string,
    expected?: undefined,
    signal?: AbortSignal,
    sandboxPolicy?: { mode: string; workspaceRoot: string; sessionId?: unknown },
  ): Promise<{ version: unknown }>;
}

/** 本文件用到的 `ctx.sandboxPolicy` 最小切片（权威契约见 @deepseek-ai/dsh-sandbox-policy）。 */
interface SandboxPolicyLike {
  resolve(request?: { session?: unknown }): { mode: string; workspaceRoot: string; sessionId?: unknown };
}

/** 本次调用的执行上下文切片（权威契约见 defineTool 的 ToolRunContext）。 */
interface FileToolExec {
  agent?: { session?: unknown };
  signal: AbortSignal;
}

/** 模型可见的工具描述（中文，与 `render_architecture` 同风格）。 */
export const YAML_TO_DRAWIO_DESCRIPTION = [
  '把用户手改过的 YAML 文件渲染成深色卡片式架构图：读文件 → 校验 → 布局 → 导出 .drawio，并在对话里出预览卡片。',
  '这是**文件级**通道：入参只有路径，用来响应「我改了 xxx.yaml，给我看看效果」这类请求；模型自己内联写 YAML 请改用 render_architecture。',
  'layout 三项（direction / inner_direction / max_columns）刻意不在本工具文档里 —— 它们是留给**用户手改 YAML** 的旋钮。用户改完由本工具重新渲染即可看到效果，不要替用户猜这些值，也不要因为它们不在文档里就删掉。',
  '校验失败会回结构化错误（含 did-you-mean）：把错误原样告诉用户，或按提示改文件后重试；不要伪造内容去绕过校验。',
].join('\n');

export const DRAWIO_TO_YAML_DESCRIPTION = [
  '把用户手改过的 .drawio 文件反解回 YAML DSL 文本，交给模型继续改（配合 yaml_to_drawio 再出图）。',
  '这是**文件级**回程通道：用户在 draw.io 里加了框、改了标题、删了连线时，用它把语义捡回来。',
  '可还原：分组 / 节点 / 连线的语义字段（title / desc / items / variant / parent / group / from / to / label / style）。',
  '不可还原：几何坐标（DSL 没有坐标，重排由引擎重算）、自由新增的图形、自定义样式、layout 三项 —— 会逐条列在 warnings 里，请据此决定哪些要人工补。',
  'draw.io 默认「压缩」保存的 diagram 会自动解压；解压失败时请让用户用「未压缩 XML」另存后再试。',
].join('\n');

/** draw.io 压缩页的解压：base64 → raw deflate → URI 解码（与 mxUtils.compress 严格对称）。 */
const inflate: InflateRaw = (base64) => decodeURIComponent(inflateRawSync(Buffer.from(base64, 'base64')).toString('utf8'));

function decodeCompressedDiagram(base64: string): string {
  try {
    return inflate(base64);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `该 .drawio 的 <diagram> 是压缩页，但解压失败（${reason}）。`
      + '请用 draw.io 打开后「另存为」未压缩 XML，或直接把原始 XML 贴出来。',
    );
  }
}

function requireFs(ctx: Context): FsLike {
  const fs = ctx.get('fs') as unknown as FsLike | undefined;
  if (fs === undefined) {
    throw new Error('本工具需要宿主 fs 服务（ctx.fs），但当前 profile 未加载文件系统插件。');
  }
  return fs;
}

function sessionCwd(exec: FileToolExec): string | undefined {
  const session = exec.agent?.session as { header?: { cwd?: string } } | undefined;
  return session?.header?.cwd;
}

/**
 * 读文件并登记 `fs/observed`。
 *
 * 为什么必须登记：`fs-observation-policy` 的约定是「**直接 ctx.fs 读取不发 fs/observed**」，
 * 于是读完之后模型再想 `edit` 这个 YAML 会被判 `FS_NOT_OBSERVED`。这里补上这次观察
 * （与 `tool-fs` 的 read 同型：读成功后用 stat 到的版本登记），让「渲染 → 改文件 → 再渲染」
 * 这个闭环在同一个 session 里能连续走通。
 */
async function readTextObserved(
  ctx: Context,
  fs: FsLike,
  path: string,
  cwd: string | undefined,
  exec: FileToolExec,
): Promise<string> {
  const target = await fs.resolve(path, { ...(cwd === undefined ? {} : { cwd }), signal: exec.signal });
  const text = await fs.readText(target, exec.signal);
  const info = await fs.stat(target, exec.signal);
  if (info !== undefined) {
    ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec);
  }
  return text;
}

/**
 * 落盘到 **YAML 同目录**（不是会话 cwd）。
 *
 * ⚠️ 与 host.ts 的 C1 同源：`fs.writeText()` 省略 `sandboxPolicy` 会退回部署默认根，
 * 把会话工作区判成"外面"而拒绝写入，所以每次都要用 `ctx.sandboxPolicy.resolve({ session })`
 * 解析出「会话模式 + 会话边界」再显式传下去。
 */
async function saveBesideYaml(
  ctx: Context,
  fs: FsLike,
  exec: FileToolExec,
  sourcePath: string,
  fileName: string,
  xml: string,
): Promise<string> {
  const session = exec.agent?.session;
  const cwd = sessionCwd(exec);
  const policy = (ctx.get('sandboxPolicy') as unknown as SandboxPolicyLike | undefined)
    ?.resolve(session === undefined ? {} : { session });
  const target = await fs.resolve(joinPath(directoryOf(sourcePath), fileName), {
    ...(cwd === undefined ? {} : { cwd }),
    signal: exec.signal,
  });
  const outcome = await fs.writeText(target, xml, undefined, exec.signal, policy);
  ctx.emit('fs/observed', target, { kind: 'present', version: outcome.version }, exec);
  return target.displayPath;
}

/** 取输入路径的目录部分（不引 `node:path`：只被宿主半打包，但保持这一层零 node 依赖更省事）。 */
function directoryOf(path: string): string {
  const match = /^(.*)[\\/][^\\/]*$/.exec(path);
  return match === null ? '' : match[1] ?? '';
}

/** 保留输入路径的分隔符风格，避免把 `F:\a\b` 拼成 `F:\a\b/c.drawio`。 */
function joinPath(directory: string, name: string): string {
  if (directory === '') return name;
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return `${directory}${separator}${name}`;
}

/** 文件名的去扩展名部分（title 的最后一级回落）。 */
function baseNameWithoutExtension(path: string): string {
  const base = path.replace(/^.*[\\/]/, '');
  const stripped = base.replace(/\.[^.]+$/, '');
  return stripped === '' ? base : stripped;
}

/**
 * 注册 `yaml_to_drawio`。
 * @param ctx - 插件上下文。
 * @param deps - `formatDiagnostics`（复用 `render_architecture` 的错误载荷实现）。
 */
export function createYamlToDrawio(ctx: Context, deps: FileToolDeps) {
  /**
   * 每次调用的 YAML 原文，按 `exec.arguments` 的**对象身份**挂载。
   *
   * 为什么用 WeakMap：卡片（`plugin/src/client.tsx`）靠调用参数现场重算布局，而本工具的参数
   * 只有 `path`，浏览器读不到磁盘 —— 所以必须把 YAML 原文经 `presentationMeta → tool/result.meta`
   * 送到客户端。`presentationMeta(args, value)` 拿不到 exec，但它的 `args` 与 `execute` 的 `args`
   * 是**同一个对象**（`dsh-tools` 的 createSuccessResult 两次都用 `exec.arguments`），
   * 因此按对象身份查表天然「按调用隔离」，并发调用之间不会串味（用模块级变量就会串）。
   */
  const yamlByCall = new WeakMap<object, string>();

  return defineTool({
    name: 'yaml_to_drawio',
    description: YAML_TO_DRAWIO_DESCRIPTION,
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'YAML 文件的路径（相对会话工作区，或绝对路径）。',
      },
      save_drawio: {
        type: 'boolean',
        description: '是否把 .drawio 落盘到 YAML 同目录，缺省 true（本工具的主要用途就是出文件）。',
      },
    },
    output: {
      // 与 render_architecture 同构：卡片与摘要都能复用同一套展示口径。
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          groups: { type: 'integer', required: true },
          nodes: { type: 'integer', required: true },
          edges: { type: 'integer', required: true },
          width: { type: 'number', required: true },
          height: { type: 'number', required: true },
          file_name: { type: 'string', required: true },
          saved_path: { type: 'string' },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: `已按 ${args.path} 渲染架构图：${value.groups} 个分组 / ${value.nodes} 个节点 / `
          + `${value.edges} 条连线，画布 ${Math.round(value.width)}×${Math.round(value.height)}；`
          + `预览卡片已挂在对话中，可导出 ${value.file_name}。`
          + (value.saved_path === undefined ? '' : ` 已落盘到 ${value.saved_path}。`),
      }],
      /**
       * 把 YAML 原文送进 `tool/result.meta`（不进模型上下文）。
       *
       * 卡片侧读法：`block.meta?.yaml_spec`。注意它只在**根调用**上投影 ——
       * PTC 预设下经 `run_code` 派发的子调用没有 meta（宿主 `exec.parent !== undefined` 时跳过），
       * 那种情况下卡片必须降级（只显示摘要/错误），不能假设一定拿得到。
       */
      presentationMeta: (args, value) => {
        const source = yamlByCall.get(args);
        return {
          ...(source === undefined ? {} : { yaml_spec: source }),
          file_name: value.file_name,
          ...(value.saved_path === undefined ? {} : { saved_path: value.saved_path }),
        };
      },
    },
    async execute(args, exec) {
      const fs = requireFs(ctx);
      const cwd = sessionCwd(exec);
      const source = await readTextObserved(ctx, fs, args.path, cwd, exec);

      const validated = validateArchSpec(source);
      if (!validated.ok) {
        // 唯一失败通道（与 render_architecture 一致）：模型看到 `Error: <诊断>`，据此自愈。
        // 首行主语传文件路径——本工具的参数里没有 yaml_spec，说 yaml_spec 会让模型找不着北。
        throw new Error(deps.formatDiagnostics(validated.diagnostics, args.path));
      }

      const spec = validated.spec;
      const layout = await layoutSpec(spec);
      // 文件名回落：meta.title → YAML 文件名去扩展名（没有独立的 title 参数）。
      const title = spec.meta.title ?? baseNameWithoutExtension(args.path);
      const artifact = buildDrawio({ title, spec, layout });
      yamlByCall.set(args, source);

      const value: {
        groups: number;
        nodes: number;
        edges: number;
        width: number;
        height: number;
        file_name: string;
        saved_path?: string;
      } = {
        groups: spec.groups.length,
        nodes: spec.nodes.length,
        edges: spec.edges.length,
        width: Math.round(layout.bounds.width),
        height: Math.round(layout.bounds.height),
        file_name: artifact.fileName,
      };

      if (args.save_drawio !== false) {
        value.saved_path = await saveBesideYaml(ctx, fs, exec, args.path, artifact.fileName, artifact.xml);
      }
      return value;
    },
  });
}

/**
 * 注册 `drawio_to_yaml`。
 *
 * 反解路径上没有「校验失败」这个概念（产物是文本，不是 spec），所以本工具用不到 `deps`；
 * 签名仍与 `createYamlToDrawio` 对齐，方便注册处统一传参。
 * @param ctx - 插件上下文。
 */
export function createDrawioToYaml(ctx: Context, _deps: FileToolDeps) {
  return defineTool({
    name: 'drawio_to_yaml',
    description: DRAWIO_TO_YAML_DESCRIPTION,
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: '.drawio 文件的路径（相对会话工作区，或绝对路径）。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          yaml_spec: { type: 'string', required: true, description: '反解出的 YAML DSL 文本。' },
          warnings: {
            type: 'array',
            required: true,
            description: '无法还原的部分（几何坐标、自由图形、自定义样式、layout 三项…）。',
            items: { type: 'string' },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          '已把 .drawio 反解为 YAML DSL；可直接编辑后交给 yaml_to_drawio 重新渲染。',
          '',
          value.yaml_spec.trimEnd(),
          ...(value.warnings.length === 0
            ? []
            : ['', `无法还原的部分（${value.warnings.length} 条）：`, ...value.warnings.map((warning) => `- ${warning}`)]),
        ].join('\n'),
      }],
      /** 与另一个工具对称：卡片/回放可以从 meta 拿到纯 YAML，不必去解析模型可见的那段文本。 */
      presentationMeta: (_args, value) => ({
        yaml_spec: value.yaml_spec,
        warnings: value.warnings,
      }),
    },
    async execute(args, exec) {
      const fs = requireFs(ctx);
      const cwd = sessionCwd(exec);
      const xml = await readTextObserved(ctx, fs, args.path, cwd, exec);
      const parsed = parseDrawio(xml, decodeCompressedDiagram);
      return { yaml_spec: parsed.yamlSpec, warnings: parsed.warnings };
    },
  });
}
