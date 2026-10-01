/**
 * 纯场景构建：`LayoutResult` → 与框架无关的 SVG 图元（矩形 / 折线 / 文本）。
 *
 * 为什么单独一层：把「几何 + 配色」与「React 渲染 + 交互」分开后，
 * 场景可以脱离浏览器断言（见 `scripts/audit-scene.ts`），而 SVG 组件只负责画。
 *
 * 配色口径：节点 / 分组复用 `@dsh-diagram/drawio` 的 `NODE_THEME` / `GROUP_THEME`，
 * 保证「对话内预览」与「导出的 .drawio」是同一套语义配色；画布底色与连线色
 * 属于预览侧的美术选择，定义在 {@link SVG_PALETTE}。
 *
 * 文本排版口径：与 `@dsh-diagram/layout` 的尺寸预估器用同一组 token 与同一个
 * 宽度估算函数，因此这里折出来的行数与布局算出的节点高度必然吻合（不会溢出卡片）。
 *
 * 节点还带上**语义字段与邻接关系**（T10 的详情面板要用）：几何渲染用不到它们，
 * 但把面板需要的数据一起算在场景里，组件就不必再回头去读 `LayoutResult`。
 */
import { GROUP_THEME, NODE_THEME } from '@dsh-diagram/drawio'
import {
  DESC_FONT_SIZE,
  DESC_LINE_HEIGHT,
  ITEM_FONT_SIZE,
  ITEM_LINE_HEIGHT,
  ITEM_SEPARATOR_HEIGHT,
  NODE_PADDING_VERTICAL,
  NODE_TEXT_MAX_WIDTH,
  TITLE_FONT_SIZE,
  TITLE_LINE_HEIGHT,
  estimateTextWidth,
} from '@dsh-diagram/layout'
import type { LayoutEdge, LayoutGroup, LayoutNode, LayoutResult } from '@dsh-diagram/layout'
import type { NodeVariant, NormalizedSpec } from '@dsh-diagram/schema/browser'

/** 预览侧美术配色（不属于 draw.io 单元格样式）。 */
export const SVG_PALETTE = {
  background: '#0f172a',
  edge: '#64748b',
  edgeActive: '#38bdf8',
  edgeLabel: '#cbd5e1',
  edgeLabelBg: '#152238',
  groupTitle: '#94a3b8',
  separator: '#334155',
} as const

/** 场景四周留白（内容坐标之外，viewBox 外扩量）。 */
export const SCENE_MARGIN = 16

export interface SceneRect {
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  /** SVG stroke-dasharray；缺省为实线 */
  dash?: string
  rx: number
}

export interface SceneText {
  x: number
  y: number
  text: string
  size: number
  fill: string
  anchor: 'start' | 'middle'
  weight?: number
  opacity?: number
}

export interface SceneLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface SceneGroup {
  id: string
  title: string
  rect: SceneRect
  titleText: SceneText
}

/** 一条与某节点相连的边（详情面板展示方向、对端与标签）。 */
export interface SceneNodeLink {
  readonly edgeId: string
  readonly direction: 'in' | 'out'
  /** 对端节点 id */
  readonly other: string
  readonly label?: string
}

export interface SceneNode {
  id: string
  title: string
  /** 一行说明（详情面板用；几何渲染用不到） */
  desc?: string
  /** RPC / 接口清单（详情面板用） */
  items: readonly string[]
  /** 语义配色档位（详情面板作为徽标显示） */
  variant: NodeVariant
  rect: SceneRect
  texts: SceneText[]
  separator?: SceneLine
  /** 入 / 出边，顺序沿用布局给出的边顺序 */
  links: readonly SceneNodeLink[]
}

export interface SceneEdge {
  id: string
  from: string
  to: string
  path: string
  /** 是否双向箭头（edge.style = bidirectional） */
  both: boolean
  dash?: string
  label?: { x: number; y: number; text: string; width: number; height: number }
}

export interface DiagramScene {
  /** 内容外扩 {@link SCENE_MARGIN} 后的 viewBox */
  viewBox: { x: number; y: number; width: number; height: number }
  background: string
  groups: SceneGroup[]
  nodes: SceneNode[]
  edges: SceneEdge[]
}

/**
 * 按估算宽度贪心折行。
 * @param text - 原文（支持显式换行）。
 * @param fontSize - 字号，参与宽度估算。
 * @param maxWidth - 单行像素上限。
 * @returns 折好的行数组；空串得到空数组。
 */
export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  if (text.length === 0) return []
  const lines: string[] = []
  for (const segment of text.split(/\r?\n/)) {
    if (segment.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const char of segment) {
      const candidate = line + char
      if (line.length > 0 && estimateTextWidth(candidate, fontSize) > maxWidth) {
        lines.push(line)
        line = char
      } else {
        line = candidate
      }
    }
    if (line.length > 0) lines.push(line)
  }
  return lines
}

/** 折线路径字符串。 */
function pathOf(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  const [head, ...rest] = points
  return `M ${head.x} ${head.y}` + rest.map((point) => ` L ${point.x} ${point.y}`).join('')
}

/** 按折线弧长取中点，用于放连线标签。 */
function midpointOf(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  let remaining = total / 2
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length >= remaining) {
      const t = length === 0 ? 0 : remaining / length
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    remaining -= length
  }
  return points[points.length - 1]
}

/** 文本基线：把「行带顶部」换算到一个看着居中的 baseline（0.72 行高）。 */
function baselineOf(lineTop: number, lineHeight: number): number {
  return lineTop + lineHeight * 0.72
}

/** 往邻接表里追加一条有向关系（无 label 时不写 `label` 键，保持 JSON 干净）。 */
function pushLink(
  table: Map<string, SceneNodeLink[]>,
  nodeId: string,
  link: SceneNodeLink,
): void {
  const list = table.get(nodeId)
  if (list === undefined) {
    table.set(nodeId, [link])
  } else {
    list.push(link)
  }
}

/**
 * 构建整张场景。
 * @param layout - 布局结果（`absX/absY` 为画布绝对坐标）。
 * @param spec - 规范形态（本函数只用它的 id 集合做引用完整性过滤）。
 * @returns 可直接交给 SVG/序列化层的图元集合。
 */
export function buildScene(layout: LayoutResult, spec: NormalizedSpec): DiagramScene {
  const knownNodes = new Set(spec.nodes.map((node) => node.id))

  // 邻接表：详情面板按节点列出「谁指向我 / 我指向谁」。
  const linksByNode = new Map<string, SceneNodeLink[]>()
  for (const edge of layout.edges) {
    if (!knownNodes.has(edge.from) || !knownNodes.has(edge.to)) continue
    const common = edge.label === undefined ? {} : { label: edge.label }
    pushLink(linksByNode, edge.from, { edgeId: edge.id, direction: 'out', other: edge.to, ...common })
    pushLink(linksByNode, edge.to, { edgeId: edge.id, direction: 'in', other: edge.from, ...common })
  }

  const groups: SceneGroup[] = layout.groups.map((group: LayoutGroup) => {
    const theme = GROUP_THEME[group.variant]
    return {
      id: group.id,
      title: group.title,
      rect: {
        x: group.absX,
        y: group.absY,
        width: group.width,
        height: group.height,
        fill: theme.fillColor === 'none' ? 'none' : theme.fillColor,
        stroke: theme.strokeColor,
        dash: theme.dashed === '1' ? '6 5' : undefined,
        rx: 8,
      },
      titleText: {
        x: group.absX + 10,
        y: group.absY + 17,
        text: group.title,
        size: 12,
        fill: SVG_PALETTE.groupTitle,
        anchor: 'start',
      },
    }
  })

  const nodes: SceneNode[] = layout.nodes.map((node: LayoutNode) => {
    const theme = NODE_THEME[node.variant]
    const texts: SceneText[] = []
    let cursor = node.absY + NODE_PADDING_VERTICAL / 2
    const centerX = node.absX + node.width / 2
    const leftX = node.absX + 10

    for (const line of wrapText(node.title, TITLE_FONT_SIZE, NODE_TEXT_MAX_WIDTH)) {
      texts.push({
        x: centerX,
        y: baselineOf(cursor, TITLE_LINE_HEIGHT),
        text: line,
        size: TITLE_FONT_SIZE,
        fill: theme.fontColor,
        anchor: 'middle',
        weight: 700,
      })
      cursor += TITLE_LINE_HEIGHT
    }

    if (node.desc !== undefined && node.desc !== '') {
      for (const line of wrapText(node.desc, DESC_FONT_SIZE, NODE_TEXT_MAX_WIDTH)) {
        texts.push({
          x: centerX,
          y: baselineOf(cursor, DESC_LINE_HEIGHT),
          text: line,
          size: DESC_FONT_SIZE,
          fill: theme.fontColor,
          anchor: 'middle',
          opacity: 0.78,
        })
        cursor += DESC_LINE_HEIGHT
      }
    }

    let separator: SceneLine | undefined
    if (node.items.length > 0) {
      const mid = cursor + ITEM_SEPARATOR_HEIGHT / 2
      separator = { x1: leftX, y1: mid, x2: node.absX + node.width - 10, y2: mid }
      cursor += ITEM_SEPARATOR_HEIGHT
      for (const item of node.items) {
        for (const line of wrapText(item, ITEM_FONT_SIZE, NODE_TEXT_MAX_WIDTH)) {
          texts.push({
            x: leftX,
            y: baselineOf(cursor, ITEM_LINE_HEIGHT),
            text: line,
            size: ITEM_FONT_SIZE,
            fill: theme.fontColor,
            anchor: 'start',
            opacity: 0.85,
          })
          cursor += ITEM_LINE_HEIGHT
        }
      }
    }

    return {
      id: node.id,
      title: node.title,
      desc: node.desc,
      items: node.items,
      variant: node.variant,
      rect: {
        x: node.absX,
        y: node.absY,
        width: node.width,
        height: node.height,
        fill: theme.fillColor,
        stroke: theme.strokeColor,
        rx: 8,
      },
      texts,
      separator,
      links: linksByNode.get(node.id) ?? [],
    }
  })

  const edges: SceneEdge[] = layout.edges
    // 渲染侧防御：布局不该产出悬空引用，真出现了也不画，避免整张卡片崩掉。
    .filter((edge: LayoutEdge) => knownNodes.has(edge.from) && knownNodes.has(edge.to) && edge.points.length > 1)
    .map((edge: LayoutEdge) => {
      const label = edge.label
      const mid = midpointOf(edge.points)
      const width = label === undefined ? 0 : Math.round(estimateTextWidth(label, 12)) + 12
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        path: pathOf(edge.points),
        both: edge.style === 'bidirectional',
        dash: edge.style === 'dashed' ? '8 4' : undefined,
        label: label === undefined
          ? undefined
          : { x: mid.x, y: mid.y + 4, text: label, width, height: 16 },
      }
    })

  return {
    viewBox: {
      x: -SCENE_MARGIN,
      y: -SCENE_MARGIN,
      width: Math.max(1, Math.ceil(layout.bounds.width) + SCENE_MARGIN * 2),
      height: Math.max(1, Math.ceil(layout.bounds.height) + SCENE_MARGIN * 2),
    },
    background: SVG_PALETTE.background,
    groups,
    nodes,
    edges,
  }
}
