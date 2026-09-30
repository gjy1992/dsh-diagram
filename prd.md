# 需求规格说明书 (PRD)：dsh-diagram 架构图生成与 draw.io 导出插件

| 文档版本 | 创建时间 | 负责人 | 状态 | 适用项目 |
| :--- | :--- | :--- | :--- | :--- |
| v1.0.0 | 2026-09-30 | Core Architecture Team | Draft | DeepSeek Harness (`dsh`) 插件生态 |
| v1.1.0 | 2026-09-30 | Core Architecture Team | Draft | 同上（同步 Phase 1 实施决策：嵌套分组、高度公式、样式映射表、画布自适应、mxfile 容器） |
| v1.2.0 | 2026-09-30 | Core Architecture Team | Draft | 同上（布局架构调整：ELK 只管分层，坐标 / 折行 / 分组包络 / 正交走线改为引擎自研；新增 `layout.max_columns`） |
| v1.3.0 | 2026-09-30 | Core Architecture Team | Draft | 同上（ELK 经实测评估后**完全移除**：改为按单元建条目 DAG + 最长路径的自研分层；`max_columns` 语义修正为"每行几列/几层"、缺省 auto） |
| v1.4.0 | 2026-09-30 | Core Architecture Team | Draft | 同上（布局算法升级到 Spec v2.0：虚拟双轴 `(Rank, Order)`、入度优先破环、**脊柱-肋骨行内折叠**、引力重心层内排序、三类型通道走线；新增 `layout.direction`，TB 与 LR 双向支持） |
| v1.5.0 | 2026-09-30 | Core Architecture Team | Draft | 同上（**方向改为逐层交替**：第 0 层用 `layout.direction`，嵌套分组有内部连线时每深一层 TB↔LR 交替、无内部连线时继承父单元方向；新增 `layout.inner_direction` 逃生口；走线改为**逐边定框架**） |

---

## 1. 项目背景与问题陈述

### 1.1 背景
在系统设计和技术方案评审中，研发人员高度依赖清晰、规范的架构拓扑图（如微服务调用关系、模块分层、RPC 接口暴露关系等）。目前大语言模型在消费级前端已普及了基础 Mermaid 图表生成，但在专业研发场景（如研发 Agent 工具链 `dsh`）中，现有图表生成机制存在明显短板。

### 1.2 现有痛点
1. **直接输出 draw.io XML 成本极高且效果差**：
   draw.io 底层基于绝对坐标 `(x, y, width, height)` 和精确的几何锚点。大模型空间感知计算能力极弱，直接生成 XML 会严重浪费 Token（成千上万个转义字符），且极易导致节点重叠、连线穿模、布局混乱。
2. **原生 Mermaid 表现力受限**：
   Mermaid 原生语法对“卡片内嵌结构化列表（如 RPC 接口明细、多行元数据）”支持较弱，难以还原工业级、深色主题的高级卡片质感。
3. **基于聊天流的纯前端拦截渲染缺乏自愈闭环**：
   如果 AI 在流式文本中输出 DSL，一旦发生语法错误或外键引用丢失，前端直接报错白屏，处于 Agent 状态机循环中的大模型无法感知错误，失去自我纠错（Self-Correction）机会。

---

## 2. 产品目标与设计原则

### 2.1 核心目标
为 `dsh`（DeepSeek Harness）打造一款官方推荐的架构图插件 `dsh-diagram`：
* **语义化抽象**：设计一套专为 AI 生成架构图优化的极简 YAML DSL，实现数据与样式的彻底解耦。
* **工具闭环（Tool-First）**：采用 Tool Calling 机制输出图表，内置结构校验器，支持模型语法自愈。
* **程序化自动排版**：布局全自动，模型不参与任何几何决策。分层、坐标分配、折行、分组包络、正交走线全部由引擎自研完成，且不依赖任何图布局库（详见 §4.1.3）。
* **双通道交付物**：在 `dsh-web` 界面实时渲染深色交互式 SVG 画布，并提供一键导出原生 `.drawio` XML 文件供后续人工精修。

### 2.2 设计哲学
* **Zero-Token Styling（零样式 Token 开销）**：颜色、字体、边框、折线算法等全部内置缺省值，禁止模型在非业务字段上浪费注意力。
* **单向引用与扁平化（Flat Adjacency）**：节点仅通过 `group: <id>` 单向声明归属，严禁使用复杂的 `children: [...]` 数组，杜绝模型产生数组维护遗漏。
* **交付物生命周期（Deliverable Artifact）**：图表作为独立工件（Card/Panel）挂载，支持持久化、缩放与文件导出。

---

## 3. 系统整体架构与数据流

```text
[用户 Prompt] 
      │ (例如："画出剧情演出的消费与编排架构图，包含 RPC 列表")
      ▼
[dsh Agent (LLM)]
      │ 
      ├─► 调用 Tool: render_architecture({ title, yaml_spec })
      │
[dsh-diagram Plugin 后端]
      │
      ├─► ① Ajv / JSON Schema 语法与字段校验
      ├─► ② 拓扑完整性校验 (检查 from/to/group 外键是否存在)
      │     │
      │     ├─ 校验失败 ──► 抛出 ToolError 回传给 LLM（触发自愈重试）
      │     └─ 校验通过 ──► 返回标准 Success 状态并透传 AST 给前端
      ▼
[dsh-web 前端运行时]
      │
      ├─► ③ 尺寸预估器：根据 title + desc + items 长度动态计算 Node 宽高
      ├─► ④ 布局计算层（细节见 §4.1.3）：
      │      a. 分层：按布局单元建「条目 Meta-DAG」→ 入度优先破环 → 最长路径分层
      │      b. 行内收缩：脊柱-肋骨折叠（含「层数 ≥ 层内最多元素数」总闸）+ 层号重压缩
      │      c. 排序：层内引力重心（Barycenter）排序，锚点与肋骨链作为刚体簇
      │      d. 坐标分配：虚拟双轴 (Rank, Order) → 列槽位对齐矩阵 → 分组包络框
      │      e. 正交走线：三类型通道（同行直连 / 层间分道 / 跨层与回边栏杆绕行）
      │     │
      ├─────┴─────────────────────────┐
      ▼                               ▼
[交付物 A: SVG 渲染引擎]          [交付物 B: draw.io XML 生成器]
  - 深色卡片质感 (暗底微光)          - 映射为 mxGraphModel XML
  - 正交平滑折线                    - 嵌入容器与 HTML 文本
  - 缩放/拖拽 (Pan/Zoom)            - 提供「下载 .drawio」按钮

  ### 4. 详细功能规格

#### 4.1 DSL 规范设计 (YAML Schema)

##### 4.1.1 顶层结构
version: "1.0"           # [可选] Schema 版本，缺省 1.0
meta:                    # [可选] 全局信息面板
  title: string          # 画布大标题
  desc: string           # 画布副标题 / 模块路径
  summary: string        # 核心职责摘要
  guide: string          # 阅读导语（说明数据流方向）

layout:                  # [可选] 全局布局偏好；不给就用内置缺省
  max_columns: number    # [可选] 无连线单元铺网格时每行最多容纳几条目，1..8，缺省 auto（取近似正方形 √n）
  direction: string      # [可选] 第 0 层（分组之间 / 游离节点）的方向，缺省 "TB"（自上而下），可选 "LR"
  inner_direction: string # [可选] 嵌套分组内部的方向，缺省 "auto"（每深一层 TB↔LR 交替），也可钉死 "TB" / "LR"

groups:                  # [可选] 分组容器列表
  - id: string           # [必填] 分组唯一 ID
    title: string        # [必填] 分组显示名称
    variant: string      # [可选] 默认 "dashed"（虚线透明框），可选 "filled"
    parent: string       # [可选] 所属上级分组 ID。缺省表示位于根画布；支持嵌套，最深 3 层

nodes:                   # [必填] 卡片节点列表
  - id: string           # [必填] 节点唯一 ID
    title: string        # [必填] 节点主标题（加粗显示）
    group: string        # [可选] 所属分组 ID（可指向任意层级的分组）。缺省表示位于根画布
    desc: string         # [可选] 节点小字描述
    variant: string      # [可选] 语义风格，默认 "default"，可选 "primary" | "danger" | "warning" | "muted"
    items: string[]      # [可选] 属性或 RPC 接口列表（动态扩展高度）

edges:                   # [必填] 连线调用列表
  - from: string         # [必填] 起始节点 ID
    to: string           # [必填] 目标节点 ID
    label: string        # [可选] 线上展示的业务说明
    style: string        # [可选] 默认 "solid"，可选 "dashed" | "bidirectional"

##### 4.1.2 尺寸与布局预设规则

**嵌套声明方式（与上述「单向引用与扁平化」哲学一致）**

分组嵌套**不使用 `children` 数组**，而是每个分组用 `parent` 单向声明自己的上级；节点用 `group` 声明归属（可指向任意层级）。模型只需回答"我属于谁"，无需维护任何数组。

**节点卡片尺寸**

* 节点宽度：统一固定为 240px（超出文本自动折行）。
* 节点高度计算公式（对旧版 `40 + 22n + 16` 公式的收敛，消除"无 items 时 56 与 48 矛盾"）：

  ```text
  height = max(48, Padding(20) + TitleLine(24) + (desc ? DescLine(20) : 0)
                   + (items 非空 ? Separator(14) : 0) + items.length * ItemLine(22))
  ```

  即以 48px 为最小高度下限；无 desc 且无 items 时取 48px。
* 字号与行高（行高按 draw.io HTML 标签的**实际渲染行距**取值；若沿用裸字号作行高，文字会溢出卡片底部，已实测确认）：

  | 元素 | 字号 | 行高 | 对齐 |
  | :--- | :--- | :--- | :--- |
  | `node.title` | 14px / bold | 24px | 居中 |
  | `node.desc` | 12px / normal | 20px | 居中，紧随 title 下一行 |
  | `node.items` | 12px | 22px | 左对齐，区块前置 `<hr>` 分隔线（占 14px） |

* 分组框（Group）尺寸：**由引擎自研计算**（分组不再作为布局容器，见 §4.1.3）。

##### 4.1.3 布局算法（全自研，零图布局依赖，Spec v2.0）

算法细节的权威定义见仓库根目录 `design.md`（Spec v2.0）；本节记录落地到 `@dsh-diagram/layout` 的口径。

**虚拟双轴模型（Virtual Axis Model）**

引擎内部不直接硬编码 X/Y，而是先解耦成一对正交虚拟轴：

* **`Rank`（主轴 / 拓扑轴）**：严格由有向拓扑因果决定（`Rank = 0,1,2,...`），绝不把节点面积、出入度混进 `Rank`，避免大体积根节点下沉导致箭头逆流。
* **`Order`（次轴 / 层内引力轴）**：决定同一 `Rank` 内的先后顺序，由上层前驱的重心（Barycenter）与伴随链绑定关系决定。
* **方向逐层交替（用户裁决）**：
  * **深度 0**（根画布：分组之间 / 游离节点）用 `layout.direction`，缺省 `TB`；
  * **单元内有连线**：在**父单元方向**的基础上翻转（TB ↔ LR），于是相邻两层的主轴恒正交，画布纵横比自然均衡（否则 05 会退化成 560×2664 的竖长条）；
  * **单元内没有连线**：不存在拓扑因果、方向只是审美选择，于是**继承父单元方向**，让子块与父级网格同向 —— 否则同级成员会被竖排成一条、各带宽度参差（02 的客户端带、03 的消费层实测）；
  * 翻转是**相对父单元**而非「按绝对深度取奇偶」：继承分支会让某层偏离奇偶预期，此时按奇偶算的下一层会与父层同向、主轴没换；父相对则保证相邻两层恒正交；
  * `layout.inner_direction` 显式给 `TB` / `LR` 时优先级最高，把深度 ≥ 1 全部钉死成该方向。
* 分层与排序算法本身**与方向完全解耦**；方向只在两处生效：单元内部坐标映射（`placement`），以及走线的「逐边框架」选择（`routing`）。

**布局单元（Unit）**：每个分组是一个布局单元；不属于任何分组的节点构成根单元。单元内部可同时包含「直接成员节点」与「子单元」，两者统一称为**条目（Item）**。

**Phase 1 · 单元级 Meta-DAG 投影**
* 对每个单元，若存在一条连线，其源落在条目 A 的子树内、目标落在条目 B 的子树内（A≠B），则连一条 `A → B` 的边（去重）。
* 递归收集分组后代时维护 `visited` 访问集与最大深度（3 层），防止父子引用成环时栈溢出。

**Phase 2 · 入度优先破环 + 最长路径分层**
* 三色 DFS 破环，**遍历起点顺序**为：① 入度 0 的源头 → ② 净出度 `out-in` 降序 → ③ YAML 声明顺序。这样双向调用这类环不会因起点选错而把主干边误判为回边。
* 对去环后的 DAG 做最长路径松弛：`Rank(v) = max(Rank(v), Rank(u) + 1)`，无前驱者为 0。

**Phase 3 · 脊柱-肋骨行内折叠（消除阶梯空洞）**
* 在分叉单元里，把满足「严格单进单出 + 终点为纯叶子」的伴生链折叠到挂载点同行（单链长度 ≤ `MAX_RIB_LENGTH = 4`）。
* **总闸（高 ≥ 宽）**：折叠后必须仍满足 `层数 ≥ 层内最多元素数`，否则回滚。这条闸门同时消除了 `design.md` 验收用例中 Case 1（要求单出边不折叠）与 Case 2/3（期望值必须折叠单出边链）的自相矛盾。
* 折叠完成后**重压缩层号**（消除拔链留下的空层断层），保证层号连续。
* 效果：`A→B, A→C, C→D` 排成 2×2 矩阵而非 `1/2/1` 阶梯；`A1→B1→…→E1` 主干配 `X1→X2→X3` 子链时排成 `5×3` 网格而非 7 层斜阶梯。

**Phase 4 · 引力重心排序 + 坐标分配**
* 「挂载点 + 其肋骨链」视为不可分割的**刚体簇**；簇间按上层前驱簇序号的均值（Barycenter）升序排列，无前驱时回落到声明顺序。
* 每个单元按「层带 × 列槽位」摆成对齐矩阵：同一簇序号在所有层共用一列（列宽取各层同序号簇的最大值），因此主干天然对齐成列、稀疏层不会被拉歪。
* 单元尺寸 = 各层带包围盒 + 内边距（组标题侧 36px，其余侧各 20px；TB 下即上 36/左右下 20）。
* 单元内没有连线时不存在拓扑因果 → 退化为**网格**：按 `max_columns` 折行，`auto` 取近似正方形 `⌈√n⌉`。
* 根画布**不再强制堆叠**：它与其它单元一样按自身的 `(Rank, Order)` 排布，于是「顶层分组自上而下成带」是分层算出来的结果而不是硬编码。

**Phase 5 · 正交走廊走线（三类型通道）**
* **类型 A · 同行伴随边**（同单元同层）：直接水平（TB）/ 垂直（LR）直连，0 拐点。
* **类型 B · 相邻层正向边**：下出 → 层间走廊按车道分道 → 上入。共用同一个层间走廊的折线按起止次轴坐标分配独立车道号，车道 Y 在走廊内均匀分布。
* **类型 C · 跨多层正向边与逆向回边**：先下潜到**安全垂直走廊**（预先按全部节点的次轴区间算出的列间隙，或左右外侧栏杆），沿走廊纵向移动；跨层时借**整图顶部栏杆**横穿，最后在目标层上方的层间隙内折入目标顶边。
  绕行一律「先下潜再纵向移动」，而不是从源节点侧面直接横穿——侧向横穿必然扫到同排邻居节点（实测修正）。
* 每条边按候选优先级逐个尝试，先做「节点碰撞检测」再做「与既有连线重叠检测」，取第一条通过的；全部失败则放宽为只查碰撞再试一轮；仍无解才接受一条穿模路径（保证每条边一定有折线可用）。
* **逐边定框架**：逐层交替后全图不再有唯一的虚拟轴，因此每条边单独定一个「走线框架」—— 由**包含两端点的最内层单元（LCA 单元）**的方向决定（同带内的边用带内方向、跨带的边用第 0 层方向）。跑候选逻辑前把节点矩形 / 层带 / 走廊变换进该框架，输出点再变换回物理坐标。转置只翻转线段轴标签、数值不变，因此「已占用线段」统一按物理口径存放、比较时按当前边翻转即可，候选逻辑本身零改动。
* `LR` 下走线器无需第二套代码：转置保持正交性与碰撞关系。

**布局间距预设**

| 项 | 值 |
| :--- | :--- |
| 层间距 `RANK_GAP`（虚拟轴主轴：相邻 Rank） | 48px |
| 层内间距 `CROSS_GAP`（虚拟轴次轴：同层相邻条目/簇内肋骨） | 40px |
| 带间距 `UNIT_GAP`（单元内装分组时，兼作跨带走线通道） | 56px |
| 单元内边距 | 组标题侧 36px / 其余侧 20px |
| 单条肋骨链长度上限 `MAX_RIB_LENGTH` | 4 |
| 车道间距 `LANE_STEP` | 8px |
| 相邻层正向判定上限 `MAX_LANE_GAP` | 200px |
| 外侧通道间距 `OUTER_CHANNEL_GAP` | 24px |
| 顶部栏杆预留高度 | 28px |
| 画布外边距 | 40px（用于画布尺寸自适应） |


#### 4.2 Tool 契约定义 (Tool Spec)

插件需向 dsh 宿主注册标准工具：

{
  "name": "render_architecture",
  "description": "渲染深色卡片式系统架构图并生成可导出的 draw.io 文件。严禁输出坐标和十六进制色值，严格输出符合规范的 YAML 字符串。",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "架构图总标题"
      },
      "yaml_spec": {
        "type": "string",
        "description": "完整的架构拓扑 YAML 描述文本"
      }
    },
    "required": ["title", "yaml_spec"]
  }
}


#### 4.3 校验与自愈机制 (Validation & Self-Correction)

在 Tool 执行器中执行两道严格的静态校验。一旦出错，立即将带有清晰上下文的错误信息抛回给 Agent，促使模型纠错重试：

1. Schema 结构校验：
   * 检查 nodes 和 edges 是否为数组且非空。
   * 检查 id 是否重复。
2. 拓扑外键引用校验：
   * 若 node.group 不为空，校验其是否存在于 groups 的 ID 集合中（可指向任意层级分组）。
   * 校验 edge.from 与 edge.to 是否均存在于 nodes 的 ID 集合中。
   * 错误回显样例："ValidationError: edge source 'single_playr' is not defined in nodes list. Did you mean 'single_player'?"
3. 分组层级校验（嵌套支持）：
   * 若 group.parent 不为空，校验其是否存在于 groups 的 ID 集合中。
   * 校验 group.parent 不可自引用（id === parent）。
   * 校验 group.parent 链路不可成环（DFS 环检测）。
   * 校验嵌套深度不超过 3 层，超出则报错。


#### 4.4 前端交互与导出功能 (Web Client)

在 dsh-web 端挂载专用渲染器组件：

##### 4.4.1 视图渲染（SVG Preview）
* 视觉主题：
  * 背景基色：深色（如 #0b132b / #0f172a）。
  * 卡片默认背景：#1e293b，高亮边框：#10b981（Emerald Green）或 #38bdf8（Sky Blue）。
  * 分组容器：透明背景，边框为 #334155 虚线。
* 交互特性：
  * 支持鼠标滚轮缩放画布（Zoom In/Out）和按住拖动画布（Pan）。
  * 悬浮在节点上高亮其直接相连的入边和出边。

##### 4.4.2 draw.io XML 导出引擎
前端在获取到 ELK.js 计算出的坐标对象后，执行转换逻辑：
1. 生成文件结构：
   * 外层使用标准**无压缩** `.drawio` 容器（`<mxfile>` + `<diagram>`），确保 draw.io Web 端（app.diagrams.net）与桌面端 / VS Code 扩展都能直接打开：
     `<mxfile host="dsh-diagram" agent="dsh-diagram/0.1.0" type="device"><diagram id="page-1" name="Page-1">…</diagram></mxfile>`
   * 内层为未压缩的 `mxGraphModel`（明文，不使用 deflate / base64）：
     `<mxGraphModel dx="0" dy="0" grid="1" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${自适应}" pageHeight="${自适应}" background="#0f172a">`，其下必须包含 `<root>`，首两个 cell 固定为 `<mxCell id="0"/>` 与 `<mxCell id="1" parent="0"/>`。
   * **画布尺寸自适应**：`pageWidth` / `pageHeight` 按布局结果边界盒 `bounds` 外扩 40px 边距计算，替代固定的 1920×1080。
2. 容器与节点映射：
   * 分组节点：生成 `<mxCell id="${g.id}" value="${g.title}" vertex="1" style="container=1;collapsible=0;rounded=1;dashed=1;strokeColor=#334155;fillColor=none;fontColor=#94a3b8;align=left;verticalAlign=top;spacingLeft=10;spacingTop=5;" parent="${g.parent ?? 1}">`。
     * 嵌套支持：`parent` 设为上级分组 ID，仅顶层分组使用 `"1"`；坐标为相对上级容器。
   * 卡片节点：转换为 HTML 格式的 value（见 §4.4.4），并将 parent 属性设为对应的 group.id（若无则设为 "1"）。
   * **输出顺序约束**：父 cell 必须先于其子 cell 声明；**连线最早输出**（mxGraph 按声明顺序决定绘制层级，后声明的在上层），使节点与分组覆盖连线，避免连线压住卡片文字。
3. 连线映射：
   生成 `<mxCell edge="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;fontColor=#cbd5e1;labelBackgroundColor=#152238;" source="${edge.from}" target="${edge.to}" parent="1">`。
   * `labelBackgroundColor` 是必需的：draw.io 连线标签默认白底，深色主题下浅色文字会几乎不可读（已实测确认）。
   * 折线路径写入**引擎自研路由器**（§4.1.3 Step 5）算出的显式 `<Array as="points">`：画布绝对坐标，只含中间拐点（首尾由 source/target 连接点决定）。
   * 按 `edge.style` 追加样式片段，见 §4.4.3。
4. 下载动作：
   生成无压缩明文 XML，触发浏览器下载为 ${title}.drawio 文件，确保用户可直接在 draw.io 客户端中打开二次精修。

##### 4.4.3 样式映射表（深色主题）

**节点卡片**（基础 style：`rounded=1;whiteSpace=wrap;html=1;`）

| variant | fillColor | strokeColor | fontColor | 语义 |
| :--- | :--- | :--- | :--- | :--- |
| `default` | #1e293b | #334155 | #e2e8f0 | 普通模块 |
| `primary` | #0c4a6e | #38bdf8 | #e0f2fe | 核心 / 入口模块 |
| `danger` | #4c1d24 | #f87171 | #fee2e2 | 风险 / 故障点 / 待下线 |
| `warning` | #4a3712 | #fbbf24 | #fef3c7 | 待治理 / 观察项 |
| `muted` | #1e293b | #334155 | #64748b | 弱化 / 边缘模块 |

**分组容器**（基础 style：`container=1;collapsible=0;rounded=1;fontColor=#94a3b8;align=left;verticalAlign=top;spacingLeft=10;spacingTop=5;`）

| variant | strokeColor | fillColor | dashed |
| :--- | :--- | :--- | :--- |
| `dashed`（默认） | #334155 | none | 1 |
| `filled` | #334155 | #111c33 | 0 |

**连线**（基础 style：`edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;fontColor=#cbd5e1;`）

| style | 追加片段 |
| :--- | :--- |
| `solid`（默认） | `endArrow=classic;endFill=1;` |
| `dashed` | `endArrow=classic;endFill=1;dashed=1;dashPattern=8 4;` |
| `bidirectional` | `startArrow=classic;startFill=1;endArrow=classic;endFill=1;` |

##### 4.4.4 卡片文本层次

`node.desc` 紧随 `node.title` 下一行、**居中**显示、字号小于标题。HTML value 结构：

```html
<b>节点标题</b><br/><font size="1">节点描述</font><hr/><font size="1">rpc:OrderQuery</font><br/><font size="1">rpc:OrderCreate</font>
```


---

### 5. System Prompt 示例模版

为保障模型生成准确率，注入 dsh 的 Prompt 片段如下：

你具备调用 render_architecture 工具绘制工业级系统架构图的能力。
当用户需要绘制架构图、流程拓扑、RPC 调用图时，请严格遵守以下规则：
1. 严禁输出任何坐标、尺寸或 Hex 颜色代码，排版与主题由系统自动计算。
2. 数据格式采用 YAML：
   - 使用 groups 声明分组框（如需）；分组可嵌套，子分组用 parent: <group_id> 指定上级，嵌套不超过 3 层；
   - 使用 nodes 声明功能模块，可配置 title、desc 以及 items（用于展示该模块承载的 RPC 或 API 接口列表）；
   - 节点归属某个分组时，仅需在节点中使用 group: <group_id> 指定，不要使用 children 列表；
   - 使用 edges 声明模块间的调用关系，连线意图通过 label 说明。
3. 保持 ID 纯字母数字下划线命名，确保引用一致。


---

### 6. 非功能性需求 (NFR)

1. 性能指标：
   * 拓扑节点数 <= 50 时，「分层 + 坐标分配 + 走线」全链路耗时需 < 200ms。**实测 1–13ms**（全自研、零图布局依赖、无冷启动开销）。
   * draw.io XML 导出计算需在毫秒级内完成。
2. 依赖约束：
   * 布局链路**不引入任何图布局库**（elkjs / dagre 等均已评估并排除，理由见 §4.1.3）。
3. 兼容性：
   * 生成的 .drawio 文件必须百分之百兼容 draw.io 官方 Web 端（app.diagrams.net）及 VS Code Draw.io 扩展插件。
4. 架构解耦：
   * 插件遵循 dsh Cordis 微内核架构标准，支持通过 dsh plugin add @dsh/diagram 单独安装与热卸载。


---

### 7. 实施路线图 (Milestones)

* Phase 1 (MVP)：
  - 完成 YAML Schema 定义与 Ajv 静态校验函数（含分组嵌套的环检测与深度校验）。
  - 完成布局引擎：**零图布局依赖**，分层 / 行内收缩 / 层内排序 / 坐标分配 / 分组包络 / 正交走线全部自研（见 §4.1.3）。
  - 跑通 YAML 到 draw.io 明文 XML 的转换，并导出 PNG 完成功能级验证。
* Phase 2 (dsh Plugin 集成)：
  - 注册 render_architecture Tool。
  - 实现 ToolError 自愈反馈逻辑。
  - 在 dsh-web 构建 SVG 深色预览卡片及导出操作栏。
* Phase 3 (体验增强)：
  - 增加对行内 ```arch-yaml Markdown 块的纯手动预览支持（双通道容错）。
  - 支持节点点击查看详情与连线高亮交互。