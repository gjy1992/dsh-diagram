import type { EdgeStyle, GroupVariant, MetaSpec, NodeVariant } from '@dsh-diagram/schema';

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutNode {
  id: string;
  title: string;
  desc?: string;
  variant: NodeVariant;
  items: string[];
  /** 所属分组 ID，缺省表示位于根画布 */
  groupId?: string;
  /** 相对父容器的坐标（与 ELK / draw.io 嵌套容器一致） */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 画布绝对坐标（供 SVG 渲染与几何断言使用） */
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
  /** 正交折线路径点，画布绝对坐标 */
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
  /** 内容边界盒（不含画布外边距） */
  bounds: LayoutBounds;
}