/**
 * dsh-diagram · 客户端半（浏览器）。
 *
 * 三件事：
 *   ① keyed toolview（`render_architecture` / `yaml_to_drawio`）—— 接管工具调用那一行，
 *      从**调用参数或 `tool/result.meta`** 拿到 YAML，现场重算并画出深色 SVG 卡片；
 *   ② conversation 事件定义 —— 把本回合产出的图折进 `TurnLocation.data`；
 *   ③ `conversation.chat.turnTail` 条目 —— 在**回合末尾**再摆一次本轮图。
 *      ②③ 合起来解决「工具行被 step 折叠行收起后看不见图」：折叠行属 ui-chat
 *      （`shadows-shipped-ui`），插件不该去改宿主的默认折叠行为，只旁路。
 *
 * 行头（T8）按宿主 `ui-tool` 的 `ToolRow` **照抄口径**，不 import 它的 primitives：
 *   - 展开态走 slot owner 给的 `useDisclosure()`（与宿主行同一套 turn 级折叠状态），
 *     而不是组件自己的 state —— 否则「收起整个回合」时我们的行不会跟着复位；
 *   - hover 是**文字色变**（`--dsw-alias-label-tertiary` → `--dsw-alias-label-primary`），
 *     不是底色块；标题字重 400；标题与摘要之间是 2×2 的分隔点；
 *   - 展开体末尾在 `inspect` 存在时给一个**悬停浮现**的胶囊按钮（跳轨迹视图）；
 *   - 需要 :hover / :focus-visible 的规则只能进组件自带的一段 `<style>`（内联样式表达不了），
 *     类名一律 `dsh-diagram-` 前缀，颜色只用 `--dsw-alias-*` token、字号走
 *     `--dsh-content-font-size-secondary`（跟随用户的字号偏好）。
 *
 * 数据来源只有「原始调用参数 + 结果内容 + 失败状态 + 持久 meta」——与官方口径一致
 * （built-in Web Client 不消费宿主 presentCall/presentResult）。因此：
 *   - 零上下文开销：坐标/YAML 都不靠宿主塞进 tool result 的**文本**；
 *   - replay / fork 之后照样能画：YAML 现场重算，不依赖宿主内存状态。
 *
 * 客户端半刻意**不 import 任何 dsh 客户端包**：类型检查（`pnpm typecheck:plugin`）
 * 只映射了 cordis / dsh-tools / react，这里以最小结构声明用到的槽位与事件契约，
 * 并由 inspect 到的槽位目录与 `dsh-univer-office` 的同类实现校对。
 */
import { useCallback, useMemo, useState } from 'react'
import { DiagramCanvas } from './diagram/DiagramCanvas'
import { downloadDrawio, useDiagramModel } from './diagram/model'
import { TurnPreview } from './diagram/TurnPreview'
import { diagramTurnDefinition, type TurnOwnerProps } from './diagram/turn-diagrams'

/** 客户端 locale 命名空间（与 ctx.locale.register 的第一个参数一致）。 */
const NS = 'dsh-diagram'

/** 本视图接管的两个 wire 工具名（也是 toolview 的 slot key）。 */
const TOOL_NAMES = ['render_architecture', 'yaml_to_drawio'] as const

/** turnTail 条目的 id（list 槽：新 id 追加一个条目）。 */
const TURN_PREVIEW_ID = 'dsh-diagram-turn-preview'

const zh = {
  title: '架构图',
  preparing: '正在读取参数…',
  running: '渲染中…',
  done: '已渲染',
  failed: '渲染失败',
  nodeDetail: '节点详情',
  inEdges: '入边',
  outEdges: '出边',
  close: '关闭',
  inspect: '查看轨迹',
  saved: '已落盘到',
  reparseFailed: '卡片无法重算布局（宿主已通过校验，这是预览侧的问题）',
  metaMissing: '卡片读不到 YAML：文件级工具的 meta 没送达（经 run_code 嵌套调用时会这样）。展开「详情」可看宿主返回的摘要与落盘路径。',
  turnTitle: '本回合架构图',
  fitWidth: '适应宽度',
  fitAll: '整图',
  zoomIn: '放大',
  zoomOut: '缩小',
  download: '下载 .drawio',
  unit: '节点',
  link: '连线',
}

const en = {
  title: 'Architecture diagram',
  preparing: 'Reading arguments…',
  running: 'Rendering…',
  done: 'Rendered',
  failed: 'Render failed',
  nodeDetail: 'Node detail',
  inEdges: 'Incoming',
  outEdges: 'Outgoing',
  close: 'Close',
  inspect: 'Inspect',
  saved: 'Saved to',
  reparseFailed: 'The card could not re-derive the layout (the host validated it; this is a preview-side problem)',
  metaMissing: 'The card cannot read the YAML: the file-tool meta did not reach the client (this happens for run_code sub-calls). Expand Details for the host summary and saved path.',
  turnTitle: 'Diagrams in this turn',
  fitWidth: 'Fit width',
  fitAll: 'Whole diagram',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  download: 'Download .drawio',
  unit: 'nodes',
  link: 'edges',
}

type Dict = typeof zh

/**
 * 行头样式。
 *
 * 只能放这里的原因：`:hover` / `:focus-visible` 表达不进内联样式。类名全部 `dsh-diagram-`
 * 前缀（不与宿主或别的插件撞名），颜色只走 `--dsw-alias-*` token。这段样式随组件
 * 挂载/卸载，不残留。
 */
const CARD_CSS = `
.dsh-diagram-card { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
.dsh-diagram-row { display: flex; align-items: center; min-height: 24px; border-radius: 6px; }
.dsh-diagram-row[data-expandable="true"] { cursor: pointer; }
.dsh-diagram-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dsh-diagram-leading { display: inline-flex; align-items: center; justify-content: center; width: 16px; flex: 0 0 16px; }
.dsh-diagram-dot { width: 8px; height: 8px; border-radius: 50%; }
.dsh-diagram-title { font-size: 13px; font-weight: 400; color: var(--dsw-alias-label-primary);
  transition: color 100ms ease; white-space: nowrap; }
.dsh-diagram-sep { flex: none; width: 2px; height: 2px; border-radius: 1px; margin: 0 8px;
  background: var(--dsw-alias-label-caption); }
.dsh-diagram-summary { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--dsh-content-font-size-secondary, 13px); line-height: 24px;
  color: var(--dsw-alias-label-tertiary); transition: color 100ms ease; }
.dsh-diagram-status { flex: none; margin-left: 8px; font-size: var(--dsh-content-font-size-secondary, 13px); }
.dsh-diagram-chevron { flex: none; display: inline-flex; margin-left: 8px; color: var(--dsw-alias-label-secondary);
  transition: transform 120ms ease; }
.dsh-diagram-chevron[data-open="true"] { transform: rotate(90deg); }
.dsh-diagram-row:hover .dsh-diagram-summary { color: var(--dsw-alias-label-primary); }
.dsh-diagram-body { font-family: var(--ds-font-family-code, ui-monospace, Menlo, Consolas, monospace);
  font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 8px 10px; margin: 0;
  max-height: 260px; overflow: auto; }
.dsh-diagram-note { font-size: var(--dsh-content-font-size-secondary, 13px); color: var(--dsw-alias-label-tertiary); }
.dsh-diagram-saved { font-family: var(--ds-font-family-code, ui-monospace, Menlo, Consolas, monospace); font-size: 11px;
  color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-diagram-inspect { display: inline-flex; align-self: flex-start; align-items: center; gap: 4px;
  margin: 2px 0 0 4px; padding: 2px 8px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 999px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-secondary);
  font-size: 11px; line-height: 16px; cursor: pointer; opacity: 0; transition: opacity 100ms ease; }
.dsh-diagram-card:hover .dsh-diagram-inspect, .dsh-diagram-inspect:focus-visible { opacity: 1; }
.dsh-diagram-inspect:hover { background: var(--dsw-alias-interactive-bg-hover-solid); color: var(--dsw-alias-label-primary); }
.dsh-diagram-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; }
`

/** 一次调用的冻结切片，全部由 block 派生（replay 稳定，不依赖宿主状态）。 */
interface CallSlice {
  argsRaw: string | null
  /** 布局重算用的 YAML：优先调用参数，其次 `tool/result.meta` */
  yamlSpec: string
  title: string
  result: string | null
  /** 落盘后的绝对路径（`tool/result.meta.saved_path`）；没有则为 null */
  savedPath: string | null
  isError: boolean
  state: 'preparing' | 'running' | 'ok' | 'error'
}

/** 只把普通对象当记录看：null / 数组 / 标量一律 undefined。 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** 内容块拍平成展示文本（与 ui-tool 的 resultText 同口径）。 */
function flatten(content: readonly { type?: string; text?: string }[]): string {
  return content
    .map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : JSON.stringify(block)))
    .join('\n')
}

/** 从 slot 给出的阶段 block 派生展示切片。 */
function readSlice(block: {
  phase?: 'preparing' | 'start'
  argsRaw?: string
  kind?: string
  call?: { argsRaw?: string } | null
  content?: readonly { type?: string; text?: string }[]
  meta?: unknown
  isError?: boolean
}): CallSlice {
  const settled = typeof block.kind === 'string'
  const argsRaw = settled
    ? block.call?.argsRaw ?? ''
    : block.phase === 'start' ? block.argsRaw ?? '' : null

  let title = ''
  let argsYaml = ''
  if (argsRaw !== null && argsRaw !== '') {
    try {
      const parsed = JSON.parse(argsRaw) as { title?: unknown; yaml_spec?: unknown }
      if (typeof parsed.title === 'string') title = parsed.title
      if (typeof parsed.yaml_spec === 'string') argsYaml = parsed.yaml_spec
    } catch {
      // 流式参数被截断（半截 JSON）：忽略，等下一个阶段。
    }
  }

  // 文件级工具的参数里只有 path —— YAML 只能从 meta 走（见宿主 files.ts）。
  const meta = settled ? asRecord(block.meta) : undefined
  const yamlSpec = argsYaml !== ''
    ? argsYaml
    : (typeof meta?.yaml_spec === 'string' ? meta.yaml_spec : '')
  const savedPath = typeof meta?.saved_path === 'string' ? meta.saved_path : null

  const result = settled ? flatten(block.content ?? []) : null
  const isError = settled ? block.isError === true : false
  const state: CallSlice['state'] = !settled
    ? block.phase === 'preparing' ? 'preparing' : 'running'
    : isError ? 'error' : 'ok'
  return { argsRaw, yamlSpec, title, result, savedPath, isError, state }
}

/** 状态色：语义色走主题 token，不写死。 */
function stateColor(state: CallSlice['state']): string {
  if (state === 'error') return 'var(--dsw-alias-state-error-primary)'
  if (state === 'ok') return 'var(--dsw-alias-state-success-primary)'
  return 'var(--dsw-alias-state-idle-primary)'
}

/**
 * 兜底展开态（正常路径用不到）。
 *
 * 之所以单独成函数：`useDisclosure` 是 Hook，必须在组件顶层无条件、按同一顺序调用，
 * 所以「有没有 owner 给的 Hook」不能变成条件 Hook，只能换一个同形的函数传进去。
 * @returns 与宿主行同形的展开态。
 */
function useLocalDisclosure(): { expanded: boolean; toggle: () => void } {
  const [expanded, setExpanded] = useState(false)
  return { expanded, toggle: () => setExpanded((value) => !value) }
}

/** 展开箭头（宿主行同款语义：展开时旋转 90°）。 */
function Chevron({ open }: { open: boolean }) {
  return (
    <span className="dsh-diagram-chevron" data-open={open ? 'true' : 'false'} aria-hidden>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 2.5 L8 6 L4.5 9.5" />
      </svg>
    </span>
  )
}

/** 卡片主体。props 由 slot 运行时给出（ToolCallOwnerProps 的子集）。 */
function DiagramCard(props: {
  callId?: string
  toolName?: string
  block: Parameters<typeof readSlice>[0]
  /** 宿主行的折叠 Hook（turn 级；收起整个回合时一并复位） */
  useDisclosure: () => { expanded: boolean; toggle: () => void }
  /** 跳轨迹视图；缺省表示该视图不可用 */
  inspect?: () => void
  t: (key: keyof Dict) => string
}) {
  const { callId, block, t, inspect } = props
  const slice = readSlice(block)
  const { expanded, toggle } = props.useDisclosure()
  const { model, error: modelError } = useDiagramModel(slice.yamlSpec, slice.title)

  const onDownload = useCallback(() => {
    if (model === null) return
    try {
      downloadDrawio(model)
    } catch (error: unknown) {
      console.error('[dsh-diagram] 导出 .drawio 失败:', error)
    }
  }, [model])

  const labels = useMemo(() => ({
    fitWidth: t('fitWidth'),
    fitAll: t('fitAll'),
    zoomIn: t('zoomIn'),
    zoomOut: t('zoomOut'),
    download: t('download'),
    detail: t('nodeDetail'),
    inEdges: t('inEdges'),
    outEdges: t('outEdges'),
    close: t('close'),
  }), [t])

  const statusText = slice.state === 'preparing'
    ? t('preparing')
    : slice.state === 'running' ? t('running') : slice.state === 'error' ? t('failed') : t('done')
  const counts = model === null
    ? ''
    : `${model.layout.nodes.length} ${t('unit')} · ${model.layout.edges.length} ${t('link')}`
  const summary = [counts, slice.title !== '' ? slice.title : model?.title ?? ''].filter((part) => part !== '').join(' · ')
  const details = slice.result ?? slice.argsRaw ?? ''
  const expandable = details !== ''
  // 只要客户端能重算出布局就出图：`save_drawio` 被沙箱拒绝这类失败里图本身是好的，
  // 应该「出图 + 把错误摆在下面」，而不是整行只剩错误文本。
  const canRender = model !== null
  const metaMissing = slice.state !== 'preparing' && slice.state !== 'error' && slice.yamlSpec === ''
  const open = expanded && expandable

  return (
    <div
      className="dsh-diagram-card"
      data-dsh-diagram-card={props.toolName ?? 'render_architecture'}
      data-state={slice.state}
    >
      <style>{CARD_CSS}</style>
      <span className="dsh-diagram-visually-hidden">{statusText}</span>

      <div
        className="dsh-diagram-row"
        data-expandable={expandable ? 'true' : 'false'}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? open : undefined}
        onClick={expandable ? toggle : undefined}
        onKeyDown={expandable
          ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              toggle()
            }
          }
          : undefined}
      >
        <span className="dsh-diagram-leading">
          <span className="dsh-diagram-dot" style={{ background: stateColor(slice.state) }} aria-hidden />
        </span>
        <span className="dsh-diagram-title">{t('title')}</span>
        <span className="dsh-diagram-sep" aria-hidden />
        <span className="dsh-diagram-summary">{summary === '' ? statusText : summary}</span>
        <span className="dsh-diagram-status" style={{ color: stateColor(slice.state) }}>{statusText}</span>
        {expandable && <Chevron open={open} />}
      </div>

      {canRender && (
        <DiagramCanvas
          scene={model.scene}
          fileName={model.title}
          onDownload={onDownload}
          labels={labels}
          idPrefix={`dsh-diagram-${callId ?? 'call'}`}
        />
      )}

      {slice.savedPath !== null && (
        <div className="dsh-diagram-saved" title={slice.savedPath}>{t('saved')} {slice.savedPath}</div>
      )}

      {slice.state === 'error' && (
        <pre className="dsh-diagram-body" style={{ color: 'var(--dsw-alias-state-error-primary)' }}>
          {slice.result ?? ''}
        </pre>
      )}

      {metaMissing && <div className="dsh-diagram-note">{t('metaMissing')}</div>}

      {modelError !== null && (
        <div className="dsh-diagram-note">{t('reparseFailed')}: {modelError}</div>
      )}

      {slice.state !== 'error' && model === null && modelError === null && !metaMissing && (
        <div className="dsh-diagram-note">{statusText}</div>
      )}

      {open && details !== '' && <pre className="dsh-diagram-body">{details}</pre>}

      {inspect !== undefined && (
        <button type="button" className="dsh-diagram-inspect" onClick={inspect}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="6" cy="6" r="4.2" />
            <path d="M6 3.4 V6 L7.8 7.2" />
          </svg>
          {t('inspect')}
        </button>
      )}
    </div>
  )
}

/** 槽位注册选项：keyed 槽用 `key`，list 槽用 `id`；`order` / `locale` 两者通用。 */
interface SlotRegisterOptions {
  name: string
  key?: string
  id?: string
  order?: number
  locale?: string
}

/** 客户端上下文里我们用到的部分（最小结构，见文件头注释）。 */
interface ClientContextLike {
  get(name: string): unknown
  effect(fn: () => () => void, label: string): void
  /** 运行时依赖注入：依赖齐了才跑回调，服务消失时回调注册的东西一起释放。 */
  inject(services: string[], callback: (scoped: ClientContextLike) => void): void
  locale: {
    register(ns: string, dict: unknown): () => void
    bind(ns: string): (key: string) => string
  }
  slots: {
    inject(slot: string, register: (() => unknown) | Iterable<() => unknown>): void
    register(options: SlotRegisterOptions, component: unknown): unknown
  }
}

/** `uiConversation` 服务里我们用到的那一块。 */
interface UiConversationLike {
  events?: { register(definition: unknown): void }
}

/** 回合末尾预览的文案绑定。 */
function previewLabels(t: (key: keyof Dict) => string) {
  return {
    title: t('turnTitle'),
    download: t('download'),
    fitWidth: t('fitWidth'),
    fitAll: t('fitAll'),
    zoomIn: t('zoomIn'),
    zoomOut: t('zoomOut'),
    failed: t('failed'),
    detail: t('nodeDetail'),
    inEdges: t('inEdges'),
    outEdges: t('outEdges'),
    close: t('close'),
  }
}

/**
 * 注册「回合末尾再现」这条旁路。
 *
 * 槽位契约（`cordis_inspect_query` Client `Slots` 实测，DSH 0.1.7-rc.2）：
 * `conversation.chat.turnTail` 是 list 槽，注册项是 `{ name, id, order?, label? }` ——
 * 新 `id` 追加一个条目、无内容返回 `null` 即不占位。owner props 是
 * `{ turn: TurnLocation; seq: number; openFile }`。
 *
 * 用 `ctx.inject(['uiConversation'], …)` 而**不是**在 apply 里直接 `ctx.get`：
 * 后者取决于客户端模块的激活顺序（实测会跑在 ui-conversation 之前，拿不到服务）；
 * 而 `dsh.client.inject` 那份顺序清单是**宿主启动时**读取的，改它又要重启。
 * 运行时注入与顺序无关，服务出现才注册、消失就释放 —— 也是 practices 文档推荐的可选依赖写法。
 *
 * @param ctx - 客户端上下文。
 * @param t - 已绑定命名空间的翻译函数。
 */
function registerTurnPreview(ctx: ClientContextLike, t: (key: keyof Dict) => string): void {
  const labels = previewLabels(t)
  ctx.inject(['uiConversation'], (scoped) => {
    const uiConversation = scoped.get('uiConversation') as UiConversationLike | undefined
    if (uiConversation?.events === undefined) return
    try {
      uiConversation.events.register(diagramTurnDefinition)
    } catch (error: unknown) {
      // 重复注册（HMR / 同页多实例）不该打断插件加载。
      if (!(error instanceof Error) || !error.message.includes('already registered')) throw error
    }
    // 条目注册跟着这次注入的作用域走：服务重建时旧条目一并释放，不会越挂越多。
    scoped.slots.inject('conversation.chat.turnTail', () => scoped.slots.register(
      { name: 'conversation.chat.turnTail', id: TURN_PREVIEW_ID, order: 50, locale: NS },
      (owner: TurnOwnerProps) => <TurnPreview turn={owner.turn} labels={labels} />,
    ))
  })
}

/** 客户端插件体：注册文案字典、两个 keyed toolview、以及回合末尾预览。 */
export default {
  inject: ['slots', 'locale'],
  apply(ctx: ClientContextLike): void {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-diagram: dictionaries')
    const t = ctx.locale.bind(NS) as (key: keyof Dict) => string

    // 工厂保持无副作用；注册随 owner（tool.call.toolview 声明）折叠与恢复。
    // generator 形态与 ui-tool 自己的 toolview 一致：一次注入注册多个 key。
    ctx.slots.inject('tool.call.toolview', function* () {
      for (const key of TOOL_NAMES) {
        yield ctx.slots.register(
          { name: 'tool.call.toolview', key, locale: NS },
          (props: {
            callId?: string
            toolName?: string
            block: Parameters<typeof readSlice>[0]
            useDisclosure?: () => { expanded: boolean; toggle: () => void }
            inspect?: () => void
          }) => (
            <DiagramCard
              callId={props.callId}
              toolName={props.toolName}
              block={props.block}
              // 契约里 useDisclosure 是必备项；真缺了也不让卡片崩掉，退回本地展开态。
              useDisclosure={props.useDisclosure ?? useLocalDisclosure}
              inspect={props.inspect}
              t={t}
            />
          ),
        )
      }
    })

    registerTurnPreview(ctx, t)
  },
}
