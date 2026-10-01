/**
 * dsh-diagram · 客户端半（浏览器）。
 *
 * 命中 keyed slot `tool.call.toolview` 的 `render_architecture` 后，本视图**接管整行**
 * （通用工具行不再渲染），所以它自己也负责行头。
 *
 * 数据来源只有「原始调用参数 + 结果内容 + 失败状态」——与官方口径一致
 * （built-in Web Client 不消费宿主 presentCall/presentResult）。这意味着：
 * ① 零上下文开销：不靠宿主把坐标塞进 tool result；
 * ② replay / fork 之后照样能画：`yaml_spec` 就在调用参数里，现场重算即可。
 *
 * 管线（全在浏览器里跑，不含 Ajv —— 见 packages/schema/src/browser.ts）：
 *   parseYaml → normalizeSpec → layoutSpec → buildScene → <DiagramCanvas>
 * 下载按钮走同一个引擎的 `buildDrawio`，因此预览与导出的几何逐点一致。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildDrawio } from '@dsh-diagram/drawio'
import { layoutSpec, type LayoutResult } from '@dsh-diagram/layout'
import { normalizeSpec, parseYaml } from '@dsh-diagram/schema/browser'
import type { ArchSpec, NormalizedSpec } from '@dsh-diagram/schema/browser'
import { DiagramCanvas } from './diagram/DiagramCanvas'
import { buildScene, type DiagramScene } from './diagram/scene'

/** 客户端 locale 命名空间（与 ctx.locale.register 的第一个参数一致）。 */
const NS = 'dsh-diagram'

/** wire 工具名，也是本视图的 slot key。 */
const TOOL_NAME = 'render_architecture'

const zh = {
  title: '架构图',
  preparing: '正在读取参数…',
  running: '渲染中…',
  done: '已渲染',
  failed: '渲染失败',
  detail: '详情',
  hide: '收起',
  reparseFailed: '卡片无法重算布局（宿主已通过校验，这是预览侧的问题）',
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
  reparseFailed: 'The card could not re-derive the layout (the host validated it; this is a preview-side problem)',
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
  yamlSpec: string
  title: string
  result: string | null
  isError: boolean
  state: 'preparing' | 'running' | 'ok' | 'error'
}

interface DiagramModel {
  scene: DiagramScene
  spec: NormalizedSpec
  layout: LayoutResult
  title: string
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

/**
 * 形状守卫：`normalizeSpec` 假定结构已经通过校验，而浏览器半没有 Ajv 兜底，
 * 所以这里先把它变成一个「至少不会抛在 normalize 内部」的输入。
 */
function asArchSpec(value: unknown): ArchSpec {
  if (typeof value !== 'object' || value === null) throw new Error('YAML 顶层不是对象')
  const candidate = value as { nodes?: unknown; edges?: unknown }
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    throw new Error('缺少 nodes / edges 数组')
  }
  return value as ArchSpec
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
}

/** 状态点颜色：语义色走主题 token，不写死。 */
function stateColor(state: CallSlice['state']): string {
  if (state === 'error') return 'var(--dsw-alias-state-error-primary)'
  if (state === 'ok') return 'var(--dsw-alias-state-success-primary)'
  return 'var(--dsw-alias-state-idle-primary)'
}

/** 卡片主体。props 由 slot 运行时给出（ToolCallOwnerProps）。 */
function DiagramCard(props: { callId?: string; block: Parameters<typeof readSlice>[0]; t: (key: keyof Dict) => string }) {
  const { callId, block, t } = props
  const slice = readSlice(block)
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState<DiagramModel | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)

  const yamlSpec = slice.yamlSpec
  const title = slice.title

  // 从调用参数现场重算：start 阶段参数就已完整，所以「运行中」也能先出图。
  useEffect(() => {
    if (yamlSpec === '') {
      setModel(null)
      setModelError(null)
      return
    }
    let cancelled = false
    setModelError(null)
    void (async () => {
      try {
        const parsed = parseYaml(yamlSpec)
        if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message ?? 'YAML 解析失败')
        const spec = normalizeSpec(asArchSpec(parsed.value))
        const layout = await layoutSpec(spec)
        const scene = buildScene(layout, spec)
        if (!cancelled) setModel({ scene, spec, layout, title })
      } catch (error: unknown) {
        if (cancelled) return
        setModel(null)
        setModelError(error instanceof Error ? error.message : String(error))
      }
    })()
    return () => { cancelled = true }
  }, [yamlSpec, title])

  const onDownload = useCallback(() => {
    if (model === null) return
    try {
      const artifact = buildDrawio({
        title: model.title === '' ? 'diagram' : model.title,
        spec: model.spec,
        layout: model.layout,
      })
      const blob = new Blob([artifact.xml], { type: 'application/xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = artifact.fileName
      anchor.rel = 'noopener'
      anchor.click()
      // 立刻 revoke 在部分浏览器会打断下载，给一拍再回收。
      setTimeout(() => URL.revokeObjectURL(url), 1000)
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
  const summary = [counts, title].filter((part) => part !== '').join(' · ')
  const details = slice.result ?? slice.argsRaw ?? ''
  // 只要客户端能重算出布局就出图：`save_drawio` 被沙箱拒绝这类失败里图本身是好的，
  // 应该「出图 + 把错误摆在下面」，而不是整行只剩错误文本。
  const canRender = model !== null

  return (
    <div style={styles.row} data-dsh-diagram-card={TOOL_NAME}>
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

      {slice.state === 'error' && (
        <pre style={{ ...styles.body, color: 'var(--dsw-alias-state-error-primary)' }}>{slice.result ?? ''}</pre>
      )}

      {modelError !== null && (
        <div style={styles.note}>
          {t('reparseFailed')}: {modelError}
        </div>
      )}

      {slice.state !== 'error' && model === null && modelError === null && (
        <div style={styles.note}>{statusText}</div>
      )}

      {open && details !== '' && <pre style={styles.body}>{details}</pre>}
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
    const t = ctx.locale.bind(NS) as (key: keyof Dict) => string
    // 工厂保持无副作用；注册随 owner（tool.call.toolview 声明）折叠与恢复。
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      { name: 'tool.call.toolview', key: TOOL_NAME, locale: NS },
      (props: { callId?: string; block: Parameters<typeof readSlice>[0] }) => <DiagramCard {...props} t={t} />,
    ))
  },
}
