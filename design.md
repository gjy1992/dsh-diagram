# dsh-diagram 自研架构图自动布局算法规范 (Spec v2.0)

> 本文档面向研发执行 Agent，定义了 `@dsh-diagram/layout` 模块的核心算法逻辑、数学模型、边界防御条件及代码实现准则。

---

## 1. 算法目标与核心约束

### 1.1 输入与输出
* **输入 (`NormalizedSpec`)**：
  * `nodes`：节点列表（含 `id`、`title`、`desc`、`items` 接口列表、所属 `group`）。
  * `groups`：分组容器列表（支持通过 `parent` 嵌套，最多 3 层）。
  * `edges`：有向边列表（含 `from`、`to`、`label`、`style`）。
* **输出 (`LayoutResult`)**：
  * 每个节点的相对坐标 `(x, y)`、画布绝对坐标 `(absX, absY)` 与宽高 `(width, height)`。
  * 每个分组的包络矩形坐标与宽高。
  * 每条边的正交折线点序列 `points: Point[]`。

### 1.2 硬性工程约束
1. **零外部布局依赖**：纯 TypeScript 实现，不依赖 ELK.js / Dagre.js。
2. **性能指标**：拓扑规模 $\le 50$ 节点时，全链路布局计算耗时 $< 200\text{ms}$（目标 $< 25\text{ms}$）。
3. **几何防穿透**：任何连线不得穿过非关联节点的矩形区域。
4. **空间紧凑性**：通过“脊柱-肋骨（Spine-and-Rib）行内折叠”消除阶梯状对角线空洞。

---

## 2. 坐标系与虚拟轴模型 (Virtual Axis Model)

算法内部不直接硬编码 `X/Y`，而是采用正交解耦的虚拟双轴 **`(Rank, Order)`**：

1. **`Rank`（主拓扑轴 / 层级轴）**：
   * 严格由有向图的**拓扑因果关系**决定（$\text{Rank} = 0, 1, 2, \dots$）。
   * **严禁**将节点 UI 面积、出入度大小直接混入 `Rank` 计算，防止入口网关等大体积根节点下沉导致箭头逆流。
2. **`Order`（次排列轴 / 层内引力轴）**：
   * 决定同一 `Rank` 层内的节点先后排列顺序。
   * 由**上游父节点的引力重心（Barycenter）**、**伴随链绑定关系**及**节点物理尺寸**共同决定。
3. **默认方向映射（默认采用 `TB` 自上而下模式）**：
   * **`TB` 模式（默认，横向成层、自上而下）**：`Rank` 映射为 **Y 轴（行 Row）**，`Order` 映射为 **X 轴（列 Column）**。
   * **`LR` 模式（纵向成列、从左往右）**：`Rank` 映射为 **X 轴（列 Column）**，`Order` 映射为 **Y 轴（行 Row）**。

---

## 3. 核心算法五步流水线 (5-Phase Pipeline)

### Phase 1: 布局单元树构建与防环保护 (`layering.ts`)

1. **布局单元（Layout Unit）定义**：
   * 每个 `group` 是一个独立的布局单元；根画布（`__dsh_root_unit__`）也是标准布局单元。
   * 单元内的“直接条目（Items）” = 直属该单元的节点 + 直属该单元的子分组。
2. **分组树防死锁保护（Cycle Guard）**：
   * 在递归收集分组后代 `descendantsOf(groupId)` 时，必须维护 `visited: Set<string>` 并限制最大递归深度 `MAX_GROUP_DEPTH = 3`。若检测到循环父子引用，立即截断边以防调用栈溢出。
3. **单元级 Meta-DAG 投影**：
   * 对每个单元，若全局连线 `edge(u, v)` 的起点 `u` 落在条目 A 的子树内，终点 `v` 落在条目 B 的子树内（且 $A \neq B$），则在单元内建立有向边 $A \to B$（去重）。

---

### Phase 2: 启发式破环与初始拓扑分层 (`layering.ts`)

针对每个布局单元内部的 Meta-DAG 执行以下步骤：

#### Step 2.1：入度优先的启发式 DFS 破环 (In-Degree Priority Cycle Breaking)
为避免双向调用（如 `A <-> B`）或环路因遍历起点不当而将主干边误判为回边，DFS 启动顺序必须按以下优先级对条目排序：
1. **第一优先级**：入度为 0 的源头节点（`inDegree === 0`）；
2. **第二优先级**：净出度差值从大到小（`outDegree - inDegree` 降序）；
3. **第三优先级**：YAML 声明顺序（`declarationIndex` 升序）。

按上述顺序执行三色标记 DFS（`WHITE = 0, GRAY = 1, BLACK = 2`），遇到目标节点为 `GRAY` 的边判定为**回边（Back-Edge）**，在分层 DAG 中予以跳过（并标记为 `isBackward = true` 供走线器使用）。

#### Step 2.2：最长路径初始分层 (Longest Path Ranking)
对去环后的 DAG 执行松弛计算：
* 所有无前驱节点的初始层级 $\text{Rank}(u) = 0$；
* 对每条 DAG 边 $(u, v)$，执行松弛：
  $$\text{Rank}(v) = \max(\text{Rank}(v), \text{Rank}(u) + 1)$$

---

### Phase 3: 二次遍历——“脊柱-肋骨”行内收缩优化 (`layering.ts`)

#### 3.1 设计背景与目标
经典最长路径分层遵循“逢边必跨层（$\text{Rank}(v) \ge \text{Rank}(u) + 1$）”，这会导致两类严重排版退化：
1. **分支空洞问题**：当图为 `A -> B, A -> C, C -> D` 时，经典算法排成 `1 / 2 / 1` 的 3 行结构，$B$ 下方出现空洞；理想排布应为 **Row 0: `[A -> B]`，Row 1: `[C -> D]`** 的 $2 \times 2$ 紧凑矩阵。
2. **对角线阶梯问题**：当主干为 `A1 -> B1 -> C1 -> D1 -> E1`，且每级带有子链 `A1 -> A2 -> A3`、`B1 -> B2 -> B3` 时，经典算法会将子链与主干混排成 7 层斜向阶梯；理想排布应为 **$5 \times 3$ 矩阵（主干纵向沉降，子链在同层内横向展开）**。

#### 3.2 肋骨链（Rib Chain）识别与 4 道安全守卫
在初始 `Rank` 计算完成后，对单元内每个具有多个出边的分叉节点（Anchor Node $u$）进行二次遍历，探测其下游分支是否可折叠为**行内伴随链（Inline Rib Chain）**。

候选链 $[w_1, w_2, \dots, w_k]$ 必须**同时满足以下 4 个充要条件**才允许收缩至与 $u$ 同行：

1. **守卫 1：同组边界约束（Same-Unit Guard）**
   链上所有节点 $w_i$ 与挂载点 $u$ 必须归属同一个布局单元（`groupId` 完全一致）。
2. **守卫 2：严格单进单出纯叶子链（Pure Linear Sink Guard）**
   * 链上每个节点 $w_i$ 在本单元 DAG 中的入度必须严格为 1（`inDegree(w_i) === 1`，无外部汇聚边）；
   * 链上每个节点 $w_i$ 的出度必须 $\le 1$（`outDegree(w_i) <= 1`，链上不得再次分叉）；
   * 链尾节点 $w_k$ 的出度必须严格为 0（`outDegree(w_k) === 0`，**绝对禁止连回主干或其他节点**，防止产生反向倒挂斜线）。
3. **守卫 3：主干保留法则（Main Spine Disambiguation）**
   * 对挂载点 $u$ 的所有出边分支计算其**子树总节点数（Descendant Reach）**与**是否含非简单链结构**；
   * **至少保留一条最深/最复杂的分支作为纵向主脊柱（Main Spine）向下延伸**，绝不允许把 $u$ 的所有出边全部折叠为行内链（若 $u$ 只有唯一一条出边链，则保持正常纵向推进，不触发折叠）。
4. **守卫 4：行宽预算与宽高比约束（Width & Aspect Ratio Guard）**
   * 单条肋骨链长度受限：$k \le \text{MAX\_RIB\_LENGTH}$（默认设为 `4`）；
   * 宽高比保护：$1 + k \le \text{TotalMainSpineRanks} + 1$（防止行宽远大于列高导致画布变成扁平长条）；
   * 物理宽度校验：挂载点 $u$ 与链上所有节点的宽度总和 $+$ 间距 $\le \text{CANVAS\_TARGET\_WIDTH}$。

#### 3.3 收缩执行与层号重压缩 (Rank Compaction)
当分支 $[w_1, \dots, w_k]$ 通过上述 4 道守卫后：
1. 将所有 $w_i$ 的层号强制对齐到挂载点：$\text{Rank}(w_i) = \text{Rank}(u)$；
2. 记录绑定元数据：`ribParentOf.set(w_i, u.id)`，`ribOffsetOf.set(w_i, i)`；
3. 对单元内剩余主干节点重新执行一次拓扑层号紧凑化（消除因拔出子链可能留下的空层号断层，确保层号连续为 $0, 1, 2, \dots$）。

---

### Phase 4: 引力重心排序与坐标分配 (`placement.ts`)

#### Step 4.1：基于引力重心（Barycenter）的同层排序
在每一层 `Rank = r` 中，可能存在多个主干节点（及各自挂载的肋骨链）。为最小化跨层连线交叉，将“主干节点 $u$ + 其伴随链 $[w_1, \dots, w_k]$”视为一个不可分割的**水平刚体簇（Cluster）**：

1. **计算簇的引力重心权重 `weight(u)`**：
   * 找出 $u$ 在上层（$\text{Rank} < r$）的所有前驱节点 $P(u)$；
   * 若 $P(u)$ 非空：
     $$\text{weight}(u) = \frac{1}{|P(u)|} \sum_{p \in P(u)} \text{OrderIndex}(p)$$
   * 若 $P(u)$ 为空（该层的新源头）：以 YAML 声明顺序作为兜底权重。
2. **簇内与簇间排序**：
   * 同一层内的各个簇按 `weight(u)` 升序排列（从左到右）；
   * 每个簇内部严格按 `[u, w_1, w_2, ..., w_k]` 紧邻排列。

#### Step 4.2：自底向上尺寸测量与坐标投影
1. **去除根画布强制堆叠锁**：
   * **重要修正**：根画布（`ROOT_UNIT_KEY`）**禁止**硬编码 `stack: true`。根画布必须与其他单元一样，直接依据 `rootLayering` 的 `(Rank, Order)` 排布，从而支持“左侧分组框、右侧游离节点”或“上下分层分组”的自然拓扑呈现。
2. **尺寸计算**：
   * 节点宽度固定 `NODE_WIDTH = 240`，高度 `height = 40 + items.length * 22 + 16`（无 `items` 时为 `48`）。
   * 在 `TB` 模式下：
     * 每一行（同一 `Rank`）的高度 `rowHeight = max(item.height)`；
     * 每一行的宽度 `rowWidth = sum(item.width) + (count - 1) * COLUMN_GAP`；
     * 行内条目水平依次排开，垂直方向默认顶对齐（`relY = rowTop`）。
     * 分组框尺寸：包裹内部所有行的最大宽度与总高度，加上 `UNIT_PADDING_X`、`UNIT_HEADER_HEIGHT` 与 `UNIT_PADDING_BOTTOM`。

---

### Phase 5: 正交走廊走线算法 (`routing.ts`)

为满足“连线绝不穿透节点矩形”的硬约束，走线器根据边的类型分三路通道（Channel Routing）处理：

```text
               ┌─────────────────────────────────┐
               │       [ Node U ] ──(1)──► [W1]  │  (1) 同行肋骨边：直接水平直连
               └───────────┬─────────────────────┘
                           │
═══════════════════════════╪══════════════════════════  ◄── 水平走廊 (ROW_GAP)
                           └─────────┐ (Lane k)
                                     ▼
                                ┌──────────┐
                                │  Node V  │            (2) 跨行正向边：走水平走廊分道
                                └──────────┘
```

1. **类型 A：同行伴随边（Inline Rib Edge，$\text{Rank}(u) === \text{Rank}(v)$ 且相邻）**
   * **走线方式**：从起点右侧中心 `(u.absX + u.width, u.absY + u.height / 2)` 直接水平连向终点左侧中心 `(v.absX, v.absY + v.height / 2)`。
   * **拐点数**：0（纯水平直线）。

2. **类型 B：相邻层正向边（Adjacent Forward Edge，$\text{Rank}(v) === \text{Rank}(u) + 1$）**
   * **走线方式**：
     * 起点端口：`u` 的底边中心 `(u.centerX, u.bottom)`；
     * 终点端口：`v` 的顶边中心 `(v.centerX, v.top)`；
     * 中间走廊：在两行之间的 `ROW_GAP` 空白带内进行水平折线过渡。
   * **多线分道（Lane Indexing）**：
     统计共用同一个 `ROW_GAP` 的所有折线，按起止 X 坐标分配独立车道号 `laneIndex`，计算水平段 Y 坐标：
     $$Y_{\text{lane}} = \text{RowBottom} + \frac{\text{ROW\_GAP}}{\text{totalLanes} + 1} \times (\text{laneIndex} + 1)$$

3. **类型 C：跨多层正向边与逆向回边（Long-Span / Backward Edge）**
   * 当 $\text{Rank}(v) - \text{Rank}(u) > 1$（中间隔了其他行）或 $\text{Rank}(v) \le \text{Rank}(u)$（回边）时，若直线下穿必撞击中间层节点。
   * **走线方式（安全垂直走廊 / 外围栏杆绕行）**：
     * 从起点引出至当前行的 `ROW_GAP`；
     * 横向移动至不与任何节点 X 区间重叠的**垂直列间隙（`COLUMN_GAP`）**或**单元最外侧安全栏杆（Left/Right Railing）**；
     * 沿垂直安全通道直达目标行上方的 `ROW_GAP`，再折入目标节点顶边端口。

---

## 4. 核心代码实现参考 (供 Agent 落地对齐)

### 4.1 `layering.ts` 中的肋骨折叠核心逻辑

~~~typescript
export interface RibBinding {
  anchorId: string;
  offset: number;
}

export interface Layering {
  layerOf: Map<string, number>;
  orderOf: Map<string, number>;
  ribOf: Map<string, RibBinding>;
  hasEdges: boolean;
}

const MAX_RIB_LENGTH = 4;

/**
 * 二次遍历：识别并折叠满足安全约束的单向叶子伴随链（Spine-and-Rib Inlining）
 */
export function collapseInlineRibs(
  itemIds: string[],
  dagEdges: Array<[string, string]>,
  layerOf: Map<string, number>,
): Map<string, RibBinding> {
  const ribOf = new Map<string, RibBinding>();
  const outgoing = new Map<string, string[]>(itemIds.map((id) => [id, []]));
  const incoming = new Map<string, string[]>(itemIds.map((id) => [id, []]));

  for (const [from, to] of dagEdges) {
    outgoing.get(from)?.push(to);
    incoming.get(to)?.push(from);
  }

  // 追踪严格单进单出且终点为纯叶子的链
  const traceLinearSinkChain = (startId: string): string[] | null => {
    const chain: string[] = [];
    let cursor: string | undefined = startId;

    while (cursor !== undefined) {
      // 守卫：入度必须严格为 1，出度必须 <= 1
      if ((incoming.get(cursor)?.length ?? 0) !== 1) return null;
      const outs = outgoing.get(cursor) ?? [];
      if (outs.length > 1) return null;

      chain.push(cursor);
      if (chain.length > MAX_RIB_LENGTH) return null;

      if (outs.length === 0) {
        return chain; // 到达纯叶子终点
      }
      cursor = outs[0];
    }
    return null;
  };

  // 计算子树可达节点数，用于区分“主脊柱”与“旁路肋骨”
  const reachSize = (startId: string): number => {
    const visited = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      for (const next of outgoing.get(curr) ?? []) {
        stack.push(next);
      }
    }
    return visited.size;
  };

  for (const id of itemIds) {
    if (ribOf.has(id)) continue; // 已被折叠为肋骨的节点不再作为挂载点
    const outs = outgoing.get(id) ?? [];
    if (outs.length < 2) continue; // 只有发生分叉时才存在“主干 vs 肋骨”分离

    // 找出哪条分支是主脊柱（不可被折叠）：取子树规模最大、或非纯线性链的分支
    const branchMeta = outs.map((targetId) => ({
      targetId,
      chain: traceLinearSinkChain(targetId),
      reach: reachSize(targetId),
    }));

    // 按 (是否非纯链优先, 可达规模降序) 排序，排第一的锁定为主脊柱
    branchMeta.sort((a, b) => {
      const aIsComplex = a.chain === null ? 1 : 0;
      const bIsComplex = b.chain === null ? 1 : 0;
      if (aIsComplex !== bIsComplex) return bIsComplex - aIsComplex;
      return b.reach - a.reach;
    });

    const spineTargetId = branchMeta[0].targetId;
    let currentOffset = 1;

    // 其余满足纯线性叶子链的分支，折叠到当前锚点同行
    for (const branch of branchMeta) {
      if (branch.targetId === spineTargetId) continue;
      if (branch.chain !== null) {
        for (const ribNodeId of branch.chain) {
          ribOf.set(ribNodeId, { anchorId: id, offset: currentOffset });
          currentOffset += 1;
        }
      }
    }
  }

  // 重新松弛主干节点的层号（忽略已被折叠为肋骨的边），再将肋骨层号对齐到锚点
  const spineEdges = dagEdges.filter(([_, to]) => !ribOf.has(to));
  for (const id of itemIds) {
    layerOf.set(id, 0);
  }
  for (let round = 0; round <= itemIds.length; round += 1) {
    let changed = false;
    for (const [from, to] of spineEdges) {
      const nextLayer = (layerOf.get(from) ?? 0) + 1;
      if ((layerOf.get(to) ?? 0) < nextLayer) {
        layerOf.set(to, nextLayer);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 将肋骨节点的层号强制绑定到其 Anchor 的层号
  for (const [ribId, binding] of ribOf.entries()) {
    layerOf.set(ribId, layerOf.get(binding.anchorId) ?? 0);
  }

  return ribOf;
}
~~~

---

## 5. 单元测试验收用例 (Acceptance Test Cases)

执行 Agent 在完成编码后，必须编写并通过以下 4 个核心拓扑用例：

1. **Case 1（线性流水线）**：`A -> B -> C -> D`
   * **预期**：由于没有任何节点存在分叉（`outs.length < 2`），不触发肋骨折叠，生成 4 行 1 列的纯垂直分布。
2. **Case 2（2x2 伴随矩阵）**：`A -> B, A -> C, C -> D`（其中 `D` 带有旁路或 `C` 识别为主干）
   * **预期**：`B` 被识别为 `A` 的同行伴随节点，`D` 被识别为 `C` 的同行伴随节点，输出 2 行 2 列矩阵，无空洞、无斜线。
3. **Case 3（5x3 脊柱-肋骨矩阵）**：`A1->A2->A3`, `B1->B2->B3` ... `E1->E2->E3` 且 `A1->B1->C1->D1->E1`
   * **预期**：`A1..E1` 识别为纵向主脊柱（Col 0，Row 0..4），每级的 `X2->X3` 折叠为同行肋骨（Col 1..2），输出标准 $5 \times 3$ 网格，所有连线均为水平或垂直直线，交叉数为 0。
4. **Case 4（菱形汇聚防御测试）**：`A -> B -> D` 且 `A -> C -> D`
   * **预期**：由于 `D` 的入度为 2（违反守卫 2 的 `inDegree === 1`），`B` 的终点非纯叶子，禁止触发行内折叠，安全回退至标准 `1 / 2 / 1` 菱形分层，不产生逆向倒灌连线。