/**
 * 尺寸、间距与走线 token（PRD §4.1.2 + §4.1.3）
 * 全部集中在此，禁止在别处硬编码魔法数字。
 *
 * 间距分「虚拟双轴」两类（见 design.md §2）：
 * - `RANK_GAP`：Rank（拓扑层级）方向上的层间距；
 * - `CROSS_GAP`：Order（层内引力）方向上的同层条目间距。
 * TB / LR 只决定这两个轴映射到物理 X/Y 的哪一边，数值本身与方向无关。
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

// ── 布局单元（分组）───────────────────────────────────────────────

/** 单元内边距：非标题方向的两侧 */
export const UNIT_PADDING_X = 20;
/** 单元内边距：非标题方向的收尾侧 */
export const UNIT_PADDING_BOTTOM = 20;
/** 单元内边距：留给组标题的一侧（画法上恒定在物理上方） */
export const UNIT_HEADER_HEIGHT = 36;

// ── 虚拟双轴间距 ─────────────────────────────────────────────────

/** 相邻层（Rank）之间的间距 */
export const RANK_GAP = 48;
/** 同一层内相邻条目（含肋骨簇内部）之间的间距 */
export const CROSS_GAP = 40;
/** 根画布上相邻「带」（顶层分组）之间的间距，兼作跨带走线通道 */
export const UNIT_GAP = 56;

/** 无连线单元铺网格时的目标宽度 */
export const CANVAS_TARGET_WIDTH = 1600;

// ── 肋骨折叠 ─────────────────────────────────────────────────────

/** 单条行内肋骨链的最大长度（守卫 4） */
export const MAX_RIB_LENGTH = 4;

// ── 走线 ─────────────────────────────────────────────────────────

/** 同一通道内相邻车道的偏移步长 */
export const LANE_STEP = 8;
/** 层间走廊内最多分几条车道 */
export const LANE_LIMIT = 12;
/** 判定「相邻层正向边」的最大层间距；超过即走跨层绕行通道 */
export const MAX_LANE_GAP = 200;
/** 跨多层绕行时，安全栏杆（通道）与内容边缘的距离 */
export const OUTER_CHANNEL_GAP = 24;
/** 反向边顶部栏杆预留高度（栏杆中心距内容顶部） */
export const TOP_RAIL_HEIGHT = 28;
/** 碰撞检测时给节点矩形留的安全边距 */
export const COLLISION_PADDING = 4;

/** 画布外边距（画布尺寸自适应时外扩） */
export const CANVAS_MARGIN = 40;