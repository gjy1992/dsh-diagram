/**
 * dsh-diagram · 宿主半（可安装 bundle 的 node 侧）。
 *
 * 注册三个工具，语义刻意分开（详见 PLAN.md §Phase 2）：
 *  - `render_architecture`：**模型内联写 YAML** 的通道（本文件）；
 *  - `yaml_to_drawio` / `drawio_to_yaml`：**文件级**双向工具对（`./tools/files.ts`），
 *    服务「用户手改文件 → 看效果 / 交回 AI」的闭环，也是 `layout` 三个旋钮的用户通道。
 *
 * 共同约定：
 * - 校验失败：抛出 message 里带结构化诊断的 Error —— 模型看到的是 `Error: ValidationError: …`，
 *   可直接据此修正重试，这就是 PRD §4.3 要的自愈闭环。
 * - 成功：只回一行统计摘要（+ 可选落盘路径）。draw.io XML 留在宿主，不进模型上下文；
 *   需要给卡片的数据走 `output.presentationMeta`（落在 `tool/result.meta`，同样不进模型上下文）。
 *
 * 依赖说明：`@deepseek-ai/dsh-tools` 是 dsh 自带包，随 dsh 安装解析，本包不声明依赖；
 * `@dsh-diagram/*` 在打包时被 esbuild 内联（见 scripts/build-plugin.mjs）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { renderArchitecture, type Diagnostic } from '@dsh-diagram/core'
import { createDrawioToYaml, createYamlToDrawio } from './tools/files'

/** 需要的宿主服务：工具注册表。文件系统只在 save_drawio 时按需读取。 */
export const inject = ['tools']

/** 诊断回传上限：一次能消化的量级，超出只报总数。 */
const MAX_DIAGNOSTICS = 12

/**
 * 模型可见的工具描述。改动前请与用户确认：它是每次请求的固定开销，
 * 也是模型写对 DSL 的唯一依据（工具契约的组成部分，见 PLAN.md §Phase 2）。
 */
export const DESCRIPTION = [
  '渲染深色卡片式系统架构图：生成可缩放、悬浮高亮连线的预览卡片，并可按需导出/落盘 .drawio 文件。',
  '严禁输出坐标、尺寸或十六进制色值 —— 排版与配色由引擎计算。',
  '',
  'yaml_spec 为 YAML；只有 nodes 与 edges 两个列表本身必填，字段后未标「必填」的一律可选：',
  '  nodes:  [{ id(必填), title(必填), group, desc, variant, items: [rpc:OrderQuery] }]',
  '  edges:  [{ from(必填), to(必填), label, style }]',
  '  groups: [{ id(必填), title(必填), variant, parent }]      # 整个 groups 可选；嵌套只用 parent 单向声明，禁 children 数组，最深 3 层',
  '  meta:   { title, desc, summary, guide }                    # 整个 meta 可选',
  '  node.variant  = default 普通模块 | primary 核心入口 | danger 风险待下线 | warning 待治理 | muted 弱化边缘',
  '  group.variant = dashed 虚线透明框(默认) | filled 实色填充框',
  '  edge.style    = solid 单向实线(默认) | dashed 单向虚线 | bidirectional 双向箭头',
  '  node.items 列该模块的 RPC/接口清单，会自动加高卡片；node.group 可指向任意层级的分组 id，不写则置于根画布。',
  'id 用字母数字下划线。校验失败会回结构化错误（含 did-you-mean），按提示修正后重试。',
  '需要把 .drawio 落盘到工作区时置 save_drawio: true。',
].join('\n')

/**
 * Phase 1 的结构化诊断渲染成模型可读的文本（即 ToolError 载荷）。
 * 每条一行：`序号. 路径 [错误码] 说明 Did you mean '…'?`
 * @param diagnostics - `validateArchSpec()` 产出的诊断数组。
 * @param subject - 首行里「哪里有问题」：内联工具是 `yaml_spec`，文件级工具传文件路径。
 *   必须区分，否则文件级调用会看到「yaml_spec 中有 N 处问题」却找不到那个 yaml_spec。
 * @returns 抛进 Error.message 的完整文本。
 */
export function formatDiagnostics(diagnostics: readonly Diagnostic[], subject = 'yaml_spec'): string {
  const shown = diagnostics.slice(0, MAX_DIAGNOSTICS)
  const lines = shown.map((d, index) => {
    const hint = d.hint === undefined ? '' : ` Did you mean '${d.hint}'?`
    return `${index + 1}. ${d.path} [${d.code}] ${d.message}${hint}`
  })
  const hidden = diagnostics.length - shown.length
  if (hidden > 0) lines.push(`… 另有 ${hidden} 处问题未列出。`)
  return [
    `ValidationError: ${subject} 中有 ${diagnostics.length} 处问题，请修正后重新调用本工具。`,
    '',
    ...lines,
  ].join('\n')
}

/** `ctx.fs` 的最小结构化视图（权威契约见 @deepseek-ai/dsh-fs 的 FsService）。 */
interface FsLike {
  resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<{ displayPath: string }>
  writeText(
    target: unknown,
    content: string,
    expected?: undefined,
    signal?: AbortSignal,
    sandboxPolicy?: { mode: string; workspaceRoot: string; sessionId?: unknown },
  ): Promise<{ version: unknown }>
}

/** `ctx.sandboxPolicy` 的最小结构化视图（权威契约见 @deepseek-ai/dsh-sandbox-policy）。 */
interface SandboxPolicyLike {
  resolve(request?: { session?: unknown }): { mode: string; workspaceRoot: string; sessionId?: unknown }
}

/**
 * 把导出出来的明文 XML 落盘到会话工作区，走宿主 fs 服务（受 fs 策略治理、计入工作区变更）。
 *
 * ⚠️ 实测踩坑（2026-10-01）：`fs.writeText()` **省略** `sandboxPolicy` 不等于「沿用当前会话策略」，
 * 而是退回后端自己的兜底 —— 它没有会话 cwd，于是 `workspace-write` 闸门把会话工作区判成"外面"，
 * 写入被拒：`file access denied under workspace-write mode`（目标明明就在工作区里）。
 * 正解是每次执行都用 `ctx.sandboxPolicy.resolve({ session })` 解析出「会话模式 + 会话 cwd 边界」
 * 再显式传下去，与 tool-fs 的做法一致。
 *
 * @param ctx - 插件上下文。
 * @param exec - 本次调用（取会话、cwd 与取消信号）。
 * @param fileName - 目标文件名（已由引擎 sanitize）。
 * @param xml - 未压缩明文 draw.io XML。
 * @returns 落盘后的展示路径。
 */
async function saveDrawio(
  ctx: Context,
  exec: { agent?: { session: unknown }; signal: AbortSignal },
  fileName: string,
  xml: string,
): Promise<string> {
  const fs = ctx.get('fs') as unknown as FsLike | undefined
  if (fs === undefined) {
    throw new Error('save_drawio 需要宿主 fs 服务（ctx.fs），但当前 profile 未加载文件系统插件。')
  }
  const session = exec.agent?.session
  const cwd = (session as { header?: { cwd?: string } } | undefined)?.header?.cwd
  const policy = (ctx.get('sandboxPolicy') as unknown as SandboxPolicyLike | undefined)
    ?.resolve(session === undefined ? {} : { session })
  const target = await fs.resolve(fileName, { ...(cwd === undefined ? {} : { cwd }), signal: exec.signal })
  const outcome = await fs.writeText(target, xml, undefined, exec.signal, policy)
  // 与 tool-fs 一致：写入后登记该文件当前版本，保持观察账本真实。
  ctx.emit('fs/observed', target, { kind: 'present', version: outcome.version }, exec)
  return target.displayPath
}

/**
 * 注册 `render_architecture` 与文件级工具对。注册即生效 —— 注册表会把 schema 喂给 system prompt 装配。
 * @param ctx - 插件上下文（`inject: ['tools']` 保证 ctx.tools 存在）。
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'render_architecture',
    description: DESCRIPTION,
    parameters: {
      title: { type: 'string', required: true, description: '架构图总标题，同时用作导出文件名。' },
      yaml_spec: { type: 'string', required: true, description: '完整的架构拓扑 YAML 文本。' },
      save_drawio: {
        type: 'boolean',
        description: '是否把 .drawio 落盘到会话工作区，缺省 false。仅在用户明确要文件时置 true。',
      },
    },
    output: {
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
      render: (_args, value) => [{
        type: 'text',
        text: `已生成架构图：${value.groups} 个分组 / ${value.nodes} 个节点 / ${value.edges} 条连线，`
          + `画布 ${Math.round(value.width)}×${Math.round(value.height)}；预览卡片已挂在对话中，`
          + `可导出 ${value.file_name}。`
          + (value.saved_path === undefined ? '' : ` 已落盘到 ${value.saved_path}。`),
      }],
    },
    async execute(args, exec) {
      const rendered = await renderArchitecture({ title: args.title, yamlSpec: args.yaml_spec })
      if (!rendered.ok) {
        // 唯一失败通道：模型看到 `Error: <这段>`，据此自愈重试。
        throw new Error(formatDiagnostics(rendered.diagnostics))
      }
      const { summary, drawioXml } = rendered.data
      const value: {
        groups: number
        nodes: number
        edges: number
        width: number
        height: number
        file_name: string
        saved_path?: string
      } = {
        groups: summary.groups,
        nodes: summary.nodes,
        edges: summary.edges,
        width: summary.width,
        height: summary.height,
        file_name: summary.fileName,
      }
      if (args.save_drawio === true) {
        value.saved_path = await saveDrawio(ctx, exec, summary.fileName, drawioXml)
      }
      return value
    },
  }))

  // 文件级双向工具对（PLAN.md §P2.7）：入参是路径，服务「用户手改文件 → 看效果 / 交回 AI」。
  // `formatDiagnostics` 以依赖注入的方式传下去，避免 host.ts ↔ tools/files.ts 形成循环 import。
  const fileToolDeps = { formatDiagnostics }
  ctx.tools.register(createYamlToDrawio(ctx, fileToolDeps))
  ctx.tools.register(createDrawioToYaml(ctx, fileToolDeps))
}
