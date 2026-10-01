/**
 * dsh-diagram · 客户端半（浏览器）。
 *
 * 命中 keyed slot `tool.call.toolview` 的 `render_architecture` 后，本视图**接管整行**
 * （通用工具行不再渲染），所以它自己也负责行头。
 *
 * 数据来源：只读「原始调用参数 + 结果内容 + 失败状态」，与官方口径一致
 * （built-in Web Client 不消费宿主 presentCall/presentResult）。
 *
 * S1（当前）：行头 + 状态 + 统计/诊断文本 —— 用于验证
 *            「bundle → 浏览器模块表 → slot 注册」整条链路。
 * S2：接入 SVG 预览（pan/zoom + hover 高亮）与「下载 .drawio」。
 */
import { useState } from 'react'

/** 客户端 locale 命名空间（与 ctx.locale.register 的第一个参数一致）。 */
const NS = 'dsh-diagram'

/** wire 工具名，也是本视图的 slot key。 */
const TOOL_NAME = 'render_architecture'

/** 卡片文案（走 Client locale 服务，不硬编码在组件里）。 */
const zh = {
  title: '架构图',
  preparing: '正在读取参数…',
  running: '正在渲染…',
  done: '已渲染',
  failed: '渲染失败',
  placeholder: 'SVG 预览与「下载 .drawio」将在 S2 接入，当前是占位卡片。',
  detail: '详情',
}

const en = {
  title: 'Architecture diagram',
  preparing: 'Reading arguments…',
  running: 'Rendering…',
  done: 'Rendered',
  failed: 'Render failed',
  placeholder: 'SVG preview and .drawio download land in S2; this is the placeholder card.',
  detail: 'Details',
}

/** 一次调用的冻结切片，全部由 block 派生（replay 稳定，不依赖宿主状态）。 */
interface CallSlice {
  /** 已派发的原始参数 JSON；准备阶段为 null（此时还没有参数）。 */
  argsRaw: string | null
  /** 参数里的 yaml_spec（S2 用它现场重算布局）。 */
  yamlSpec: string
  /** 参数里的 title。 */
  title: string
  /** 结算后的结果文本；未结算为 null。 */
  result: string | null
  isError: boolean
  state: 'preparing' | 'running' | 'ok' | 'error'
}

/** 内容块拍平成展示文本（与 ui-tool 的 resultText 同口径）。 */
function flatten(content: readonly { type?: string; text?: string }[]): string {
  return content
    .map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : JSON.stringify(block)))
    .join('\n')
}

/**
 * 从 slot 给出的阶段 block 派生展示切片。
 * @param block - preparing / start / result 三种阶段块之一。
 * @returns 冻结的展示切片。
 */
function readSlice(block: {
  callId: string
  phase?: 'preparing' | 'start'
  argsRaw?: string
  kind?: string
  call?: { argsRaw?: string } | null
  content?: readonly { type?: string; text?: string }[]
  isError?: boolean
}): CallSlice {
  const settled = typeof block.kind === 'string'
  const argsRaw = settled
    ? block.call?.argsRaw ?? ''
    : block.phase === 'start' ? block.argsRaw ?? '' : null

  let title = ''
  let yamlSpec = ''
  if (argsRaw !== null && argsRaw !== '') {
    try {
      const parsed = JSON.parse(argsRaw) as { title?: unknown; yaml_spec?: unknown }
      if (typeof parsed.title === 'string') title = parsed.title
      if (typeof parsed.yaml_spec === 'string') yamlSpec = parsed.yaml_spec
    } catch {
      // 流式参数被截断（半截 JSON）：忽略，等下一个阶段。
    }
  }

  const result = settled ? flatten(block.content ?? []) : null
  const isError = settled ? block.isError === true : false
  const state: CallSlice['state'] = !settled
    ? block.phase === 'preparing' ? 'preparing' : 'running'
    : isError ? 'error' : 'ok'
  return { argsRaw, yamlSpec, title, result, isError, state }
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
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flex: '0 0 auto',
  },
  name: { fontWeight: 600 },
  summary: {
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: 'var(--dsw-alias-label-secondary)',
    fontSize: '12px',
  },
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
  note: {
    fontSize: '12px',
    color: 'var(--dsw-alias-label-secondary)',
  },
}

/** 状态点颜色：语义色走主题 token，不写死。 */
function stateColor(state: CallSlice['state']): string {
  if (state === 'error') return 'var(--dsw-alias-state-error-primary)'
  if (state === 'ok') return 'var(--dsw-alias-state-success-primary)'
  return 'var(--dsw-alias-state-idle-primary)'
}

/** 卡片主体。props 由 slot 运行时给出（ToolCallOwnerProps）。 */
function DiagramCard(props: { block: Parameters<typeof readSlice>[0]; t: (key: keyof typeof zh) => string }) {
  const { block, t } = props
  const slice = readSlice(block)
  const [open, setOpen] = useState(false)
  const statusText = slice.state === 'preparing'
    ? t('preparing')
    : slice.state === 'running' ? t('running') : slice.state === 'error' ? t('failed') : t('done')
  const summary = slice.title !== '' ? slice.title : statusText
  const body = slice.result ?? slice.argsRaw ?? ''

  return (
    <div style={styles.row} data-dsh-diagram-card={TOOL_NAME}>
      <div style={styles.head}>
        <span style={{ ...styles.dot, background: stateColor(slice.state) }} aria-hidden />
        <span style={styles.name}>{t('title')}</span>
        <span style={styles.summary}>{summary}</span>
        <span style={{ color: stateColor(slice.state), fontSize: '12px' }}>{statusText}</span>
        {body !== '' && (
          <button type="button" style={styles.toggle} onClick={() => setOpen((v) => !v)}>
            {t('detail')}
          </button>
        )}
      </div>
      {slice.state === 'ok' && <div style={styles.note}>{t('placeholder')}</div>}
      {open && body !== '' && <pre style={styles.body}>{body}</pre>}
    </div>
  )
}

/** 客户端插件体：注册文案字典与 keyed toolview。 */
export default {
  inject: ['slots', 'locale'],
  apply(ctx: {
    effect: (fn: () => () => void, label: string) => void
    locale: { register: (ns: string, dict: unknown) => () => void; bind: (ns: string) => (key: string) => string }
    slots: {
      inject: (slot: string, register: () => unknown) => void
      register: (options: { name: string; key: string; locale?: string }, component: unknown) => unknown
    }
  }): void {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-diagram: dictionaries')
    const t = ctx.locale.bind(NS) as (key: keyof typeof zh) => string
    // 工厂保持无副作用；注册随 owner（tool.call.toolview 声明）折叠与恢复。
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      { name: 'tool.call.toolview', key: TOOL_NAME, locale: NS },
      (props: { block: Parameters<typeof readSlice>[0] }) => <DiagramCard {...props} t={t} />,
    ))
  },
}
