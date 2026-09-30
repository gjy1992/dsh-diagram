/**
 * dsh-diagram DSL 类型定义（对应 PRD §4.1.1）
 */

/** 节点语义风格 */
export type NodeVariant = 'default' | 'primary' | 'danger' | 'warning' | 'muted';

/** 分组容器风格 */
export type GroupVariant = 'dashed' | 'filled';

/** 连线风格 */
export type EdgeStyle = 'solid' | 'dashed' | 'bidirectional';

export const NODE_VARIANTS: readonly NodeVariant[] = [
  'default',
  'primary',
  'danger',
  'warning',
  'muted',
];

export const GROUP_VARIANTS: readonly GroupVariant[] = ['dashed', 'filled'];

export const EDGE_STYLES: readonly EdgeStyle[] = ['solid', 'dashed', 'bidirectional'];

/** 布局方向：TB = 自上而下（默认），LR = 从左往右 */
export type LayoutDirection = 'TB' | 'LR';

export const LAYOUT_DIRECTIONS: readonly LayoutDirection[] = ['TB', 'LR'];

/**
 * 嵌套分组内部的方向：
 * - `auto`（缺省）：每深一层在 TB ↔ LR 之间自动交替，保证相邻两层的主轴总是正交；
 * - `TB` / `LR`：把深度 ≥ 1 的全部钉死成该方向。
 */
export type InnerDirection = LayoutDirection | 'auto';

export const INNER_DIRECTIONS: readonly InnerDirection[] = ['auto', 'TB', 'LR'];

/** 分组层级总数上限（含顶层），PRD §4.3 */
export const MAX_GROUP_LEVELS = 3;

/** layout.max_columns 的合法区间（PRD §4.1.3） */
export const MIN_MAX_COLUMNS = 1;
export const MAX_MAX_COLUMNS = 8;

/** 全局信息面板 */
export interface MetaSpec {
  title?: string;
  desc?: string;
  summary?: string;
  guide?: string;
}

/** 分组容器原始声明。嵌套通过 parent 单向声明，不使用 children 数组 */
export interface GroupSpec {
  id: string;
  title: string;
  variant?: GroupVariant;
  parent?: string;
}

/** 卡片节点原始声明 */
export interface NodeSpec {
  id: string;
  title: string;
  group?: string;
  desc?: string;
  variant?: NodeVariant;
  items?: string[];
}

/** 连线原始声明 */
export interface EdgeSpec {
  from: string;
  to: string;
  label?: string;
  style?: EdgeStyle;
}

/** 全局布局偏好 */
export interface LayoutSpec {
  /** 无连线单元铺网格时每行最多容纳几个条目；'auto' 由引擎取近似正方形 */
  max_columns?: number | 'auto';
  /** 根画布（第 0 层：分组之间 / 游离节点）的方向，缺省 TB */
  direction?: LayoutDirection;
  /** 嵌套分组内部的方向，缺省 auto（逐层交替） */
  inner_direction?: InnerDirection;
}

/** YAML DSL 顶层结构（未填缺省值的原始形态） */
export interface ArchSpec {
  version?: string;
  meta?: MetaSpec;
  layout?: LayoutSpec;
  groups?: GroupSpec[];
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

/** 填完缺省值后的规范形态，供布局与导出消费 */
export interface NormalizedGroup {
  id: string;
  title: string;
  variant: GroupVariant;
  parent?: string;
}

export interface NormalizedNode {
  id: string;
  title: string;
  group?: string;
  desc?: string;
  variant: NodeVariant;
  items: string[];
}

export interface NormalizedEdge {
  from: string;
  to: string;
  label?: string;
  style: EdgeStyle;
}

export interface NormalizedSpec {
  version: string;
  meta: MetaSpec;
  layout: { maxColumns: number | 'auto'; direction: LayoutDirection; innerDirection: InnerDirection };
  groups: NormalizedGroup[];
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];
}