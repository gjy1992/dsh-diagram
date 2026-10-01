/**
 * 架构图画布：把 {@link DiagramScene} 画成可缩放 / 可拖动 / 悬停高亮入出边的深色 SVG。
 *
 * 交互与坐标口径：
 * - `<svg>` 的 viewBox 就是「容器像素」，1 单位 = 1px，因此屏幕坐标 ↔ 内容坐标的换算
 *   只需 `(p - view) / k`，没有第三层缩放要追。
 * - 初始视图按**适应宽度**（不放大超过 1:1），过高时容器截断并允许纵向拖动；
 *   「整图」按钮才缩到全部可见。用户一旦手动缩放/拖动，就不再被 resize 覆盖。
 * - 悬停节点时，与它相连的边高亮（`edgeActive`），其余边淡出；这是 PRD §4.4.1 的
 *   「悬浮在节点上高亮其直接相连的入边和出边」。
 *
 * 颜色只用语义 token 的**美术色**（见 scene.ts 的调色口径）：这张画布是「作品」，
 * 自带深色主题，不跟随宿主明暗主题；卡片外壳才走 `--dsw-alias-*`。
 */
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { SVG_PALETTE, type DiagramScene } from './scene'

/** 视图变换：内容坐标 → 容器像素。 */
interface View {
  k: number
  x: number
  y: number
}

export interface DiagramCanvasLabels {
  fitWidth: string
  fitAll: string
  zoomIn: string
  zoomOut: string
  download: string
}

export interface DiagramCanvasProps {
  scene: DiagramScene
  /** 下载按钮的 tooltip 文案（文件名由调用方决定） */
  fileName?: string
  onDownload: () => void
  labels: DiagramCanvasLabels
  /** SVG marker 的 DOM id 前缀：同一页面可能有多张卡片，id 必须唯一 */
  idPrefix: string
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const MIN_VIEWPORT_HEIGHT = 160
const MAX_VIEWPORT_HEIGHT = 440

const FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'

const styles = {
  shell: {
    position: 'relative' as const,
    borderRadius: '10px',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: SVG_PALETTE.background,
    overflow: 'hidden',
  },
  canvas: {
    display: 'block',
    width: '100%',
    cursor: 'grab',
    touchAction: 'none' as const,
  },
  toolbar: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.82)',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '3px',
  },
  button: {
    border: '1px solid transparent',
    background: 'transparent',
    color: SVG_PALETTE.edgeLabel,
    fontSize: '12px',
    lineHeight: 1.4,
    padding: '2px 7px',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  hint: {
    position: 'absolute' as const,
    left: '8px',
    bottom: '6px',
    fontSize: '11px',
    color: 'var(--dsw-alias-label-secondary)',
    opacity: 0.75,
    pointerEvents: 'none' as const,
  },
}

/** 把缩放比例夹在可用区间内。 */
function clampZoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
}

/**
 * 深色架构图画布。
 * @param props - 场景、下载回调、文案与 marker id 前缀。
 * @returns 带工具条的 SVG 画布。
 */
export function DiagramCanvas({ scene, fileName, onDownload, labels, idPrefix }: DiagramCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [hostWidth, setHostWidth] = useState(0)
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 })
  const [hovered, setHovered] = useState<string | null>(null)
  const userAdjusted = useRef(false)
  const dragging = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)

  const contentW = Math.max(1, scene.viewBox.width)
  const contentH = Math.max(1, scene.viewBox.height)
  const vx = scene.viewBox.x
  const vy = scene.viewBox.y
  const fitWidthScale = hostWidth > 0 ? Math.min(1, hostWidth / contentW) : 1
  const viewportHeight = Math.max(
    MIN_VIEWPORT_HEIGHT,
    Math.min(MAX_VIEWPORT_HEIGHT, Math.round(contentH * fitWidthScale)),
  )

  // 量容器宽度：卡片宽度随对话列变化，量不到就先按 1:1 渲染，量到后自动落位。
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const measure = (): void => setHostWidth(host.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  // 首次/换图时按适应宽度落位；用户动过之后不再自动覆盖。
  useEffect(() => {
    userAdjusted.current = false
  }, [scene])

  useEffect(() => {
    if (hostWidth <= 0 || userAdjusted.current) return
    setView(fitWidth())
    // fitWidth 依赖的都是本次渲染的即时值，这里只关心宽度/场景变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostWidth, scene, viewportHeight])

  /** 适应宽度：铺满容器宽度，不放大超过 1:1，顶部对齐。 */
  function fitWidth(): View {
    const k = hostWidth > 0 ? Math.min(1, hostWidth / contentW) : 1
    return { k, x: (hostWidth - contentW * k) / 2 - k * vx, y: -k * vy }
  }

  /** 整图：连高度一起塞进可视区。 */
  function fitAll(): View {
    const k = clampZoom(Math.min(hostWidth / contentW, viewportHeight / contentH, 1))
    return {
      k,
      x: (hostWidth - contentW * k) / 2 - k * vx,
      y: (viewportHeight - contentH * k) / 2 - k * vy,
    }
  }

  /** 以某个容器像素点为锚点缩放。 */
  function zoomAt(pointX: number, pointY: number, factor: number): void {
    setView((current) => {
      const k = clampZoom(current.k * factor)
      if (k === current.k) return current
      const cx = (pointX - current.x) / current.k
      const cy = (pointY - current.y) / current.k
      return { k, x: pointX - cx * k, y: pointY - cy * k }
    })
  }

  /** 滚轮缩放：必须自己 preventDefault，否则会顺手把对话滚走。 */
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const onWheel = (event: WheelEvent): void => {
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      event.preventDefault()
      userAdjusted.current = true
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, Math.exp(-event.deltaY * 0.0015))
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    dragging.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragging.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    userAdjusted.current = true
    setView((current) => ({
      ...current,
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    }))
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragging.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    dragging.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  /** 双击 = 整图（与图片查看器一致的肌肉记忆）。 */
  function onDoubleClick(event: ReactMouseEvent<HTMLDivElement>): void {
    void event
    userAdjusted.current = true
    setView(fitAll())
  }

  const hoverActive = hovered !== null
  const arrowEnd = `${idPrefix}-arrow-end`
  const arrowStart = `${idPrefix}-arrow-start`

  return (
    <div ref={hostRef} style={styles.shell}>
      <div
        style={{ ...styles.canvas, height: `${viewportHeight}px`, cursor: dragging.current === null ? 'grab' : 'grabbing' }}
        role="img"
        aria-label={scene.groups.map((group) => group.title).join(' / ')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <svg
          width={hostWidth > 0 ? hostWidth : '100%'}
          height={viewportHeight}
          viewBox={`0 0 ${hostWidth > 0 ? hostWidth : 800} ${viewportHeight}`}
          style={{ display: 'block', userSelect: 'none' }}
        >
          <defs>
            <marker id={arrowEnd} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={SVG_PALETTE.edge} />
            </marker>
            <marker id={arrowStart} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={SVG_PALETTE.edge} />
            </marker>
            <marker id={`${arrowEnd}-active`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={SVG_PALETTE.edgeActive} />
            </marker>
            <marker id={`${arrowStart}-active`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={SVG_PALETTE.edgeActive} />
            </marker>
          </defs>
          <rect x={-4000} y={-4000} width={8000} height={8000} fill={scene.background} />
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`} fontFamily={FONT_STACK}>
            {scene.groups.map((group) => (
              <g key={group.id}>
                <rect
                  x={group.rect.x}
                  y={group.rect.y}
                  width={group.rect.width}
                  height={group.rect.height}
                  rx={group.rect.rx}
                  fill={group.rect.fill}
                  stroke={group.rect.stroke}
                  strokeWidth={1}
                  strokeDasharray={group.rect.dash}
                />
                <text
                  x={group.titleText.x}
                  y={group.titleText.y}
                  fontSize={group.titleText.size}
                  fill={group.titleText.fill}
                  textAnchor={group.titleText.anchor}
                >
                  {group.titleText.text}
                </text>
              </g>
            ))}

            {scene.edges.map((edge) => {
              const active = hoverActive && (edge.from === hovered || edge.to === hovered)
              const dimmed = hoverActive && !active
              const stroke = active ? SVG_PALETTE.edgeActive : SVG_PALETTE.edge
              return (
                <g key={edge.id} opacity={dimmed ? 0.22 : 1}>
                  <path
                    d={edge.path}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={active ? 2.4 : 1.4}
                    strokeDasharray={edge.dash}
                    markerEnd={`url(#${active ? `${arrowEnd}-active` : arrowEnd})`}
                    markerStart={edge.both ? `url(#${active ? `${arrowStart}-active` : arrowStart})` : undefined}
                  />
                  {edge.label !== undefined && (
                    <>
                      <rect
                        x={edge.label.x - edge.label.width / 2}
                        y={edge.label.y - edge.label.height / 2 - 3}
                        width={edge.label.width}
                        height={edge.label.height}
                        rx={4}
                        fill={SVG_PALETTE.edgeLabelBg}
                      />
                      <text
                        x={edge.label.x}
                        y={edge.label.y + 1}
                        fontSize={11}
                        fill={active ? SVG_PALETTE.edgeActive : SVG_PALETTE.edgeLabel}
                        textAnchor="middle"
                      >
                        {edge.label.text}
                      </text>
                    </>
                  )}
                </g>
              )
            })}

            {scene.nodes.map((node) => {
              const isHovered = node.id === hovered
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered((current) => (current === node.id ? null : current))}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={node.rect.x}
                    y={node.rect.y}
                    width={node.rect.width}
                    height={node.rect.height}
                    rx={node.rect.rx}
                    fill={node.rect.fill}
                    stroke={isHovered ? SVG_PALETTE.edgeActive : node.rect.stroke}
                    strokeWidth={isHovered ? 2 : 1}
                  />
                  {node.separator !== undefined && (
                    <line
                      x1={node.separator.x1}
                      y1={node.separator.y1}
                      x2={node.separator.x2}
                      y2={node.separator.y2}
                      stroke={SVG_PALETTE.separator}
                      strokeWidth={1}
                    />
                  )}
                  {node.texts.map((text, index) => (
                    <text
                      key={`${node.id}-t${index}`}
                      x={text.x}
                      y={text.y}
                      fontSize={text.size}
                      fill={text.fill}
                      textAnchor={text.anchor}
                      fontWeight={text.weight}
                      opacity={text.opacity}
                      pointerEvents="none"
                    >
                      {text.text}
                    </text>
                  ))}
                </g>
              )
            })}
          </g>
        </svg>
      </div>
      <div style={styles.toolbar}>
        <button type="button" style={styles.button} title={labels.zoomOut} onClick={() => { userAdjusted.current = true; zoomAt(hostWidth / 2, viewportHeight / 2, 1 / 1.25) }}>−</button>
        <button type="button" style={styles.button} title={labels.zoomIn} onClick={() => { userAdjusted.current = true; zoomAt(hostWidth / 2, viewportHeight / 2, 1.25) }}>+</button>
        <button type="button" style={styles.button} onClick={() => { userAdjusted.current = true; setView(fitWidth()) }}>{labels.fitWidth}</button>
        <button type="button" style={styles.button} onClick={() => { userAdjusted.current = true; setView(fitAll()) }}>{labels.fitAll}</button>
        <button type="button" style={styles.button} title={fileName} onClick={onDownload}>{labels.download}</button>
      </div>
      <div style={styles.hint}>滚轮缩放 · 拖动平移 · 悬停节点高亮连线</div>
    </div>
  )
}
