/**
 * 尺寸与字号 token（PRD §4.1.2 + 计划 §7.2）
 * 全部集中在此，禁止在别处硬编码魔法数字。
 */

/** 节点宽度固定值 */
export const NODE_WIDTH = 240;

/** 节点上下内边距合计 */
export const NODE_PADDING_VERTICAL = 20;

/** 节点文本可用宽度（左右各留 10px） */
export const NODE_TEXT_MAX_WIDTH = NODE_WIDTH - 20;

export const TITLE_FONT_SIZE = 14;
/** 行高按 draw.io HTML 标签的实际渲染行距取值，比字号留出更多余量 */
export const TITLE_LINE_HEIGHT = 24;

export const DESC_FONT_SIZE = 12;
export const DESC_LINE_HEIGHT = 20;

export const ITEM_FONT_SIZE = 12;
export const ITEM_LINE_HEIGHT = 22;

/** items 区块前的 <hr> 分隔线及其上下间距 */
export const ITEM_SEPARATOR_HEIGHT = 14;

/** 节点最小高度（无 desc、无 items 时的取值） */
export const MIN_NODE_HEIGHT = 48;

/** 分组容器内边距 */
export const GROUP_PADDING = 24;

/** 分组顶部为组标题预留的高度 */
export const GROUP_HEADER_HEIGHT = 36;

/** 分组最小尺寸约束 */
export const GROUP_MIN_WIDTH = 160;
export const GROUP_MIN_HEIGHT = 90;

/** 同级元素间距（含同级分组） */
export const SPACING_NODE_NODE = 32;

/** 跨层节点间距 */
export const SPACING_NODE_BETWEEN_LAYERS = 48;

/** 连线与节点、连线与连线之间的间距 */
export const SPACING_EDGE_NODE = 16;
export const SPACING_EDGE_EDGE = 12;

/** 画布外边距，用于画布尺寸自适应 */
export const CANVAS_MARGIN = 40;

/** ELK 图根节点使用的保留 ID */
export const ELK_ROOT_ID = '__dsh_diagram_root__';