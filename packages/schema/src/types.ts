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

/** 分组层级总数上限（含顶层），PRD §4.3 */
export const MAX_GROUP_LEVELS = 3;

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

/** YAML DSL 顶层结构（未填缺省值的原始形态） */
export interface ArchSpec {
  version?: string;
  meta?: MetaSpec;
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
  groups: NormalizedGroup[];
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];
}