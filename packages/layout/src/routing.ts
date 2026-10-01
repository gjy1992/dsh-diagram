import type { LayoutDirection, NormalizedSpec } from '@dsh-diagram/schema';
import { ROOT_UNIT_KEY } from './layering';
import type { NodeMeta, OpenSides, Placement } from './placement';
import {
  COLLISION_PADDING,
  LANE_CLEARANCE,
  LANE_LIMIT,
  LANE_STEP,
  MAX_LANE_GAP,
  OUTER_CHANNEL_GAP,
  TOP_RAIL_HEIGHT,
} from './tokens';
import type { LayoutEdge, LayoutPoint, Rect } from './types';

type Side = 'left' | 'right' | 'top' | 'bottom';
type SegmentAxis = 'h' | 'v';

interface Segment {
  axis: SegmentAxis;
  /** 水平段的 y / 垂直段的 x */
  coord: number;
  lo: number;
  hi: number;
}

interface RouteContext {
  rects: Map<string, Rect>;
  skipped: Set<string>;
  topRailY: number;
  outerLeftX: number;
  outerRightX: number;
  /** 已占用的线段（统一存物理口径），用于避免连线互相重叠 */
  placed: Segment[];
  /** 当前边走线框架是否与物理口径互为转置；是则比较已放置线段时需翻转轴标签 */
  flipPlaced: boolean;
  /** 额外障碍：与本边无关的分组框（长边绕行时不许穿进去） */
  obstacles: Rect[];
  /** 源条目所属分组框在本框架下的底边（无分组时为 -Infinity） */
  exitBoxBottom: number;
  /** 把某个 y 推开分组框横边框至少 LANE_CLEARANCE，避免连线压在虚线框上 */
  clearY: (y: number) => number;
}

/** 层间走廊的车道分配结果 */
interface LanePlan {
  laneY: number;
}

const EPS = 1;
/** 跨层绕行时，出边后先横移的余量 */
const DETOUR_PAD = 8;
/** 跨层绕行进入目标层前的余量 */
const DETOUR_APPROACH = 16;
/** 逐条尝试的安全垂直走廊条数上限 */
const MAX_CORRIDORS = 3;

function anchorOf(rect: Rect, side: Side, fraction: number): LayoutPoint {
  switch (side) {
    case 'left':
      return { x: rect.x, y: rect.y + rect.height * fraction };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height * fraction };
    case 'top':
      return { x: rect.x + rect.width * fraction, y: rect.y };
    default:
      return { x: rect.x + rect.width * fraction, y: rect.y + rect.height };
  }
}

/** 去掉重复点与共线中间点 */
function simplify(points: LayoutPoint[]): LayoutPoint[] {
  const dedup: LayoutPoint[] = [];
  for (const point of points) {
    const last = dedup[dedup.length - 1];
    if (last && Math.abs(last.x - point.x) < 0.01 && Math.abs(last.y - point.y) < 0.01) {
      continue;
    }
    dedup.push(point);
  }

  const result: LayoutPoint[] = [];
  for (const point of dedup) {
    const a = result[result.length - 2];
    const b = result[result.length - 1];
    if (a && b && (a.x === b.x) === (b.x === point.x) && (a.y === b.y) === (b.y === point.y)) {
      result[result.length - 1] = point;
      continue;
    }
    result.push(point);
  }
  return result;
}

function toSegments(points: LayoutPoint[]): Segment[] {
  const segments: Segment[] = [];
  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    if (Math.abs(from.y - to.y) < 0.01) {
      segments.push({
        axis: 'h',
        coord: from.y,
        lo: Math.min(from.x, to.x),
        hi: Math.max(from.x, to.x),
      });
    } else if (Math.abs(from.x - to.x) < 0.01) {
      segments.push({
        axis: 'v',
        coord: from.x,
        lo: Math.min(from.y, to.y),
        hi: Math.max(from.y, to.y),
      });
    } else {
      return [];
    }
  }
  return segments;
}

/** 线段是否与矩形相交（pad 为额外安全边距） */
function segmentHitsRect(segment: Segment, rect: Rect, pad: number): boolean {
  const x1 = rect.x - pad;
  const y1 = rect.y - pad;
  const x2 = rect.x + rect.width + pad;
  const y2 = rect.y + rect.height + pad;

  if (segment.axis === 'h') {
    if (segment.coord < y1 || segment.coord > y2) {
      return false;
    }
    return segment.hi >= x1 && segment.lo <= x2;
  }
  if (segment.coord < x1 || segment.coord > x2) {
    return false;
  }
  return segment.hi >= y1 && segment.lo <= y2;
}

/** 线段是否穿过任一节点矩形（源/目标自身除外）或任一无关分组框 */
function collides(segments: Segment[], context: RouteContext): boolean {
  for (const segment of segments) {
    for (const [id, rect] of context.rects) {
      if (context.skipped.has(id)) {
        continue;
      }
      if (segmentHitsRect(segment, rect, COLLISION_PADDING)) {
        return true;
      }
    }
    for (const obstacle of context.obstacles) {
      if (segmentHitsRect(segment, obstacle, 0)) {
        return true;
      }
    }
  }
  return false;
}

/** 与其他连线是否贴得太近（同轴且投影区间重叠） */
function overlapsPlaced(segments: Segment[], context: RouteContext): boolean {
  for (const segment of segments) {
    for (const raw of context.placed) {
      const other = context.flipPlaced ? flipSegment(raw) : raw;
      if (other.axis !== segment.axis) {
        continue;
      }
      if (Math.abs(other.coord - segment.coord) >= LANE_CLEARANCE) {
        continue;
      }
      if (segment.hi < other.lo - EPS || segment.lo > other.hi + EPS) {
        continue;
      }
      return true;
    }
  }
  return false;
}

/** 与其他连线是否**垂直交叉**（十字相交；共线重叠由 `overlapsPlaced` 负责） */
function crossesPlaced(segments: Segment[], context: RouteContext): boolean {
  for (const segment of segments) {
    for (const raw of context.placed) {
      const other = context.flipPlaced ? flipSegment(raw) : raw;
      if (other.axis === segment.axis) {
        continue;
      }
      const horizontal = segment.axis === 'h' ? segment : other;
      const vertical = segment.axis === 'h' ? other : segment;
      if (horizontal.coord <= vertical.lo + EPS || horizontal.coord >= vertical.hi - EPS) {
        continue;
      }
      if (vertical.coord <= horizontal.lo + EPS || vertical.coord >= horizontal.hi - EPS) {
        continue;
      }
      return true;
    }
  }
  return false;
}

/** 转置一条线段：轴标签互换，坐标与区间数值不变 */
function flipSegment(segment: Segment): Segment {
  return { ...segment, axis: segment.axis === 'h' ? 'v' : 'h' };
}

const transposeRect = (rect: Rect): Rect => ({
  x: rect.y,
  y: rect.x,
  width: rect.height,
  height: rect.width,
});

const transposePoint = (point: LayoutPoint): LayoutPoint => ({ x: point.y, y: point.x });

/**
 * 找「不与任何节点重叠」的垂直列间隙（次轴坐标，升序）。
 * 先把所有节点的次轴区间并成若干连续块，块与块之间的中点就是可用通道。
 */
function computeColumnGaps(rects: Rect[]): number[] {
  const intervals = rects
    .map((rect) => [rect.x, rect.x + rect.width] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [lo, hi] of intervals) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) {
      last[1] = Math.max(last[1], hi);
    } else {
      merged.push([lo, hi]);
    }
  }

  const gaps: number[] = [];
  for (let index = 0; index + 1 < merged.length; index += 1) {
    gaps.push((merged[index]![1] + merged[index + 1]![0]) / 2);
  }
  return gaps;
}

type Candidate = (offset: number) => LayoutPoint[] | null;

/**
 * 外侧栏杆只允许**向外**漂移。
 * 车道偏移是双向的（0, +8, -8, +16, …），若原样作用在栏杆上会把栏杆拉回内容区、
 * 与分组框虚线边框重合（实测：03 的 `持久化` / `上报进度` 曾落到距组框仅 16px 处）。
 */
function railXAt(corridorX: number, offset: number, context: RouteContext): number {
  if (corridorX === context.outerLeftX) {
    return Math.min(corridorX + offset, corridorX);
  }
  if (corridorX === context.outerRightX) {
    return Math.max(corridorX + offset, corridorX);
  }
  return corridorX + offset;
}

/**
 * 取离目标最近的若干条安全垂直走廊，并补上左右外侧栏杆作为兜底通道。
 * `outerFirst` = true 时把**较近一侧**的外侧栏杆排到最前（长边「尽量往外围绕」用的优先级）。
 */
function pickCorridors(
  corridors: number[],
  target: number,
  outerLeftX: number,
  outerRightX: number,
  limit: number,
  outerFirst: boolean,
): number[] {
  const nearest = [...corridors]
    .sort((left, right) => Math.abs(left - target) - Math.abs(right - target))
    .slice(0, limit);
  if (!outerFirst) {
    return [...nearest, outerLeftX, outerRightX];
  }
  const outer =
    Math.abs(outerLeftX - target) <= Math.abs(outerRightX - target)
      ? [outerLeftX, outerRightX]
      : [outerRightX, outerLeftX];
  return [...outer, ...nearest];
}

/**
 * 正交走廊走线候选（design.md §3 Phase 5，虚拟轴口径：主轴向下、次轴向右）。
 *
 * 三类通道：
 * - ① 同行肋骨边：直接水平直连；
 * - ② 相邻层正向边：下出 → 层间走廊按车道分道 → 上入；
 * - ③ 跨多层正向边与逆向回边：下潜到安全垂直走廊（列间隙，或外侧栏杆），
 *      沿走廊纵向移动、必要时借顶部栏杆横穿，最后在目标层上方折入目标顶边。
 *
 * 绕行一律「先下潜再纵向移动」而不是从侧面直接横穿：侧向横穿会同排的邻居节点，
 * 而安全垂直走廊按全部节点的次轴区间预先算好，纵向移动必然不撞任何节点（实测修正）。
 */
function buildCandidates(
  a: Rect,
  b: Rect,
  lane: LanePlan | undefined,
  isInline: boolean,
  exitFraction: number,
  entryFraction: number,
  openA: OpenSides,
  openB: OpenSides,
  outerFirst: boolean,
  srcCorridors: number[],
  dstCorridors: number[],
  context: RouteContext,
): Candidate[] {
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;
  const bBelow = b.y >= aBottom - EPS;
  const bAbove = bBottom <= a.y + EPS;
  const rowOverlap = Math.min(aBottom, bBottom) - Math.max(a.y, b.y) > EPS;

  // 出/入端口按同源、同目标边的序号分散，避免多条边挤在同一点（也避免被重叠检测误杀）
  const fromBottom = anchorOf(a, 'bottom', exitFraction);
  const toTop = anchorOf(b, 'top', entryFraction);

  const candidates: Candidate[] = [
    // ① 同行肋骨直连
    (offset) => {
      if (!isInline || !rowOverlap || b.x < aRight - EPS) {
        return null;
      }
      const from = anchorOf(a, 'right', exitFraction);
      const to = anchorOf(b, 'left', entryFraction);
      if (Math.abs(from.y - to.y) < EPS) {
        return [from, to];
      }
      const midX = (aRight + b.x) / 2 + offset;
      return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
    },
    // ② 相邻层正向：下出 → 层间车道 → 上入
    (offset) => {
      if (lane === undefined || !bBelow) {
        return null;
      }
      const laneY = lane.laneY + offset;
      if (laneY <= aBottom + 2 || laneY >= b.y - 2) {
        return null;
      }
      return [
        fromBottom,
        { x: fromBottom.x, y: laneY },
        { x: toTop.x, y: laneY },
        toTop,
      ];
    },
    // ③ 正向：取两点之间中线做水平过渡（无车道信息时的兜底）
    (offset) => {
      if (!bBelow) {
        return null;
      }
      // 无车道信息时的兜底：取两点之间中线做水平过渡。
      // 中线同样要避让分组框横边框（否则会像 04 的 `gateway->order_api` 那样贴在 `平台层` 顶边 2px 处）。
      const midY = context.clearY((aBottom + b.y) / 2 + offset);
      return [
        fromBottom,
        { x: fromBottom.x, y: midY },
        { x: toTop.x, y: midY },
        toTop,
      ];
    },
  ];

  // ⑥ 逆向直连：目标在源上方，且源的「主轴起点侧」与目标的「主轴终点侧」都朝外开放
  //    （即源在最外层行、目标也在最外层行）→ 允许「上边出、下边入」，通常是一条直线；
  //    这是「首行/末行允许走上边和下边出入」的落地（03 的 `上报进度` 由 4 折变 0 折）。
  candidates.push((offset) => {
    if (!bAbove || !openA.mainStart || !openB.mainEnd) {
      return null;
    }
    const from = anchorOf(a, 'top', exitFraction);
    const to = anchorOf(b, 'bottom', entryFraction);
    const midY = Math.min(context.clearY((bBottom + a.y) / 2 + offset), a.y - 6);
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
  });

  // ⑦ 外圈侧向直连：源与目标在**同一侧**都有开放端口（都在首列或都在末列）时，
  //    走「同侧出 → 外侧通道 → 同侧入」，只要 2 折（05 的跨域/回流由 4 折变 2 折）。
  //    自加一道「不与已放置连线十字相交」的约束：相邻长边的短横段很容易穿过彼此的竖段
  //    （05 实测过 5 处），不满足就整体让位给 ④ / ⑤。
  for (const side of ['crossStart', 'crossEnd'] as const) {
    candidates.push((offset) => {
      if (!openA[side] || !openB[side]) {
        return null;
      }
      const left = side === 'crossStart';
      const from = anchorOf(a, left ? 'left' : 'right', exitFraction);
      const to = anchorOf(b, left ? 'left' : 'right', entryFraction);
      // 通道必须落在这两个端口的外侧：长边直接用外圈栏杆，短边就近取外侧
      const x = outerFirst
        ? railXAt(left ? context.outerLeftX : context.outerRightX, offset, context)
        : left
          ? Math.min(a.x, b.x) - LANE_STEP - Math.abs(offset)
          : Math.max(aRight, bRight) + LANE_STEP + Math.abs(offset);
      const route = simplify([from, { x, y: from.y }, { x, y: to.y }, to]);
      const segments = toSegments(route);
      if (segments.length === 0 || crossesPlaced(segments, context)) {
        return null;
      }
      return route;
    });
  }

  // ⑧ 开放侧出：长边若源的外侧有留白，直接从那一侧出边去走廊，
  //    省掉「先下潜再横移」那一折，也不再贴着分组框底边走（03 的 `持久化`）。
  for (const side of ['crossStart', 'crossEnd'] as const) {
    if (!openA[side]) {
      continue;
    }
    const portSide: Side = side === 'crossStart' ? 'left' : 'right';
    for (const corridorX of srcCorridors) {
      candidates.push((offset) => {
        if (!bBelow) {
          return null;
        }
        const from = anchorOf(a, portSide, exitFraction);
        const x = railXAt(corridorX, offset, context);
        // 走廊必须落在出边那一侧之外，否则会折返
        if (side === 'crossStart' ? x > from.x - EPS : x < from.x + EPS) {
          return null;
        }
        const approachY = Math.min(context.clearY(toTop.y - DETOUR_APPROACH - Math.abs(offset)), toTop.y - 6);
        if (approachY <= from.y) {
          return null;
        }
        const route = simplify([
          from,
          { x, y: from.y },
          { x, y: approachY },
          { x: toTop.x, y: approachY },
          toTop,
        ]);
        if (crossesPlaced(toSegments(route), context)) {
          return null; // 与已放置连线十字相交就让位给普通绕行
        }
        return route;
      });
    }
  }

  // ④ 跨多层正向：下潜 → 逐条安全垂直走廊下行 → 目标层上方折入
  for (const corridorX of srcCorridors) {
    candidates.push((offset) => {
      if (!bBelow) {
        return null;
      }
      const downY = Math.max(aBottom + DETOUR_PAD, context.exitBoxBottom + LANE_CLEARANCE);
      const x = railXAt(corridorX, offset, context);
      const approachY = Math.min(context.clearY(toTop.y - DETOUR_APPROACH - offset), toTop.y - 6);
      if (approachY <= downY) {
        return null;
      }
      return [
        fromBottom,
        { x: fromBottom.x, y: downY },
        { x, y: downY },
        { x, y: approachY },
        { x: toTop.x, y: approachY },
        toTop,
      ];
    });
  }

  // ⑤ 逆向回边 / 侧向：下潜 → 安全走廊上行 → 顶部栏杆横穿 → 目标侧安全走廊下行 → 折入目标顶边
  for (const srcX of srcCorridors) {
    for (const dstX of dstCorridors) {
      candidates.push((offset) => {
        if (bBelow) {
          return null;
        }
        const downY = Math.max(aBottom + DETOUR_PAD, context.exitBoxBottom + LANE_CLEARANCE);
        const railY = context.topRailY - Math.abs(offset);
        const sx = railXAt(srcX, offset, context);
        const dx = railXAt(dstX, offset, context);
        const approachY = Math.min(context.clearY(toTop.y - DETOUR_APPROACH - Math.abs(offset)), toTop.y - 6);
        return [
          fromBottom,
          { x: fromBottom.x, y: downY },
          { x: sx, y: downY },
          { x: sx, y: railY },
          { x: dx, y: railY },
          { x: dx, y: approachY },
          { x: toTop.x, y: approachY },
          toTop,
        ];
      });
    }
  }

  return candidates;
}

/**
 * 把单元轴口径的「开放侧」映射到当前走线框架。
 * 单元的 `main` 轴在框架里可能就是 `cross` 轴（方向互为转置时），此时四个标记要整体对调。
 */
function openSidesInFrame(meta: NodeMeta, frame: LayoutDirection): OpenSides {
  if (meta.unitDirection === frame) {
    return meta.open;
  }
  return {
    mainStart: meta.open.crossStart,
    mainEnd: meta.open.crossEnd,
    crossStart: meta.open.mainStart,
    crossEnd: meta.open.mainEnd,
  };
}

/**
 * 自研正交走线路由器（PRD §4.1.3 Step 5）。
 *
 * 逐层交替方向之后，全图不再有唯一的虚拟轴，因此改为**逐边定框架**：
 * 每条边的框架由 `edgeFrames` 给出（见 `resolveEdgeFrames`），跑原有候选逻辑前
 * 把节点矩形 / 层带 / 走廊全部变换进该框架，输出点再变换回物理坐标。
 * 转置只翻转 segment 的轴标签、数值不变，所以「已占用的线段」统一按物理口径存放，
 * 比较时按当前边的框架翻转即可。
 */
export function routeEdges(
  spec: NormalizedSpec,
  placement: Placement,
  edgeFrames: LayoutDirection[],
): LayoutEdge[] {
  const { nodeMeta, content } = placement;
  const physicalRects = new Map<string, Rect>(
    placement.nodes.map((node) => [
      node.id,
      { x: node.absX, y: node.absY, width: node.width, height: node.height },
    ]),
  );
  const transposedRects = new Map<string, Rect>(
    [...physicalRects].map(([id, rect]) => [id, transposeRect(rect)]),
  );
  const physicalBands = new Map<string, Rect>(
    placement.rankBands.map((band) => [`${band.unitKey}\u0000${band.rank}`, band.rect]),
  );
  const transposedBands = new Map<string, Rect>(
    [...physicalBands].map(([key, rect]) => [key, transposeRect(rect)]),
  );
  const corridorsOf = new Map<LayoutDirection, number[]>([
    ['TB', computeColumnGaps([...physicalRects.values()])],
    ['LR', computeColumnGaps([...transposedRects.values()])],
  ]);

  const frameOf = (index: number): LayoutDirection => edgeFrames[index] ?? 'TB';
  const rectsOf = (frame: LayoutDirection): Map<string, Rect> =>
    frame === 'TB' ? physicalRects : transposedRects;
  const bandsOf = (frame: LayoutDirection): Map<string, Rect> =>
    frame === 'TB' ? physicalBands : transposedBands;

  // 分组框：长边绕行时作为「无关分组」障碍
  const physicalGroupRects = new Map<string, Rect>(
    placement.groups.map((group) => [
      group.id,
      { x: group.absX, y: group.absY, width: group.width, height: group.height },
    ]),
  );
  const transposedGroupRects = new Map<string, Rect>(
    [...physicalGroupRects].map(([id, rect]) => [id, transposeRect(rect)]),
  );
  const groupsOf = (frame: LayoutDirection): Map<string, Rect> =>
    frame === 'TB' ? physicalGroupRects : transposedGroupRects;

  /** 某节点所属分组框在本框架下的底边；不在任何分组里时为 -Infinity */
  const boxBottomOf = (nodeId: string, frame: LayoutDirection): number => {
    const unitKey = nodeMeta.get(nodeId)?.unitKey;
    if (unitKey === undefined || unitKey === ROOT_UNIT_KEY) {
      return Number.NEGATIVE_INFINITY;
    }
    const box = groupsOf(frame).get(unitKey);
    return box === undefined ? Number.NEGATIVE_INFINITY : box.y + box.height;
  };

  /** 本框架下所有分组框的上/下横边框 y 值 */
  const borderYsOf = (frame: LayoutDirection): number[] =>
    [...new Set([...groupsOf(frame).values()].flatMap((rect) => [rect.y, rect.y + rect.height]))].sort(
      (left, right) => left - right,
    );

  /** 本框架下所有分组框的左/右竖边框 x 值 */
  const borderXsOf = (frame: LayoutDirection): number[] =>
    [...new Set([...groupsOf(frame).values()].flatMap((rect) => [rect.x, rect.x + rect.width]))].sort(
      (left, right) => left - right,
    );

  /**
   * 把轴向坐标钳到「离分组框同轴向边框至少 LANE_CLEARANCE」的位置：取它所在的那段空隙往中间收。
   * 横轴（y）与竖轴（x）共用同一实现，见下方的 `clearXWith`。
   * 不钳制时实测出现过多处连线压在虚线框上（02 8px、03 0px、04 2px）。
   */
  const clearYWith = (borderYs: number[], y: number): number => {
    let lower = Number.NEGATIVE_INFINITY;
    let upper = Number.POSITIVE_INFINITY;
    for (const border of borderYs) {
      if (border <= y && border > lower) {
        lower = border;
      }
      if (border >= y && border < upper) {
        upper = border;
      }
    }
    const low = Number.isFinite(lower) ? lower + LANE_CLEARANCE : Number.NEGATIVE_INFINITY;
    const high = Number.isFinite(upper) ? upper - LANE_CLEARANCE : Number.POSITIVE_INFINITY;
    if (low > high) {
      // 空隙窄到两侧都留不出 LANE_CLEARANCE 时，绝不能把边框值本身当结果 ——
      // 那正是「连线压在分组框虚线上」（实测 03 的 `single_player->director` 正是
      // approachY 取到 y=0、与 `编排层` 顶边框完全重合）。坐标恰好落在某条边框上
      // （lower === upper）时，往里让开一个 LANE_CLEARANCE。
      if (lower === upper) {
        return y + LANE_CLEARANCE;
      }
      return Number.isFinite(lower) && Number.isFinite(upper) ? (lower + upper) / 2 : y;
    }
    return Math.min(Math.max(y, low), high);
  };

  /** 与 `clearYWith` 同构：把 x 钳到离分组框竖边框至少 LANE_CLEARANCE 的位置 */
  const clearXWith = clearYWith;

  /** 分组 → 自身与全部祖先：这些框允许被穿过（端点就在里面），其余分组框算障碍 */
  const groupChain = new Map<string, Set<string>>();
  {
    const parentOf = new Map(placement.groups.map((group) => [group.id, group.parentId]));
    for (const group of placement.groups) {
      const chain = new Set<string>([group.id]);
      let cursor = parentOf.get(group.id);
      while (cursor !== undefined && !chain.has(cursor)) {
        chain.add(cursor);
        cursor = parentOf.get(cursor);
      }
      groupChain.set(group.id, chain);
    }
  }

  /** 某节点所在层带在指定框架下的顶/底坐标 */
  const bandAcross = (
    frame: LayoutDirection,
    nodeId: string,
    side: 'top' | 'bottom',
  ): number | null => {
    const meta = nodeMeta.get(nodeId);
    if (meta === undefined) {
      return null;
    }
    const band = bandsOf(frame).get(`${meta.unitKey}\u0000${meta.rank}`);
    if (band === undefined) {
      return null;
    }
    return side === 'top' ? band.y : band.y + band.height;
  };

  const edgeCount = spec.edges.length;
  const isInline = new Array<boolean>(edgeCount).fill(false);
  /** 长边（跨多层正向 / 逆向回边）：走线时优先外绕，且不许穿进无关分组框 */
  const longSpan = new Array<boolean>(edgeCount).fill(true);
  const laneOf = new Map<number, LanePlan>();
  const laneGroups = new Map<string, number[]>();

  // ① 框架判定、分类与层间车道预分配
  spec.edges.forEach((edge, index) => {
    const frame = frameOf(index);
    const rects = rectsOf(frame);
    const a = rects.get(edge.from);
    const b = rects.get(edge.to);
    const metaA = nodeMeta.get(edge.from);
    const metaB = nodeMeta.get(edge.to);
    if (a === undefined || b === undefined || metaA === undefined || metaB === undefined) {
      return;
    }

    if (metaA.unitKey === metaB.unitKey && metaA.rank === metaB.rank) {
      isInline[index] = true;
      longSpan[index] = false;
      return;
    }
    if (b.y < a.y + a.height - EPS) {
      return; // 非正向：仍是长边
    }
    const bandBottom = bandAcross(frame, edge.from, 'bottom');
    const bandTop = bandAcross(frame, edge.to, 'top');
    if (bandBottom === null || bandTop === null) {
      return;
    }
    const gap = bandTop - bandBottom;
    if (gap <= 0 || gap > MAX_LANE_GAP) {
      return; // 跨多层：仍是长边
    }
    longSpan[index] = false;
    const key = `${frame}\u0000${metaB.unitKey}\u0000${metaB.rank}`;
    const list = laneGroups.get(key) ?? [];
    list.push(index);
    laneGroups.set(key, list);
  });

  // 同一层间走廊内的折线按起止次轴坐标分配独立车道
  for (const [key, indices] of laneGroups) {
    const frame = key.startsWith('LR') ? 'LR' : 'TB';
    const rects = rectsOf(frame);
    const centerOf = (index: number): number => {
      const edge = spec.edges[index]!;
      const a = rects.get(edge.from)!;
      const b = rects.get(edge.to)!;
      return Math.min(a.x + a.width / 2, b.x + b.width / 2);
    };
    const sorted = [...indices].sort((left, right) => centerOf(left) - centerOf(right));

    const first = spec.edges[sorted[0]!]!;
    // 车道基准 = max(源层带底边, 源所属分组框底边)：只用层带底边会落在组框内边距里，
    // 实测 `分段任务` 的车道曾距 `编排层` 底边仅 4px，看起来就是贴着虚线边框走。
    const bandBottom = Math.max(
      bandAcross(frame, first.from, 'bottom') ?? 0,
      boxBottomOf(first.from, frame),
    );
    const bandTop = bandAcross(frame, first.to, 'top') ?? 0;
    const gap = Math.max(0, bandTop - bandBottom);
    const step = Math.max(LANE_STEP, Math.min(gap / (sorted.length + 1), LANE_STEP * 3));

    // 车道不许贴着分组框的横边框走：取车道所在的那段空隙，往中间钳制。
    // 实测不钳制时 02 曾距边框 8px、04 曾距 2px，看着就是压在虚线框上。
    const frameBorderYs = borderYsOf(frame);
    sorted.forEach((index, laneIndex) => {
      laneOf.set(index, {
        laneY: clearYWith(frameBorderYs, bandBottom + step * (laneIndex + 1)),
      });
    });
  }

  const placed: Segment[] = [];

  // 出/入端口分散：同源（同目标）的多条边按序号均分节点边沿，避免挤在同一点
  const outCount = new Map<string, number>();
  const inCount = new Map<string, number>();
  for (const edge of spec.edges) {
    outCount.set(edge.from, (outCount.get(edge.from) ?? 0) + 1);
    inCount.set(edge.to, (inCount.get(edge.to) ?? 0) + 1);
  }
  const outSeen = new Map<string, number>();
  const inSeen = new Map<string, number>();

  return spec.edges.map((edge, index) => {
    const frame = frameOf(index);
    const flipped = frame === 'LR';
    const rects = rectsOf(frame);
    const a = rects.get(edge.from);
    const b = rects.get(edge.to);
    const id = `e_${index}`;
    if (a === undefined || b === undefined) {
      return { id, from: edge.from, to: edge.to, label: edge.label, style: edge.style, points: [] };
    }

    const outOrdinal = outSeen.get(edge.from) ?? 0;
    outSeen.set(edge.from, outOrdinal + 1);
    const inOrdinal = inSeen.get(edge.to) ?? 0;
    inSeen.set(edge.to, inOrdinal + 1);
    const exitFraction = (outOrdinal + 1) / ((outCount.get(edge.from) ?? 1) + 1);
    const entryFraction = (inOrdinal + 1) / ((inCount.get(edge.to) ?? 1) + 1);

    // 框架内的内容尺寸与外侧栏杆位置
    const frameWidth = flipped ? content.height : content.width;
    const outerLeftX = -OUTER_CHANNEL_GAP;
    const outerRightX = frameWidth + OUTER_CHANNEL_GAP;

    // 长边「尽量往外围绕」：外侧栏杆优先，且不许穿进与本边无关的分组框
    const outerFirst = longSpan[index]!;
    const obstacles: Rect[] = [];
    if (outerFirst) {
      const exempt = new Set<string>();
      for (const nodeId of [edge.from, edge.to]) {
        const unitKey = nodeMeta.get(nodeId)?.unitKey;
        if (unitKey === undefined || unitKey === ROOT_UNIT_KEY) {
          continue;
        }
        for (const id of groupChain.get(unitKey) ?? []) {
          exempt.add(id);
        }
      }
      for (const [id, rect] of groupsOf(frame)) {
        if (!exempt.has(id)) {
          obstacles.push(rect);
        }
      }
    }

    // 内部走廊来自「节点间隙中点」，当那段间隙恰好贴着分组框时，中点会压在虚线上
    // （实测 02 曾贴到 4px）。先用 clearX 把走廊推离所有竖边框 ≥ LANE_CLEARANCE，
    // 再交给 pickCorridors；外侧栏杆（±LANE_CLEARANCE）本身就是净距，不参与推移。
    const borderXs = borderXsOf(frame);
    const corridors = corridorsOf.get(frame)!.map((x) => clearXWith(borderXs, x));
    const srcCorridors = pickCorridors(
      corridors,
      a.x + a.width / 2,
      outerLeftX,
      outerRightX,
      MAX_CORRIDORS,
      outerFirst,
    );
    const dstCorridors = pickCorridors(
      corridors,
      b.x + b.width / 2,
      outerLeftX,
      outerRightX,
      1,
      outerFirst,
    );

    const context: RouteContext = {
      rects,
      skipped: new Set([edge.from, edge.to]),
      topRailY: -TOP_RAIL_HEIGHT,
      outerLeftX,
      outerRightX,
      placed,
      flipPlaced: flipped,
      obstacles,
      exitBoxBottom: boxBottomOf(edge.from, frame),
      clearY: (y: number) => clearYWith(borderYsOf(frame), y),
    };
    const candidates = buildCandidates(
      a,
      b,
      laneOf.get(index),
      isInline[index]!,
      exitFraction,
      entryFraction,
      openSidesInFrame(nodeMeta.get(edge.from)!, frame),
      openSidesInFrame(nodeMeta.get(edge.to)!, frame),
      outerFirst,
      srcCorridors,
      dstCorridors,
      context,
    );

    /** 已放置线段一律折算成物理口径存放 */
    const commit = (segments: Segment[]): void => {
      placed.push(...segments.map((segment) => (flipped ? flipSegment(segment) : segment)));
    };

    let chosen: LayoutPoint[] | null = null;
    for (const candidate of candidates) {
      for (let step = 0; step < LANE_LIMIT && chosen === null; step += 1) {
        const points = candidate(laneOffset(step));
        if (points === null) {
          break;
        }
        const simplified = simplify(points);
        const segments = toSegments(simplified);
        if (segments.length === 0) {
          continue;
        }
        if (collides(segments, context) || overlapsPlaced(segments, context)) {
          continue;
        }
        commit(segments);
        chosen = simplified;
      }
      if (chosen !== null) {
        break;
      }
    }

    // 全部候选都失败：放宽到「只做节点碰撞检测」再试一轮
    if (chosen === null) {
      for (const candidate of candidates) {
        for (let step = 0; step < LANE_LIMIT && chosen === null; step += 1) {
          const points = candidate(laneOffset(step));
          if (points === null) {
            break;
          }
          const simplified = simplify(points);
          const segments = toSegments(simplified);
          if (segments.length === 0 || collides(segments, context)) {
            continue;
          }
          commit(segments);
          chosen = simplified;
        }
        if (chosen !== null) {
          break;
        }
      }
    }

    // 实在无解才接受一条穿模路径（保证每条边一定有正交折线可用）
    if (chosen === null) {
      const from = anchorOf(a, 'bottom', 0.5);
      const to = anchorOf(b, 'top', 0.5);
      const midY = (from.y + to.y) / 2;
      const lastResort =
        candidates[candidates.length - 1]?.(0) ??
        [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
      chosen = simplify(lastResort);
      commit(toSegments(chosen));
    }

    return {
      id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      style: edge.style,
      points: flipped ? chosen.map(transposePoint) : chosen,
    };
  });
}

/** 车道偏移序列：0, +8, -8, +16, -16, ... */
function laneOffset(step: number): number {
  if (step === 0) {
    return 0;
  }
  const magnitude = Math.ceil(step / 2) * LANE_STEP;
  return step % 2 === 1 ? magnitude : -magnitude;
}