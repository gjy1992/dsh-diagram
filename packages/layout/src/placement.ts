import type {
  GroupVariant,
  LayoutDirection,
  NodeVariant,
  NormalizedGroup,
  NormalizedNode,
  NormalizedSpec,
} from '@dsh-diagram/schema';
import { ROOT_UNIT_KEY, groupLevel, type Layering, type RibBinding } from './layering';
import { measureNodeSize } from './sizing';
import {
  CROSS_GAP,
  RANK_GAP,
  UNIT_GAP,
  UNIT_HEADER_HEIGHT,
  UNIT_PADDING_BOTTOM,
  UNIT_PADDING_X,
} from './tokens';
import type { Rect } from './types';

export interface PlacedNode {
  id: string;
  title: string;
  desc?: string;
  variant: NodeVariant;
  items: string[];
  groupId?: string;
  /** 物理坐标：相对所属分组框（无分组时为画布绝对坐标） */
  x: number;
  y: number;
  width: number;
  height: number;
  absX: number;
  absY: number;
}

export interface PlacedGroup {
  id: string;
  title: string;
  variant: GroupVariant;
  parentId?: string;
  level: number;
  x: number;
  y: number;
  width: number;
  height: number;
  absX: number;
  absY: number;
}

/** 某个单元某一层的「层带」矩形（物理坐标），供走线器分层间车道 */
export interface RankBand {
  unitKey: string;
  rank: number;
  rect: Rect;
}

/** 走线器需要的节点拓扑位置信息 */
export interface NodeMeta {
  unitKey: string;
  rank: number;
  /** 所属簇锚点 id */
  clusterId: string;
  isRib: boolean;
}

export interface Placement {
  nodes: PlacedNode[];
  groups: PlacedGroup[];
  rankBands: RankBand[];
  nodeMeta: Map<string, NodeMeta>;
  /** 根画布内容尺寸（物理口径），走线器据此放外侧栏杆 */
  content: { width: number; height: number };
  maxColumnsUsed: number;
}

interface Item {
  id: string;
  kind: 'group' | 'node';
  /** 在所属单元内的声明序号 */
  declIndex: number;
  /** 在所属单元内的层号与层内序 */
  rank: number;
  order: number;
  clusterId: string;
  /** 肋骨绑定（非肋骨为 null） */
  rib: RibBinding | null;
  /**
   * 本条目所代表的布局单元的方向 —— 决定它的 `children` 怎么排。
   * 分组条目是自己的内部单元；根条目是根画布；节点条目不排 children，取所在单元的方向占位。
   */
  unitDirection: LayoutDirection;
  /** 物理尺寸（节点恒为 240 × h；分组为其包络框） */
  physWidth: number;
  physHeight: number;
  /** 虚拟轴绝对坐标（相对根画布原点，口径由**父单元**的方向决定） */
  mainAbs: number;
  crossAbs: number;
  plan?: UnitPlan;
  children: Item[];
  node?: NormalizedNode;
  group?: NormalizedGroup;
}

interface UnitPlan {
  ranks: number[];
  rows: Item[][];
  rankMain: Map<number, number>;
  /** 每层的主轴起点（虚拟轴，绘制时记录） */
  rankMainStart: Map<number, number>;
  columnX: number[];
  columnWidth: number[];
  rankGap: number;
  padMainStart: number;
  padMainEnd: number;
  padCrossStart: number;
  padCrossEnd: number;
  contentCross: number;
}

interface Context {
  spec: NormalizedSpec;
  layerings: Map<string, Layering>;
  unitDirections: Map<string, LayoutDirection>;
  maxColumns: number | 'auto';
  stats: { maxColumns: number };
}

const EMPTY_LAYERING: Layering = {
  layerOf: new Map(),
  orderOf: new Map(),
  ribOf: new Map(),
  hasEdges: false,
};

/**
 * 虚拟双轴（design.md §2）：
 * - **主轴（main）** 承载 `Rank`，是有向拓扑轴；
 * - **次轴（cross）** 承载 `Order`，是同层内的排列轴。
 *
 * 每个布局单元自带一个方向，`TB` 下 `x = cross, y = main`，`LR` 下 `x = main, y = cross`。
 * 条目在**父单元**的轴口径下量取尺寸。
 */
const mainExtent = (item: Item, direction: LayoutDirection): number =>
  direction === 'TB' ? item.physHeight : item.physWidth;

const crossExtent = (item: Item, direction: LayoutDirection): number =>
  direction === 'TB' ? item.physWidth : item.physHeight;

const transposeRect = (rect: Rect): Rect => ({
  x: rect.y,
  y: rect.x,
  width: rect.height,
  height: rect.width,
});

/**
 * 给一个单元的条目打上「在本单元内」的层号与层内序。
 * 单元内没有连线时不存在拓扑因果，退化为网格：按 `max_columns` 折行，
 * `auto` 取近似正方形（√n），避免无关联条目被拉成一条长横带。
 */
function assignRanks(items: Item[], layering: Layering, ctx: Context): void {
  if (layering.hasEdges) {
    for (const item of items) {
      const rib = layering.ribOf.get(item.id) ?? null;
      item.rank = layering.layerOf.get(item.id) ?? 0;
      item.order = layering.orderOf.get(item.id) ?? 0;
      item.rib = rib;
      item.clusterId = rib?.anchorId ?? item.id;
    }
    return;
  }

  const columns =
    typeof ctx.maxColumns === 'number'
      ? ctx.maxColumns
      : Math.max(1, Math.ceil(Math.sqrt(items.length)));
  items.forEach((item, index) => {
    item.rank = Math.floor(index / columns);
    item.order = index % columns;
    item.rib = null;
    item.clusterId = item.id;
  });
}

function buildUnit(
  unitKey: string | undefined,
  group: NormalizedGroup | undefined,
  ctx: Context,
): Item {
  const key = unitKey ?? ROOT_UNIT_KEY;
  const layerings = ctx.layerings.get(key) ?? EMPTY_LAYERING;
  const unitDirection = ctx.unitDirections.get(key) ?? 'TB';

  const children: Item[] = [];
  let declIndex = 0;

  for (const sub of ctx.spec.groups.filter((item) => item.parent === unitKey)) {
    const child = buildUnit(sub.id, sub, ctx);
    child.declIndex = declIndex;
    children.push(child);
    declIndex += 1;
  }

  for (const node of ctx.spec.nodes.filter((item) => item.group === unitKey)) {
    const size = measureNodeSize(node);
    children.push({
      id: node.id,
      kind: 'node',
      declIndex,
      rank: 0,
      order: 0,
      clusterId: node.id,
      rib: null,
      unitDirection,
      physWidth: size.width,
      physHeight: size.height,
      mainAbs: 0,
      crossAbs: 0,
      children: [],
      node,
    });
    declIndex += 1;
  }

  assignRanks(children, layerings, ctx);

  const unit: Item = {
    id: key,
    kind: 'group',
    declIndex,
    rank: 0,
    order: 0,
    clusterId: key,
    rib: null,
    unitDirection,
    physWidth: 0,
    physHeight: 0,
    mainAbs: 0,
    crossAbs: 0,
    children,
    group,
  };
  unit.plan = planUnit(unit, ctx);
  return unit;
}

/** 自底向上：按单元自己的方向算出列槽位、层带与包络尺寸 */
function planUnit(unit: Item, ctx: Context): UnitPlan {
  const direction = unit.unitDirection;

  const byRank = new Map<number, Item[]>();
  for (const child of unit.children) {
    const list = byRank.get(child.rank) ?? [];
    list.push(child);
    byRank.set(child.rank, list);
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  // 每层：簇（锚点 + 肋骨链）按 order 排好，簇内肋骨按 offset 紧随锚点
  const rows: Item[][] = ranks.map((rank) => {
    const items = byRank.get(rank)!;
    const anchors = items
      .filter((item) => item.rib === null)
      .sort((a, b) => a.order - b.order || a.declIndex - b.declIndex);
    const row: Item[] = [];
    for (const anchor of anchors) {
      row.push(anchor);
      for (const rib of items
        .filter((item) => item.rib !== null && item.clusterId === anchor.id)
        .sort((a, b) => (a.rib?.offset ?? 0) - (b.rib?.offset ?? 0))) {
        row.push(rib);
      }
    }
    return row;
  });

  // 簇宽与「列槽位」：同一簇序号在所有层里共用一列，形成对齐的矩阵
  const clustersPerRow = rows.map((row) => {
    const clusters: number[] = [];
    for (let index = 0; index < row.length; ) {
      const anchor = row[index]!;
      let width = crossExtent(anchor, direction);
      let cursor = index + 1;
      while (cursor < row.length && row[cursor]!.rib !== null && row[cursor]!.clusterId === anchor.id) {
        width += crossExtent(row[cursor]!, direction) + CROSS_GAP;
        cursor += 1;
      }
      clusters.push(width);
      index = cursor;
    }
    return clusters;
  });

  const columnCount = clustersPerRow.reduce((max, row) => Math.max(max, row.length), 0);
  ctx.stats.maxColumns = Math.max(ctx.stats.maxColumns, columnCount);

  const columnWidth: number[] = [];
  for (let index = 0; index < columnCount; index += 1) {
    columnWidth.push(clustersPerRow.reduce((max, row) => Math.max(max, row[index] ?? 0), 0));
  }
  const columnX: number[] = [];
  let cursorX = 0;
  for (let index = 0; index < columnCount; index += 1) {
    columnX.push(cursorX);
    cursorX += columnWidth[index]! + CROSS_GAP;
  }
  const contentCross = columnCount === 0 ? 0 : cursorX - CROSS_GAP;

  const rankMain = new Map<number, number>();
  ranks.forEach((rank, index) => {
    rankMain.set(
      rank,
      rows[index]!.reduce((max, item) => Math.max(max, mainExtent(item, direction)), 0),
    );
  });

  const box = unit.group !== undefined;
  // 单元里装着分组（带）时留更宽的层间距，兼作跨带走线通道
  const rankGap = unit.children.some((child) => child.kind === 'group') ? UNIT_GAP : RANK_GAP;
  const padMainStart = box ? (direction === 'TB' ? UNIT_HEADER_HEIGHT : UNIT_PADDING_X) : 0;
  const padMainEnd = box ? (direction === 'TB' ? UNIT_PADDING_BOTTOM : UNIT_PADDING_X) : 0;
  const padCrossStart = box ? (direction === 'TB' ? UNIT_PADDING_X : UNIT_HEADER_HEIGHT) : 0;
  const padCrossEnd = box ? (direction === 'TB' ? UNIT_PADDING_X : UNIT_PADDING_BOTTOM) : 0;

  let contentMain = 0;
  ranks.forEach((rank, index) => {
    if (index > 0) {
      contentMain += rankGap;
    }
    contentMain += rankMain.get(rank)!;
  });

  const crossTotal = contentCross + padCrossStart + padCrossEnd;
  const mainTotal = contentMain + padMainStart + padMainEnd;
  unit.physWidth = direction === 'TB' ? crossTotal : mainTotal;
  unit.physHeight = direction === 'TB' ? mainTotal : crossTotal;

  return {
    ranks,
    rows,
    rankMain,
    rankMainStart: new Map(),
    columnX,
    columnWidth,
    rankGap,
    padMainStart,
    padMainEnd,
    padCrossStart,
    padCrossEnd,
    contentCross,
  };
}

/** 自顶向下：把每个单元的内容按层带与列槽位摆到虚拟轴绝对坐标上 */
function positionUnit(unit: Item, baseMain: number, baseCross: number, ctx: Context): void {
  const plan = unit.plan!;
  const direction = unit.unitDirection;

  let mainCursor = baseMain + plan.padMainStart;
  plan.ranks.forEach((rank, index) => {
    plan.rankMainStart.set(rank, mainCursor);
    const row = plan.rows[index]!;

    let clusterIndex = 0;
    for (let cursor = 0; cursor < row.length; ) {
      const anchor = row[cursor]!;
      const members: Item[] = [anchor];
      let next = cursor + 1;
      while (next < row.length && row[next]!.rib !== null && row[next]!.clusterId === anchor.id) {
        members.push(row[next]!);
        next += 1;
      }

      let crossCursor = baseCross + plan.padCrossStart + plan.columnX[clusterIndex]!;
      for (const member of members) {
        member.mainAbs = mainCursor;
        member.crossAbs = crossCursor;
        crossCursor += crossExtent(member, direction) + CROSS_GAP;
        if (member.kind === 'group') {
          // 子单元的内部坐标要用**子单元自己的轴口径**表达：
          // 先把分组框的物理左上角算出来，再按子单元的方向换算成它的 (main, cross)。
          const physicalX = direction === 'TB' ? member.crossAbs : member.mainAbs;
          const physicalY = direction === 'TB' ? member.mainAbs : member.crossAbs;
          const childDirection = member.unitDirection;
          positionUnit(
            member,
            childDirection === 'TB' ? physicalY : physicalX,
            childDirection === 'TB' ? physicalX : physicalY,
            ctx,
          );
        }
      }

      cursor = next;
      clusterIndex += 1;
    }

    mainCursor += plan.rankMain.get(rank)! + plan.rankGap;
  });
}

/**
 * 坐标分配（design.md §4 Phase 4）。
 *
 * - 每个单元按**自己的方向**把 `(Rank, Order)` 摆成「层带 × 列槽位」矩阵；
 * - 「锚点 + 肋骨链」作为刚体簇占据一个列槽位，跨层同序号的簇对齐到同一列；
 * - 单元内部先算虚拟轴绝对坐标，最后按**父单元的方向**映射到物理 X/Y。
 */
export function placeSpec(
  spec: NormalizedSpec,
  layerings: Map<string, Layering>,
  unitDirections: Map<string, LayoutDirection>,
): Placement {
  const ctx: Context = {
    spec,
    layerings,
    unitDirections,
    maxColumns: spec.layout.maxColumns,
    stats: { maxColumns: 0 },
  };

  const root = buildUnit(undefined, undefined, ctx);
  positionUnit(root, 0, 0, ctx);

  const nodes: PlacedNode[] = [];
  const groups: PlacedGroup[] = [];
  const rankBands: RankBand[] = [];
  const nodeMeta = new Map<string, NodeMeta>();
  const absoluteOf = new Map<string, { x: number; y: number }>();

  const walk = (item: Item, frame: LayoutDirection): void => {
    const abs =
      frame === 'TB' ? { x: item.crossAbs, y: item.mainAbs } : { x: item.mainAbs, y: item.crossAbs };
    const parentKey = item.node?.group ?? item.group?.parent;
    const parent = parentKey !== undefined ? absoluteOf.get(parentKey) : undefined;

    if (item.kind === 'node' && item.node) {
      const node = item.node;
      nodes.push({
        id: node.id,
        title: node.title,
        desc: node.desc,
        variant: node.variant,
        items: node.items,
        groupId: node.group,
        x: abs.x - (parent?.x ?? 0),
        y: abs.y - (parent?.y ?? 0),
        width: item.physWidth,
        height: item.physHeight,
        absX: abs.x,
        absY: abs.y,
      });
      nodeMeta.set(node.id, {
        unitKey: node.group ?? ROOT_UNIT_KEY,
        rank: item.rank,
        clusterId: item.clusterId,
        isRib: item.rib !== null,
      });
    }

    if (item.kind === 'group' && item.group) {
      const group = item.group;
      groups.push({
        id: group.id,
        title: group.title,
        variant: group.variant,
        parentId: group.parent,
        level: groupLevel(group.id, spec.groups),
        x: abs.x - (parent?.x ?? 0),
        y: abs.y - (parent?.y ?? 0),
        width: item.physWidth,
        height: item.physHeight,
        absX: abs.x,
        absY: abs.y,
      });
      absoluteOf.set(group.id, abs);

      const plan = item.plan!;
      for (const rank of plan.ranks) {
        const local: Rect = {
          x: item.crossAbs + plan.padCrossStart,
          y: plan.rankMainStart.get(rank) ?? item.mainAbs,
          width: plan.contentCross,
          height: plan.rankMain.get(rank) ?? 0,
        };
        rankBands.push({
          unitKey: group.id,
          rank,
          rect: item.unitDirection === 'TB' ? local : transposeRect(local),
        });
      }
    }

    for (const child of item.children) {
      walk(child, item.unitDirection);
    }
  };
  walk(root, root.unitDirection);

  // 根画布的层带（跨带走线要用），根单元本身没有分组框
  const rootPlan = root.plan!;
  for (const rank of rootPlan.ranks) {
    const local: Rect = {
      x: rootPlan.padCrossStart,
      y: rootPlan.rankMainStart.get(rank) ?? 0,
      width: rootPlan.contentCross,
      height: rootPlan.rankMain.get(rank) ?? 0,
    };
    rankBands.push({
      unitKey: ROOT_UNIT_KEY,
      rank,
      rect: root.unitDirection === 'TB' ? local : transposeRect(local),
    });
  }

  const frame = root.unitDirection;
  const contentCross = crossExtent(root, frame);
  const contentMain = mainExtent(root, frame);

  return {
    nodes,
    groups,
    rankBands,
    nodeMeta,
    content:
      frame === 'TB'
        ? { width: contentCross, height: contentMain }
        : { width: contentMain, height: contentCross },
    maxColumnsUsed: Math.max(1, ctx.stats.maxColumns),
  };
}