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
  detail: '详情',
  hide: '收起',
  saved: '已落盘到',
  reparseFailed: '卡片无法重算布局（宿主已通过校验，这是预览侧的问题）',
  metaMissing: '卡片读不到 YAML：文件级工具的 meta 没送达（经 run_code 嵌套调用时会这样）。请展开「详情」查看宿主返回的摘要与落盘路径。',
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
  detail: 'Details',
  hide: 'Hide',
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

  // 文件级工具的参数里只有 path —— YAML 只能从 meta 走（见 packages/schema/src/browser.ts 与宿主 files.ts）。
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

const styles = {
  row: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '10px 12px',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '10px',
    background: 'var(--dsw-alias-bg-layer-1)',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--dsw-alias-label-primary)',
  },
  dot: { width: '8px', height: '8px', borderRadius: '50%', flex: '0 0 auto' },
  name: { fontWeight: 600, flex: '0 0 auto' },
  summary: {
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: 'var(--dsw-alias-label-secondary)',
    fontSize: '12px',
  },
  status: { flex: '0 0 auto', fontSize: '12px' },
  toggle: {
    flex: '0 0 auto',
    border: 'none',
    background: 'transparent',
    color: 'var(--dsw-alias-label-secondary)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 4px',
  },
  body: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '12px',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    color: 'var(--dsw-alias-label-secondary)',
    background: 'var(--dsw-alias-bg-layer-2)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '8px',
    padding: '8px 10px',
    margin: 0,
    maxHeight: '260px',
    overflow: 'auto',
  },
  note: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' },
  saved: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '11px',
    color: 'var(--dsw-alias-label-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
}

/** 状态点颜色：语义色走主题 token，不写死。 */
function stateColor(state: CallSlice['state']): string {
  if (state === 'error') return 'var(--dsw-alias-state-error-primary)'
  if (state === 'ok') return 'var(--dsw-alias-state-success-primary)'
  return 'var(--dsw-alias-state-idle-primary)'
}

/** 卡片主体。props 由 slot 运行时给出（ToolCallOwnerProps）。 */
function DiagramCard(props: {
  callId?: string
  toolName?: string
  block: Parameters<typeof readSlice>[0]
  t: (key: keyof Dict) => string
}) {
  const { callId, block, t } = props
  const slice = readSlice(block)
  const [open, setOpen] = useState(false)
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
  }), [t])

  const statusText = slice.state === 'preparing'
    ? t('preparing')
    : slice.state === 'running' ? t('running') : slice.state === 'error' ? t('failed') : t('done')
  const counts = model === null
    ? ''
    : `${model.layout.nodes.length} ${t('unit')} · ${model.layout.edges.length} ${t('link')}`
  const summary = [counts, slice.title !== '' ? slice.title : model?.title ?? ''].filter((part) => part !== '').join(' · ')
  const details = slice.result ?? slice.argsRaw ?? ''
  // 只要客户端能重算出布局就出图：`save_drawio` 被沙箱拒绝这类失败里图本身是好的，
  // 应该「出图 + 把错误摆在下面」，而不是整行只剩错误文本。
  const canRender = model !== null
  const metaMissing = slice.state !== 'preparing' && slice.state !== 'error' && slice.yamlSpec === ''

  return (
    <div style={styles.row} data-dsh-diagram-card={props.toolName ?? 'render_architecture'}>
      <div style={styles.head}>
        <span style={{ ...styles.dot, background: stateColor(slice.state) }} aria-hidden />
        <span style={styles.name}>{t('title')}</span>
        <span style={styles.summary}>{summary === '' ? statusText : summary}</span>
        <span style={{ ...styles.status, color: stateColor(slice.state) }}>{statusText}</span>
        {details !== '' && (
          <button type="button" style={styles.toggle} onClick={() => setOpen((value) => !value)}>
            {open ? t('hide') : t('detail')}
          </button>
        )}
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
        <div style={styles.saved} title={slice.savedPath}>{t('saved')} {slice.savedPath}</div>
      )}

      {slice.state === 'error' && (
        <pre style={{ ...styles.body, color: 'var(--dsw-alias-state-error-primary)' }}>{slice.result ?? ''}</pre>
      )}

      {metaMissing && <div style={styles.note}>{t('metaMissing')}</div>}

      {modelError !== null && (
        <div style={styles.note}>
          {t('reparseFailed')}: {modelError}
        </div>
      )}

      {slice.state !== 'error' && model === null && modelError === null && !metaMissing && (
        <div style={styles.note}>{statusText}</div>
      )}

      {open && details !== '' && <pre style={styles.body}>{details}</pre>}
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
 * 注：`dsh-univer-office` 为更老的 DSH 保留了 `select` 形态的降级分支；本机槽位目录里
 * list 槽要的是 `id`，没有 `select`，所以这里不写那条分支（写了也是死代码）。
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
          (props: { callId?: string; toolName?: string; block: Parameters<typeof readSlice>[0] }) =>
            <DiagramCard {...props} t={t} />,
        )
      }
    })

    registerTurnPreview(ctx, t)
  },
}
