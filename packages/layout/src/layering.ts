import type { LayoutDirection, NormalizedGroup, NormalizedSpec } from '@dsh-diagram/schema';
import { MAX_GROUP_LEVELS } from '@dsh-diagram/schema';
import { MAX_RIB_LENGTH } from './tokens';

/** 肋骨绑定：条目被折叠到锚点所在层，并占据簇内第 offset 个位置（锚点自身为 0） */
export interface RibBinding {
  anchorId: string;
  offset: number;
}

/**
 * 一个布局单元内部的分层结果。
 * - `layerOf`：单元的每个「条目」（直接成员节点 / 子分组）的层号（Rank）
 * - `orderOf`：同层条目的排序（Order，已按引力重心排好；肋骨与锚点同值）
 * - `ribOf`：被折叠为行内肋骨的条目 → 其锚点与簇内偏移
 * - `hasEdges`：本单元层级上有没有连线；没有就退化为网格排布
 */
export interface Layering {
  layerOf: Map<string, number>;
  orderOf: Map<string, number>;
  ribOf: Map<string, RibBinding>;
  hasEdges: boolean;
}

/** 根画布（不属于任何分组的节点）对应的单元 key */
export const ROOT_UNIT_KEY = '__dsh_root_unit__';

/** 分组嵌套层级：顶层分组为 0 */
export function groupLevel(groupId: string, groups: NormalizedGroup[]): number {
  let level = 0;
  let cursor = groups.find((group) => group.id === groupId)?.parent;
  while (cursor !== undefined) {
    level += 1;
    cursor = groups.find((group) => group.id === cursor)?.parent;
  }
  return level;
}

/**
 * 每个布局单元的排布方向（用户裁决：逐层交替 + 无连线单元继承父单元）。
 *
 * - 深度 0（根画布：分组之间 / 游离节点）用 `layout.direction`；
 * - 单元内有连线时，在**父单元方向**的基础上翻转（TB ↔ LR）；
 * - 单元内**没有连线**时，不存在拓扑因果、方向只是审美选择，
 *   于是**继承父单元方向**，让子块与父级网格同向 —— 否则同级成员会被竖排成一条、
 *   各带宽度参差（02 的客户端、03 的消费层实测）；
 * - `layout.inner_direction` 显式给 TB / LR 时优先级最高，把深度 ≥ 1 全部钉死。
 *
 * 注意翻转是**相对父单元**而不是「按绝对深度取奇偶」：继承分支会让某个单元的方向
 * 偏离「深度奇偶」的预期（例如深度 1 的无连线单元继承成 TB），此时按奇偶算出的
 * 深度 2 有连线单元仍是 TB，主轴就没有换；按父相对算则必然是 LR，保证相邻两层恒正交。
 */
export function resolveUnitDirections(
  spec: NormalizedSpec,
  layerings: Map<string, Layering>,
): Map<string, LayoutDirection> {
  const flip = (direction: LayoutDirection): LayoutDirection =>
    direction === 'TB' ? 'LR' : 'TB';
  const pinned = spec.layout.innerDirection;
  const base = spec.layout.direction;

  const result = new Map<string, LayoutDirection>();
  result.set(ROOT_UNIT_KEY, base);

  // 父单元的深度必然小于子单元，按深度升序即可保证「先解析父、再解析子」
  const ordered = [...spec.groups].sort(
    (a, b) => groupLevel(a.id, spec.groups) - groupLevel(b.id, spec.groups),
  );
  for (const group of ordered) {
    const parentDirection = result.get(group.parent ?? ROOT_UNIT_KEY) ?? base;
    const hasEdges = layerings.get(group.id)?.hasEdges ?? false;

    if (pinned !== 'auto') {
      result.set(group.id, pinned);
    } else if (hasEdges) {
      result.set(group.id, flip(parentDirection));
    } else {
      result.set(group.id, parentDirection);
    }
  }
  return result;
}

/**
 * 每条连线所用的虚拟轴框架（逐边，而不是全图一套）。
 *
 * 一条边的流向由**包含两端点的最内层单元（LCA 单元）**决定：该单元正是把两端点
 * 分别放进两个条目的那一层，所以它的方向就是这条边的「正向」。同单元内的边用该单元的
 * 方向，跨带的边用根画布的方向。
 */
export function resolveEdgeFrames(
  spec: NormalizedSpec,
  unitDirections: Map<string, LayoutDirection>,
): LayoutDirection[] {
  const unitOfNode = new Map(
    spec.nodes.map((node) => [node.id, node.group ?? ROOT_UNIT_KEY] as const),
  );
  const parentOf = new Map(spec.groups.map((group) => [group.id, group.parent]));

  /** 从某单元的祖先链（由深到浅，末位恒为根单元） */
  const chainOf = (unitKey: string): string[] => {
    const chain = [unitKey];
    let cursor = parentOf.get(unitKey);
    while (cursor !== undefined && !chain.includes(cursor)) {
      chain.push(cursor);
      cursor = parentOf.get(cursor);
    }
    chain.push(ROOT_UNIT_KEY);
    return chain;
  };

  return spec.edges.map((edge) => {
    const from = unitOfNode.get(edge.from) ?? ROOT_UNIT_KEY;
    const to = unitOfNode.get(edge.to) ?? ROOT_UNIT_KEY;
    if (from === to) {
      return unitDirections.get(from) ?? 'TB';
    }
    const ancestors = new Set(chainOf(from));
    const lca = chainOf(to).find((key) => ancestors.has(key)) ?? ROOT_UNIT_KEY;
    return unitDirections.get(lca) ?? 'TB';
  });
}

/**
 * 按布局单元分别分层（design.md §3 Phase 1/2/3）。
 *
 * 为什么不用 ELK（两条都是实测结论）：
 * 1. **全局单次分层**：跨分组的连线会把下游节点的层号外推，导致并行链整体右移错位。
 * 2. **compound + SEPARATE_CHILDREN 的按单元分层**：ELK 会丢弃「跨子单元边界」的边，
 *    于是含子分组的单元（以及根画布）就完全排不出顺序，顶层分组顺序直接反掉。
 *
 * 因此改为自研：对每个单元，把它的条目建成一张 Meta-DAG（边 = 源落在条目 A 子树、目标落在条目 B 子树），
 * 再依次做 破环 → 最长路径分层 → 肋骨折叠 → 层号压缩 → 层内引力重心排序。
 * 确定性、零依赖、且对嵌套分组同样成立。
 */
export function computeUnitLayerings(spec: NormalizedSpec): Map<string, Layering> {
  /** 某分组的全部后代节点（带访问集与深度上限，防止父子引用成环时栈溢出） */
  const descendantCache = new Map<string, Set<string>>();
  const descendantsOf = (
    groupId: string,
    depth = 0,
    visiting: Set<string> = new Set(),
  ): Set<string> => {
    const cached = descendantCache.get(groupId);
    if (cached !== undefined) {
      return cached;
    }
    const result = new Set<string>();
    if (depth <= MAX_GROUP_LEVELS && !visiting.has(groupId)) {
      visiting.add(groupId);
      for (const node of spec.nodes) {
        if (node.group === groupId) {
          result.add(node.id);
        }
      }
      for (const sub of spec.groups.filter((group) => group.parent === groupId)) {
        for (const id of descendantsOf(sub.id, depth + 1, visiting)) {
          result.add(id);
        }
      }
    }
    descendantCache.set(groupId, result);
    return result;
  };

  const subtreeOfItem = (itemId: string, isGroup: boolean): Set<string> =>
    isGroup ? descendantsOf(itemId) : new Set([itemId]);

  const result = new Map<string, Layering>();

  const layerUnit = (unitId: string | undefined): void => {
    const key = unitId ?? ROOT_UNIT_KEY;
    const subGroups = spec.groups.filter((group) => group.parent === unitId);
    const memberNodes = spec.nodes.filter((node) => node.group === unitId);

    // 条目顺序 = 声明顺序：先子分组，再成员节点
    const items: { id: string; isGroup: boolean }[] = [
      ...subGroups.map((group) => ({ id: group.id, isGroup: true })),
      ...memberNodes.map((node) => ({ id: node.id, isGroup: false })),
    ];
    const itemIds = items.map((item) => item.id);
    const declIndex = new Map(itemIds.map((id, index) => [id, index]));

    if (items.length === 0) {
      result.set(key, {
        layerOf: new Map(),
        orderOf: new Map(),
        ribOf: new Map(),
        hasEdges: false,
      });
      return;
    }

    const subtree = new Map(items.map((item) => [item.id, subtreeOfItem(item.id, item.isGroup)]));
    const itemOfNode = new Map<string, string>();
    for (const item of items) {
      for (const nodeId of subtree.get(item.id)!) {
        itemOfNode.set(nodeId, item.id);
      }
    }

    // 条目之间的边：两端落在不同条目上的连线（去重）
    const edges: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const edge of spec.edges) {
      const from = itemOfNode.get(edge.from);
      const to = itemOfNode.get(edge.to);
      if (from === undefined || to === undefined || from === to) {
        continue;
      }
      const edgeKey = `${from}\u0000${to}`;
      if (seen.has(edgeKey)) {
        continue;
      }
      seen.add(edgeKey);
      edges.push([from, to]);
    }

    const dag = breakCycles(itemIds, edges, declIndex);
    const folded = collapseInlineRibs(itemIds, dag, longestPathLayers(itemIds, dag));
    const layers = compactRanks(itemIds, folded.layerOf);
    const orderOf = barycenterOrder(itemIds, dag, layers, folded.ribOf, declIndex);

    result.set(key, {
      layerOf: layers,
      orderOf,
      ribOf: folded.ribOf,
      hasEdges: edges.length > 0,
    });

    for (const sub of subGroups) {
      layerUnit(sub.id);
    }
  };

  layerUnit(undefined);
  return result;
}

/**
 * 入度优先的启发式 DFS 破环（design.md §2 Step 2.1）。
 *
 * 遍历起点按「入度 0 的源头 → 净出度降序 → 声明顺序」排序，
 * 避免双向调用这类环因起点选错而把主干边误判成回边。
 */
function breakCycles(
  itemIds: string[],
  edges: Array<[string, string]>,
  declIndex: Map<string, number>,
): Array<[string, string]> {
  const outgoing = new Map<string, string[]>(itemIds.map((id) => [id, []]));
  const incoming = new Map<string, string[]>(itemIds.map((id) => [id, []]));
  for (const [from, to] of edges) {
    outgoing.get(from)?.push(to);
    incoming.get(to)?.push(from);
  }

  const starts = [...itemIds].sort((a, b) => {
    const aIsSource = (incoming.get(a)?.length ?? 0) === 0 ? 0 : 1;
    const bIsSource = (incoming.get(b)?.length ?? 0) === 0 ? 0 : 1;
    if (aIsSource !== bIsSource) {
      return aIsSource - bIsSource;
    }
    const aNet = (outgoing.get(a)?.length ?? 0) - (incoming.get(a)?.length ?? 0);
    const bNet = (outgoing.get(b)?.length ?? 0) - (incoming.get(b)?.length ?? 0);
    if (aNet !== bNet) {
      return bNet - aNet;
    }
    return (declIndex.get(a) ?? 0) - (declIndex.get(b) ?? 0);
  });

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(itemIds.map((id) => [id, WHITE]));
  const dag: Array<[string, string]> = [];
  const added = new Set<string>();

  const visit = (id: string): void => {
    color.set(id, GRAY);
    for (const next of outgoing.get(id) ?? []) {
      if (color.get(next) === GRAY) {
        continue; // 回边：丢掉，避免成环
      }
      const key = `${id}\u0000${next}`;
      if (!added.has(key)) {
        added.add(key);
        dag.push([id, next]);
      }
      if (color.get(next) === WHITE) {
        visit(next);
      }
    }
    color.set(id, BLACK);
  };
  for (const id of starts) {
    if (color.get(id) === WHITE) {
      visit(id);
    }
  }

  return dag;
}

/** 最长路径初始分层（design.md §2 Step 2.2）：对 DAG 反复松弛到不动点 */
function longestPathLayers(
  itemIds: string[],
  dag: Array<[string, string]>,
): Map<string, number> {
  return relaxLayers(itemIds, dag, new Set());
}

/**
 * 按给定的「被折叠条目集合」重算主干层号（design.md §3.3）。
 * 指向肋骨的那条边不再参与推进，肋骨稍后被强制对齐到锚点层。
 */
function relaxLayers(
  itemIds: string[],
  dag: Array<[string, string]>,
  folded: Set<string>,
): Map<string, number> {
  const layer = new Map<string, number>(itemIds.map((id) => [id, 0]));
  const spine = dag.filter(([, to]) => !folded.has(to));
  for (let round = 0; round <= itemIds.length; round += 1) {
    let changed = false;
    for (const [from, to] of spine) {
      const next = (layer.get(from) ?? 0) + 1;
      if ((layer.get(to) ?? 0) < next) {
        layer.set(to, next);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return layer;
}

/**
 * 肋骨折叠 / 行内收缩（design.md §3 Phase 3）。
 *
 * 候选链必须同时满足守卫 1（同单元，构造上天然成立）与守卫 2
 * （严格单进单出、终点为纯叶子的线性链）。
 *
 * 与 spec 有两点裁决差异：
 * 1. **触发条件放宽到「单元内存在分叉」**。spec 原文要求挂载点本身必须分叉，
 *    否则纯流水线 `A->B->C->D` 的每一段都满足守卫 2，会被误折叠成阶梯外的凸起；
 *    但完全不分叉的单元本来就没有阶梯可消除，整体跳过折叠即可。
 * 2. **不再要求挂载点保留主脊柱**，改用一条总闸把关：
 *    **折叠后仍满足「层数 ≥ 层内最多元素数」（即高 ≥ 宽）才折叠**，否则回滚。
 *    这条总闸消解了 spec 验收用例里 Case 1（要求单出边不折叠）与
 *    Case 2/3（期望值必须折叠单出边链）的自相矛盾。
 */
function collapseInlineRibs(
  itemIds: string[],
  dag: Array<[string, string]>,
  initial: Map<string, number>,
): { ribOf: Map<string, RibBinding>; layerOf: Map<string, number> } {
  const outgoing = new Map<string, string[]>(itemIds.map((id) => [id, []]));
  const incoming = new Map<string, string[]>(itemIds.map((id) => [id, []]));
  for (const [from, to] of dag) {
    outgoing.get(from)?.push(to);
    incoming.get(to)?.push(from);
  }

  /** 追踪「严格单进单出 + 终点为纯叶子」的链；不满足守卫 2 即返回 null */
  const traceChain = (startId: string): string[] | null => {
    const chain: string[] = [];
    let cursor: string | undefined = startId;
    while (cursor !== undefined) {
      if ((incoming.get(cursor)?.length ?? 0) !== 1) {
        return null; // 有外部汇聚边
      }
      const outs: string[] = outgoing.get(cursor) ?? [];
      if (outs.length > 1) {
        return null; // 链上再次分叉
      }
      chain.push(cursor);
      if (chain.length > MAX_RIB_LENGTH) {
        return null; // 守卫 4：单条肋骨链长度上限
      }
      if (outs.length === 0) {
        return chain; // 到达纯叶子终点
      }
      cursor = outs[0];
    }
    return null;
  };

  const candidates: Array<{ anchorId: string; chain: string[] }> = [];
  const hasFork = itemIds.some((id) => (outgoing.get(id)?.length ?? 0) >= 2);
  if (hasFork) {
    for (const id of itemIds) {
      for (const target of outgoing.get(id) ?? []) {
        const chain = traceChain(target);
        if (chain !== null) {
          candidates.push({ anchorId: id, chain });
        }
      }
    }
  }

  const ribOf = new Map<string, RibBinding>();
  /** 已折叠条目 → 锚点，用于把层号对齐过去 */
  const foldedAnchor = new Map<string, string>();
  let layerOf = new Map(initial);

  const profile = (layers: Map<string, number>): { ranks: number; maxRow: number } => {
    const counts = new Map<number, number>();
    for (const id of itemIds) {
      const rank = layers.get(id) ?? 0;
      counts.set(rank, (counts.get(rank) ?? 0) + 1);
    }
    return { ranks: counts.size, maxRow: Math.max(0, ...counts.values()) };
  };

  for (const candidate of candidates) {
    if (foldedAnchor.has(candidate.anchorId)) {
      continue; // 挂载点自身已被折叠，不再作为锚点
    }
    if (candidate.chain.some((id) => foldedAnchor.has(id))) {
      continue; // 链上有条目已被折叠
    }

    candidate.chain.forEach((id, index) => {
      ribOf.set(id, { anchorId: candidate.anchorId, offset: index + 1 });
      foldedAnchor.set(id, candidate.anchorId);
    });

    const layers = relaxLayers(itemIds, dag, new Set(foldedAnchor.keys()));
    for (const [ribId, anchorId] of foldedAnchor) {
      layers.set(ribId, layers.get(anchorId) ?? 0);
    }

    const { ranks, maxRow } = profile(layers);
    if (ranks >= maxRow) {
      layerOf = layers; // 采纳
    } else {
      for (const id of candidate.chain) {
        ribOf.delete(id);
        foldedAnchor.delete(id);
      }
    }
  }

  return { ribOf, layerOf };
}

/** 层号重压缩：消除层内收缩留下的空层号断层，保证层号连续为 0,1,2,... */
function compactRanks(itemIds: string[], layerOf: Map<string, number>): Map<string, number> {
  const occupied = [...new Set(itemIds.map((id) => layerOf.get(id) ?? 0))].sort((a, b) => a - b);
  const remap = new Map(occupied.map((rank, index) => [rank, index]));
  return new Map(itemIds.map((id) => [id, remap.get(layerOf.get(id) ?? 0) ?? 0]));
}

/**
 * 层内引力重心排序（design.md §4 Step 4.1）。
 *
 * 「锚点 + 其肋骨链」视为不可分割的刚体簇；簇间按上层（Rank 更小）前驱簇序号的
 * 均值（Barycenter）升序排列，没有前驱时回落到声明顺序，从而最小化跨层连线交叉。
 */
function barycenterOrder(
  itemIds: string[],
  dag: Array<[string, string]>,
  layerOf: Map<string, number>,
  ribOf: Map<string, RibBinding>,
  declIndex: Map<string, number>,
): Map<string, number> {
  const incoming = new Map<string, string[]>(itemIds.map((id) => [id, []]));
  for (const [from, to] of dag) {
    incoming.get(to)?.push(from);
  }

  const clusterOf = (id: string): string => ribOf.get(id)?.anchorId ?? id;

  const clustersByRank = new Map<number, string[]>();
  for (const id of itemIds) {
    if (ribOf.has(id)) {
      continue; // 肋骨不单独成簇
    }
    const rank = layerOf.get(id) ?? 0;
    const list = clustersByRank.get(rank) ?? [];
    list.push(id);
    clustersByRank.set(rank, list);
  }

  const clusterIndex = new Map<string, number>();
  const ranks = [...clustersByRank.keys()].sort((a, b) => a - b);
  for (const rank of ranks) {
    const clusters = clustersByRank.get(rank)!;
    const weightOf = (clusterId: string): number => {
      const preds = (incoming.get(clusterId) ?? [])
        .map(clusterOf)
        .filter((id) => id !== clusterId && (layerOf.get(id) ?? 0) < rank);
      if (preds.length === 0) {
        return declIndex.get(clusterId) ?? 0;
      }
      return preds.reduce((sum, id) => sum + (clusterIndex.get(id) ?? 0), 0) / preds.length;
    };
    clusters.sort((a, b) => weightOf(a) - weightOf(b) || (declIndex.get(a) ?? 0) - (declIndex.get(b) ?? 0));
    clusters.forEach((id, index) => clusterIndex.set(id, index));
  }

  const orderOf = new Map<string, number>();
  for (const id of itemIds) {
    orderOf.set(id, clusterIndex.get(clusterOf(id)) ?? 0);
  }
  return orderOf;
}