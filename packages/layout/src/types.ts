import type { EdgeStyle, GroupVariant, MetaSpec, NodeVariant } from '@dsh-diagram/schema';

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutNode {
  id: string;
  title: string;
  desc?: string;
  variant: NodeVariant;
  items: string[];
  /** 所属分组 ID，缺省表示位于根画布 */
  groupId?: string;
  /** 相对所属分组框的坐标（无分组时为画布绝对坐标，与 draw.io 的 parent 语义一致） */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 画布绝对坐标（供内部几何运算与 SVG 渲染使用） */
  absX: number;
  absY: number;
}

export interface LayoutGroup {
  id: string;
  title: string;
  variant: GroupVariant;
  /** 上级分组 ID，缺省表示顶层 */
  parentId?: string;
  /** 层级，顶层为 0 */
  level: number;
  /** 相对上级分组的坐标（顶层分组为画布绝对坐标） */
  x: number;
  y: number;
  width: number;
  height: number;
  absX: number;
  absY: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style: EdgeStyle;
  /** 正交折线路径点，画布绝对坐标（首尾为端点锚点） */
  points: LayoutPoint[];
}

export interface LayoutBounds {
  width: number;
  height: number;
}

export interface LayoutResult {
  meta: MetaSpec;
  nodes: LayoutNode[];
  groups: LayoutGroup[];
  edges: LayoutEdge[];
  /** 内容边界盒（已含走线通道占用的空间，不含画布外边距） */
  bounds: LayoutBounds;
  /** 实际生效的每行最大条目数（max_columns=auto 时由引擎算出） */
  maxColumns: number;
}