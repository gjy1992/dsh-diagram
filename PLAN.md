# dsh-diagram 工作计划（Phase 1）

| 项 | 内容 |
| :--- | :--- |
| 依据文档 | [prd.md](./prd.md) v1.0.0 |
| 计划范围 | **仅 Phase 1（MVP 引擎）**，不含 dsh 宿主集成与 Web UI |
| 技术栈 | TypeScript + pnpm monorepo（Node >= 20，本机 22.14.0） |
| 状态 | Draft — 待评审（决策记录见 §7） |

---

## 1. 范围界定

### 1.1 本期交付（对应 prd.md §7 Phase 1）

| PRD 条目 | 本计划对应里程碑 |
| :--- | :--- |
| 完成 YAML Schema 定义与 Ajv 静态校验函数 | M1 |
| 完成简易 ELK.js 布局验证脚本 | M2 |
| 跑通 YAML 到 draw.io 明文 XML 的转换并完成本地文件验证 | M3 / M4 |

**在 PRD 基础上新增的一项**：groups 支持嵌套（PRD 原为单层）。理由见 §7 D6 —— 板块/子域这类真实架构天然是两层。

### 1.2 明确不做（移交给 Phase 2 / 3）

* `render_architecture` Tool 向 dsh 宿主的注册、Cordis 插件 manifest、热卸载。
* ToolError 自愈回传的真实宿主通道（本期只**固化错误的 JSON 载荷格式**，不做宿主投递）。
* dsh-web 端的深色交互式 SVG 预览卡片（Pan/Zoom、hover 高亮入出边）。
* ```` ```arch-yaml ```` 行内 Markdown 代码块的纯手动预览通道。
* 节点点击详情面板。

> 本期唯一需要"为 Phase 2 预留"的东西：一个**与宿主无关的执行器接口**（见 §3.3）。Phase 2 接入时只替换薄适配层，不改核心逻辑。

---

## 2. 前置条件与环境准备

| 项 | 现状 | 动作 |
| :--- | :--- | :--- |
| Node.js | 已装 v22.14.0 | 无需处理 |
| npm | 已装 11.1.0 | 仅用于安装 pnpm |
| **pnpm** | **未安装** | ✅ 已通过 corepack 固定 **pnpm 11.7.0**（root `packageManager` 字段）。注意：本机 corepack 0.31.0 与 pnpm 12.x 的新 bin 布局（`bin/pnpm.mjs`）不兼容，会报 `Cannot find module .../bin/pnpm.cjs`，故不能直接用 latest。 |
| git | 已装 2.42.0，仓库已 `git init` | ✅ baseline 提交已完成（`7b7b71a`，39 files） |
| dsh 宿主 / 插件 SDK | 本机不存在 | 本期不依赖，故不影响交付 |
| draw.io 桌面版 | `%LOCALAPPDATA%\Programs\draw.io\draw.io.exe`（文件名带点，不是 `drawio.exe`） | 用于 `.drawio` → PNG 功能级验证 |

---

## 3. 仓库结构规划

```text
dsh-diagram/
├── prd.md                        # 需求规格说明书
├── PLAN.md                       # 本文件
├── package.json                  # root，private，workspace 脚本入口
├── pnpm-workspace.yaml           # workspace 成员 + allowBuilds（pnpm 11 设置入口）
├── tsconfig.json                 # 单一 tsconfig：strict + noEmit + paths 别名
├── .gitignore
├── examples/
│   ├── 01-basic.yaml             # 最小可用：meta + nodes + edges
│   ├── 02-groups.yaml            # 单层分组 + variant + 同分组内连线
│   ├── 03-rpc-items.yaml         # 高密度：items 内嵌 RPC 列表
│   ├── 04-nested-groups.yaml     # 3 层嵌套分组（D6 验证用例）
│   ├── 05-stress-50.yaml         # 50 节点网格拓扑（性能与不重叠用例）
│   └── 90-invalid.yaml           # 反例：id 重复 / 外键缺失 / 分组成环
├── scripts/
│   └── verify.ps1                # 批量 build + 调用本机 draw.io 转 PNG 做功能级验证
├── out/                          # 验证产物（.drawio / .png），已 gitignore
└── packages/
    ├── schema/                   # @dsh-diagram/schema
    ├── layout/                   # @dsh-diagram/layout
    ├── drawio/                   # @dsh-diagram/drawio
    └── core/                     # @dsh-diagram/core（编排 + CLI）
```

### 3.1 包职责与依赖方向

```text
schema  →（无内部依赖）
layout  → schema
drawio  → schema, layout
core    → schema, layout, drawio     # 编排 + CLI
```

单向依赖，不允许反向引用；`core` 之外的包不得读写文件系统、不得调用 CLI 参数解析。

### 3.2 包内统一结构

```text
packages/<name>/
├── package.json          # name/version/exports，依赖声明
└── src/
    ├── index.ts          # 公共导出
    └── ...
```

**M0 实现取舍（相对原计划的简化）**：不引入 `tsconfig.base.json` 与 project references，改为**单一根 tsconfig**（`strict` + `noEmit` + `paths` 别名指向各包 `src/index.ts`），全部代码用 `tsx` 直接运行、用 `tsc` 仅做类型检查。Phase 1 无发布需求，省掉 `dist/` 构建链路；包间通过 `paths` 别名解析，因此不需要先 build 再跑。

### 3.3 宿主无关的执行器接口（Phase 2 预留点）

`@dsh-diagram/core` 暴露一个纯函数作为唯一编排入口，Phase 2 的 Tool 执行器只是它的薄包装：

```ts
type RenderResult =
  | { ok: true; data: { ast: ArchSpec; layout: LayoutResult; drawioXml: string } }
  | { ok: false; error: { code: string; path: string; message: string; hint?: string }[] };

// 注意：ELK.js 的 layout() 本身返回 Promise，故此处为异步
function renderArchitecture(input: { title: string; yamlSpec: string }): Promise<RenderResult>;
```

约束：**不抛异常、不做 IO**。错误以结构化数组返回，`JSON.stringify` 后即为可回传 LLM 的 ToolError 载荷。

---

## 4. 里程碑与任务分解

依赖顺序：M0 → M1 → M2 → M3 → M4。M1 与 M2 无相互依赖，可并行推进。

### M0 工程基线

| ID | 任务 | 产出 |
| :--- | :--- | :--- |
| T0.1 | 安装并固定 pnpm（root `packageManager` 字段） | 可执行 `pnpm` |
| T0.2 | `pnpm-workspace.yaml` + root `package.json`（private、scripts） | workspace 可识别 4 个包 |
| T0.3 | `tsconfig.base.json`：`strict`、ES2022、声明文件输出 | 统一编译基线 |
| T0.4 | 4 个空包骨架 + vitest 配置 | 可空跑 |
| T0.5 | root scripts：`build` / `test` / `validate` / `build:examples` | 一键命令 |

**验收**：`pnpm -r build` 成功；`pnpm test` 空跑通过；baseline 提交已打好。

**技术选型**：构建用 `tsc -b`（项目引用，本期不引入打包器）；测试用 `vitest`；脚本运行用 `tsx`。

---

### M1 DSL 规范与校验器（`@dsh-diagram/schema`）

| ID | 任务 | 产出 |
| :--- | :--- | :--- |
| T1.1 | 按 prd.md §4.1.1 + §7 D6 定义 TS 类型：`ArchSpec` / `Meta` / `Group` / `Node` / `Edge` | `src/types.ts` |
| T1.2 | 手写 JSON Schema（Ajv draft 2020-12）：字段类型、必填项、枚举白名单 | `src/schema.json` |
| T1.3 | Ajv 编译 + 缺省值填充：`version=1.0`、`group.variant=dashed`、`node.variant=default`、`edge.style=solid` | `src/validate-schema.ts` |
| T1.4 | 语义校验（prd.md §4.3）：`nodes`/`edges` 非空且为数组；`id` 唯一；`node.group` 外键存在；`edge.from`/`edge.to` 外键存在 | `src/validate-topology.ts` |
| T1.5 | **嵌套分组校验**（D6 新增）：`group.parent` 外键存在、不可自引用、不可成环（DFS 环检测）、深度上限 3（超出报错） | `src/validate-hierarchy.ts` |
| T1.6 | 错误诊断对象：`{ code, path, message, hint }`；`hint` 实现 did-you-mean（编辑距离 ≤ 2 的候选 ID） | `src/diagnostics.ts` |
| T1.7 | YAML 解析入口（`js-yaml`），YAML 语法错误转为同构诊断对象（含行号） | `src/parse.ts` |

**DSL 关键设计：嵌套用 `parent` 单向声明，不引入 `children` 数组**

```yaml
groups:
  - id: g_bff               # 必填
    title: BFF 层           # 必填
    variant: dashed         # 可选，dashed | filled
    parent: <group_id>      # 可选【新增】所属上级分组，缺省为顶层

nodes:
  - id: n_order
    group: g_bff_order      # 可指向任意层级的分组
```

这与 prd.md §2.2 的「单向引用与扁平化」哲学一致 —— 模型仍然只写"我属于谁"，不需要维护任何数组。

**枚举白名单（T1.2 依据 PRD 收敛，未知值应报错而非静默兜底）**
* `group.variant`：`dashed` \| `filled`
* `node.variant`：`default` \| `primary` \| `danger` \| `warning` \| `muted`
* `edge.style`：`solid` \| `dashed` \| `bidirectional`

**验收**
* 单测覆盖 §4.3 全部规则 + 嵌套全部反例（自引用、环、超深、悬空 parent）。
* 错误文案对齐 PRD 样例：`ValidationError: edge source 'single_playr' is not defined in nodes list. Did you mean 'single_player'?`
* `90-invalid.yaml` 能得到 ≥3 条结构化错误，且 `hint` 命中预期候选。

---

### M2 尺寸预估与布局（`@dsh-diagram/layout`）

| ID | 任务 | 产出 |
| :--- | :--- | :--- |
| T2.1 | 尺寸预估器（按 §7 D1 / D5 的公式与字号 token） | `src/sizing.ts` |
| T2.2 | 文本折行行数估算：中英文按字符宽度加权，`title` / `desc` / `items` 分别估算 | `src/text-metrics.ts` |
| T2.3 | 按布局单元建「条目 Meta-DAG」：边 = 源落在条目 A 子树、目标落在条目 B 子树（A≠B），带 `visited` 访问集与深度上限防环 | `src/layering.ts` |
| T2.4 | 分层流水线：入度优先破环 → 最长路径分层 → 脊柱-肋骨折叠（含高≥宽总闸）→ 层号重压缩 → 层内引力重心排序 | `src/layering.ts` |
| T2.5 | 虚拟双轴坐标分配：`(Rank, Order)` → 层带 × 列槽位对齐矩阵 → 分组包络；TB / LR 轴映射 | `src/placement.ts` |
| T2.6 | 正交走廊走线：三类型通道（同行直连 / 层间分道 / 跨层与回边栏杆绕行）+ 车道分配 + 碰撞检测兜底 | `src/routing.ts` |
| T2.7 | 统一输出 `LayoutResult`：`{ nodes[], groups[], edges[{points[]}], bounds }`，坐标为**相对父容器**（ELK/draw.io 一致），另派生 `absX/absY` 供 SVG 与几何断言使用 | `src/types.ts` |

**层级布局的技术前提（已作废，保留作历史记录）**

> ELK 相关的两条技术前提在本期已被**推翻并移除 elkjs**，见 §7 D11；本节保留以说明当时的取舍依据。

* ELK 的 `layered` 算法原生支持 compound（嵌套）图，这是 `elk.hierarchyHandling` 的 `INCLUDE_CHILDREN` 模式：副作用是**跨层级边也会被正常路由**。
* 若沿用 elkjs 默认的 `SEPARATE_CHILDREN`，各分组会被独立布局，**跨分组边界连线的 `sections` 会为空（即不路由）** —— 实测确认为真，因此 `INCLUDE_CHILDREN` 曾是硬性要求。
* **降级预案（已执行）**：改用「自底向上逐层布局」的自研版本 —— 每个布局单元单独分层，把子单元包围盒当作父级的一个条目尺寸，再排父级；跨层连线由自研走线器拼接折线。即当前的 `layering.ts` + `placement.ts` + `routing.ts`。

**验收**
* 6 个样例布局完成后，任意两节点矩形不相交（断言式，不靠肉眼）。
* 每一层分组的包围盒完整包含其全部子节点与子分组。
* `edges[].points` 非空，且首尾点与源/目标节点边界相接。
* `05-stress-50.yaml`（50 节点）：布局耗时 < 200ms（对应 prd.md §6 性能指标）。
* `04-nested-groups.yaml`：3 层嵌套下无节点越界出父容器。

---

### M3 draw.io 导出（`@dsh-diagram/drawio`）

| ID | 任务 | 产出 |
| :--- | :--- | :--- |
| T3.1 | `mxGraphModel` 头部，画布尺寸自适应（§7 D5） | `src/mxgraph-model.ts` |
| T3.2 | 分组容器 cell：`container=1;collapsible=0;rounded=1;dashed=1;...`；`parent` = 上级 group id 或 `"1"`（支持嵌套） | `src/cells/group.ts` |
| T3.3 | 卡片节点 cell：HTML value（§7 D4 的 title/desc/items 三段式），`parent` = 所属 group id 或 `"1"` | `src/cells/node.ts` |
| T3.4 | 连线 cell：`edgeStyle=orthogonalEdgeStyle`，**写入 ELK 算出的显式折线 `mxPoint` 序列**，保证导出与预览一致 | `src/cells/edge.ts` |
| T3.5 | 样式映射表：`node.variant` / `group.variant` / `edge.style` → mxGraph style（§7 D3） | `src/style-map.ts` |
| T3.6 | 无压缩明文 XML 序列化：不 deflate、不 base64；对 `& < > " '` 做转义 | `src/serialize.ts` |
| T3.7 | 输出顺序保证：父 cell 必须先于子 cell 声明（mxGraph 硬约束），按层级拓扑序输出 | `src/serialize.ts` |
| T3.8 | 文件名与标题 sanitize（去非法路径字符），输出 `${title}.drawio` | `src/filename.ts` |

**验收**
* 生成的 `.drawio` 用 DOMParser 解析无错误；根标签与属性符合 PRD §4.4.2 结构。
* 明文可读：文本编辑器打开即为完整 XML（非压缩串、非 base64）。
* 转义单测：标题含 `<`、`&`、`"` 时不破坏 XML 结构。
* 嵌套用例中每个子 cell 都出现在其父 cell 之后。
* **端到端视觉验证**：调用本机 `draw.io`（31.4.5）CLI 把 `.drawio` 导出为 PNG，肉眼确认分组框、嵌套容器、卡片、正交连线、边标签齐全 —— 这是本期"本地文件验证"的兜底手段。

---

### M4 编排、CLI 与端到端验证（`@dsh-diagram/core`）

| ID | 任务 | 产出 |
| :--- | :--- | :--- |
| T4.1 | 实现 `renderArchitecture()`（见 §3.3），串联 parse → validate → layout → export | `src/render.ts` |
| T4.2 | CLI `dsh-diagram validate <spec.yaml>`：打印结构化校验结果，exit code 0/1 | `src/cli.ts` |
| T4.3 | CLI `dsh-diagram build <spec.yaml> -o <outdir>`：产出 `.drawio` + 布局调试 JSON | `src/cli.ts` |
| T4.4 | 失败路径输出 JSON 诊断（即 Phase 2 的 ToolError 载荷），不打印 stack trace | `src/cli.ts` |
| T4.5 | 补齐 6 个 examples | `examples/*.yaml` |
| T4.6 | `scripts/verify.ps1`：批量 build 全部 examples 并转 PNG，输出验证报告 | `scripts/verify.ps1` |

**验收**
* 5 个合法样例 `build` 成功且退出码 0。
* `90-invalid.yaml` 退出码 1，输出 JSON 数组含 `code`/`path`/`message`/`hint`。
* `pnpm build:examples` 一键产出全部 `.drawio`，无手工干预。

---

## 5. Phase 1 完成定义（DoD）

**验证方式已按用户指示收敛为「功能级验证」**：不写单元测试框架、不写最小验证样例，只在最后做一次端到端功能验证 —— 给若干 YAML → 产出 `.drawio` → 转为 PNG，肉眼确认渲染正确。

1. `pnpm -r build`（tsc 类型检查 + 编译）全绿。
2. 5 个合法样例经 CLI 一键跑通，产出 `.drawio` 文件。
3. 全部 `.drawio` 能被本机 draw.io 打开并导出 PNG；视图中分组 / 嵌套容器 / 节点 / 连线 / 标签齐全，无重叠穿模、无内容裁剪。
4. 反例样例经 `validate` 输出带 did-you-mean 的结构化错误，退出码 1，字段格式可直接作为 ToolError 载荷。
5. 50 节点样例布局耗时 < 200ms。
6. 导出 XML 为无压缩明文，可文本编辑二次修改。
7. 画布尺寸随内容自适应，无固定留白或裁剪。
8. `renderArchitecture()` 除 ELK 布局（本身为异步）外无 IO，签名与 §3.3 一致。

## 5.1 执行结果（2026-09-30）

| 验收项 | 结果 |
| :--- | :--- |
| `pnpm build` | ✅ 全绿 |
| 5 个合法样例 build | ✅ 全部退出码 0 |
| 功能级验证（draw.io 导出 PNG） | ✅ 5/5 成功，见 `out/*.png` |
| 反例校验 + did-you-mean | ✅ 5 项结构化错误，`hint` 命中 `single_player` |
| 50 节点布局耗时 | ✅ **1–13ms**（原 ELK 方案 284ms，远低于 200ms 预算） |
| 明文 XML | ✅ 文本编辑器可直接打开二次编辑 |
| 画布自适应 | ✅ `pageWidth/pageHeight` 按 bounds + 40px 计算 |
| 布局形态 | ✅ 顶层分组纵向堆叠成"带"，带内「层=行、行内条目横向排列」（TB 缺省）；无分组图为单条纵向链；无内部连线的分组自动转网格 |
| 反向边 | ✅ 下潜 → 安全垂直走廊 → 整图顶部栏杆横穿 → 目标层上方折入（03 的 `上报进度`、05 的 `回流` 可见） |
| 已知注意点 | 行高（D8）、连线标签底色（D9）、**布局库取舍（D11）**、折行粒度（D12）、单元排列（D13）—— 均已修复并回写 PRD |

## 5.2 布局算法 Spec v2.0 落地结果（2026-09-30）

| 验收项 | 结果 |
| :--- | :--- |
| `pnpm build` | ✅ 全绿（strict） |
| Case 1 · 线性流水线 `A→B→C→D` | ✅ 4 行 1 列（未触发折叠） |
| Case 2 · 2×2 伴随矩阵 `A→B, A→C, C→D` | ✅ 2 行 2 列，`B` 折为 `A` 的同行肋骨、`D` 折为 `C` 的同行肋骨 |
| Case 3 · 5×3 脊柱-肋骨矩阵 | ✅ 5 行 3 列，`A1..E1` 为纵向主脊柱、`X2→X3` 折为同行肋骨，交叉数 0 |
| Case 4 · 菱形汇聚防御 `A→B→D, A→C→D` | ✅ 安全回退 1/2/1（`D` 入度 2，链条追踪被守卫 2 拒绝） |
| 5 个样例连线穿模数 | ✅ **全部为 0**（程序化断言：逐段做节点矩形碰撞检测） |
| 5 个样例连线正交性 | ✅ 全部为严格水平/垂直段 |
| 50 节点布局耗时 | ✅ **1.57ms**（纯 `layoutSpec` 冷跑最快值；远低于 200ms 预算） |
| 方向配置 | ✅ 3 种配置（交替 / 钉死 TB / 钉死 LR）× 5 个样例 = **15 组全部 0 穿模、0 非正交段** |
| 交替方向画布收益 | ✅ 相对纯 TB：05 560×2664 → **1432×1184**；04 360×906 → **984×586**；03 560×882 → **568×712**；02 560×584 → **568×560**；01 不变 |
| 与 spec 的裁决差异 | ① 折叠触发条件 = 「单元内存在分叉」（D16）；② 折叠总闸 = 「层数 ≥ 层内最多元素数」（D17，用户裁决）；③ 方向逐层交替 + 无连线单元继承父单元 + 走线逐边定框架（D20 / D21，用户裁决）；④ 绘制层级「分组 → 节点 → 连线」（D23）；⑤ 长边优先外绕且绕开无关分组框（D24）；⑥ 栏杆只向外漂移（D25）；⑦ 开放侧端口以减少弯折（D26 / D27） |
| 走线质量（长边外绕后） | ✅ 非正交 0、穿节点 0、**穿无关分组框 0**；交叉数 全部 0（01/02/04/05=0，03=4；外绕前基线 01=0/02=1/03=5/05=13） |
| 弯折优化（开放侧端口后） | ✅ 03 的 `上报进度` 4→2 折、05 的跨域/回流 4→2 折；画布因栏杆余量加大而略增（03 592→624、05 1464→1496） |
| 遗留观察点 | 无 |

### 5.3 走线修复：两端外绕 + 交叉全局裁决（2026-10-01）

用户验收 03 提出两点：① `持久化` 没有走"红线所示的外侧"，而红线的弯折数更少；② 朴素观察 —— **跨层连线时，最左/最右侧的条目几乎总是从对外的那一侧（左右）出入最优，最上/最下侧的（上下）同理**。

根因（临时插桩复现，非猜测）：

* `持久化`（`director → timeline_db`）共 21 个候选。⑦/⑧ 族里那条 **3 折**「左侧出 → 外侧栏杆 → 目标顶边入」确实生成过（候选 #6），却被 ⑦/⑧ **族内**的"不许与已放置连线十字相交"自检否掉 —— 它的收尾横段（`y=530`）横切了 `拉取资源` 的竖段（`x=184`）。
* 随后中选的 ④ 族（先下潜、再沿同一栏杆走）**收尾两段与它完全相同**（`h@530 → v@424`），**同样在交叉**，却因 ④ 没设闸而"胜出"：3 折被换成 4 折，交叉一个没少。
* 用户画的红线（`上出 → 顶部栏杆 → 右侧栏杆 → 目标右边入`）**根本没有对应候选族**：⑥ 只管"目标在上方"、⑦ 只管"同侧"、⑧ 只管"源侧出 + 目标顶边入"。

修法：

1. 新增候选族 ⑨ **两端外绕**（D28）：源的**主轴对外侧**（首行上 / 末行下）出边 + 目标的**次轴对外侧**（首列左 / 末列右）入边，中间走「顶/底栏杆 + 左右外侧栏杆」。只在长边放行，只服务正向边。
2. 把"十字交叉"从候选族的**私有闸门**提升为**全局裁决**（D29）：主循环改为三轮 —— 干净轮（碰撞/重叠/交叉皆不许）→ 让步轮（只禁碰撞与重叠）→ 兜底轮（只禁碰撞）。

结果（`pnpm audit:routing` 程序化复算）：

| 指标 | 修复前 | 修复后 |
| :--- | :--- | :--- |
| 03 交叉对数 | **4** | **0** |
| 03 总折数 / 最大折数 | 16 / 4 | **13 / 3** |
| 03 `持久化` | 4 折（下潜 → 左栏杆 → 横切 `拉取资源`） | **3 折**（上出 → 顶栏杆 → 右栏杆 → 右边入，即红线形态） |
| 03 `上报进度` | 4 折 | **2 折**（左侧出 → 左栏杆 → 左侧入） |
| 01 / 02 / 04 / 05 | —— | **产物逐字节完全相同** |
| 硬性不变量 | 非正交 0 / 穿节点 0 / 穿无关分组框 0 | 不变 |

---

## 6. 验证策略

| 环节 | 手段 |
| :--- | :--- |
| 类型与编译 | `pnpm -r build`（TypeScript strict + 项目引用） |
| 校验器行为 | `cli validate` 跑 `examples/*.yaml`（含 1 个反例），人工核对错误输出 |
| 端到端功能验证 | `scripts/verify.ps1`：批量 `build` 全部样例 → `.drawio`；再调用本机 draw.io CLI 逐个转 PNG |
| 走线质量回归 | `pnpm audit:routing`（`scripts/audit-routing.ts`）：程序化断言非正交 / 穿节点 / 穿无关分组框 = 0，并汇报各样例交叉对数与每条边的折数 |
| 观感确认 | 用户 / 我肉眼比对 PNG：分组嵌套层次、卡片三段式文本、variant 配色、正交连线、边标签、画布自适应 |

不引入 vitest 等单测框架（本期无单测），不引入 E2E 浏览器测试（本期无 Web UI）。

---

## 7. 已确认决策记录（Decision Log）

| ID | 决策 | 取值 |
| :--- | :--- | :--- |
| **D1** | 无 items 节点高度 | **48px**；高度公式见下 |
| **D2** | 分组边框色 | 统一 **`#334155`**（覆盖 PRD §4.4.2 的 `#475569`） |
| **D3** | 语义样式映射表 | 见 §7.1 |
| **D4** | 卡片文本层次 | `desc` 紧跟 `title` 下一行、**居中**、字号小于 title；字号 token 见 §7.2 |
| **D5** | 画布尺寸 | **自适应**：按布局 `bounds + 40px 边距` 计算 `pageWidth/pageHeight`，替代 PRD 固定 1920×1080 |
| **D6** | 分组嵌套 | **语法支持嵌套，用 `groups[].parent` 单向声明**（不引入 `children` 数组）；ELK 可用 `hierarchyHandling=INCLUDE_CHILDREN` 支撑，见 T2.4；深度上限 3 层 |
| **D7** | `.drawio` 文件外层 | 用标准 `<mxfile><diagram>` 包裹未压缩的 `mxGraphModel`（PRD 原文只提 `<mxGraphModel>` 根标签，但裸 `mxGraphModel` 不是合法 `.drawio`，会打不开）；仍满足"无压缩明文"要求，已回写 PRD §4.4.2 |
| **D8** | 高度公式行高 | 实现时发现 PRD 原文行高（title 20 / desc 18）按裸字号取值，与 draw.io HTML 标签实际渲染行距不符，导致文字溢出卡片底部（实测确认）。已把行高修正为 title 24 / desc 20、items 前补 `<hr>` 分隔线（14px），并回写 PRD §4.1.2 |
| **D9** | 连线标签底色 | draw.io 连线标签默认白底，深色主题下浅色文字几乎不可读（实测确认）。在连线 style 增加 `labelBackgroundColor=#152238`，回写 PRD §4.4.2 |
| **D10** | ELK 连线坐标空间 | 实测确认：ELK 的 section 坐标记在「两端点所在分组的最近公共祖先」坐标系，跨分组才是根画布坐标，同属一个分组需叠加该分组绝对偏移。已在 `@dsh-diagram/layout` 实现 LCA 偏移换算，回写 PRD §4.4.2 |
| **D11** | **布局库取舍（重要）** | 实测两条 ELK 路线都不成立：① **全局单次分层**——跨分组连线外推下游层号，把并行链整体推成斜线错位；② **compound + `SEPARATE_CHILDREN` 按单元分层**——ELK 会**丢弃跨子单元边界的边**，含子分组的单元与根画布完全排不出顺序，顶层分组顺序整个反掉（02 的 `g_client` 被放到 layer 1）。→ **完全移除 elkjs**，改为自研：按单元建「条目 DAG」→ DFS 去回边 → 最长路径分层。附赠：全链路耗时从 284ms 降到 1–13ms |
| **D12** | 折行粒度 | `max_columns` 限制的是**每行几「列」（几层）**，不是几个条目；同一层的条目在**列内纵向堆叠**。按条目逐行折行会把并行链揉碎、连线大面积被迫反向绕行（实测）。缺省 `auto` = 按目标画布宽度 1600px 自动折行（flex 容器语义） |
| **D13** | 单元结构与排列 | root 单元：每个顶层分组独占一行、纵向堆叠（视觉上是一条条"带"）；分组内部：条目横向流动、按 `max_columns` 折行；**分组内无连线时退化为网格模式**（每个条目自成一列横排），避免全部堆成一列 |
| **D14** | 走线穿模 & 绘制层级 | 用户验收发现"连线覆盖节点框"，定位到两处：① **路由兜底路径未做碰撞检测** —— 前向跨非相邻带的边（03 的 `持久化`）候选全被否后直接落到顶部栏杆兜底，竖直下行穿过中间两张卡片。修法：新增"跨非相邻带走外侧通道"候选（出带 → 带间空隙 → 外侧通道下行 → 目标带上方空隙 → 入带），且兜底也先做碰撞过滤，实在无解才接受穿模。② 绘制层级当时判定为"连线最先输出"—— **该结论已被 D23 推翻**。 |
| **D15** | **布局算法升级到 Spec v2.0（重要）** | 采用外部设计文档 `design.md`（Spec v2.0）重写 `@dsh-diagram/layout`：虚拟双轴 `(Rank, Order)` 解耦 → 入度优先破环 → 最长路径分层 → **脊柱-肋骨行内折叠** → 层内引力重心排队 → 列槽位对齐矩阵 → 三类型通道走线。与 spec 的两处**裁决差异**见 D16 / D17。落地结果：4 个验收用例（Case 1 线性 4×1、Case 2 2×2、Case 3 5×3、Case 4 菱形 1/2/1）全部命中，5 个样例连线穿模数 0。 |
| **D16** | 肋骨折叠触发条件 | spec 原文要求「挂载点必须分叉，否则保持纵向推进」，但完全不分叉的单元（纯流水线 `A→B→C→D`）本来就没有阶梯可消除；而把触发条件放到「单元内存在分叉」后，纯流水线整体跳过折叠，Case 1 得到期望的 4×1。 |
| **D17** | 肋骨折叠总闸（用户裁决） | spec 的验收用例自相矛盾：Case 1 要求「单出边不折叠」，Case 2/3 的期望值却必须折叠单出边链。裁决为**统一用一条总闸把关**：折叠后仍满足 `层数 ≥ 层内最多元素数`（等价于高 ≥ 宽）才折叠，否则回滚。这条闸门对 4 个用例都给出与 spec 期望一致的结论，且天然抑制"把整张图压成扁平长条"。 |
| **D18** | 布局方向 TB / LR | 新增 `layout.direction`，**缺省 TB**。分层与排序完全与方向解耦；方向只在「虚拟轴映射到物理坐标」和少量轴相关间距上分叉。 |
| **D19** | 走线绕行姿势 | 跨层与回边一律「**先下潜再纵向移动**」，沿预先算好的安全垂直走廊（列间隙，或左右外侧栏杆）纵向移动，必要时借顶部栏杆横穿，最后在目标层上方的层间隙内折入目标顶边。反例：从源节点侧面直接横穿会同排邻居节点（03 的 `上报进度`、05 的 `回流` 实测各穿一张卡片），改为下潜后消失。 |
| **D20** | **方向逐层交替 + 无连线单元继承父单元（重要，用户裁决）** | 单一全局方向在多层嵌套下会把画布拉成极端长条：05 在纯 TB 下为 560×2664（1:4.8）。改为按单元逐个解析：① 深度 0 用 `layout.direction`；② 单元**内有连线**时在**父单元方向**基础上翻转 TB↔LR（保证相邻两层主轴恒正交、纵横比自动均衡）；③ 单元**内无连线**时没有拓扑因果、方向纯属审美，于是**继承父单元方向**，让子块与父级网格同向。翻转刻意做成**父相对**而非「按绝对深度取奇偶」：继承分支会让某层偏离奇偶预期（如深度 1 的无连线单元继承成 TB），此时按奇偶算的深度 2 有连线单元仍是 TB、主轴没换；父相对则必然是 LR。实测（相对纯 TB）：05 560×2664 → **1432×1184**、04 360×906 → **984×586**、03 560×882 → **568×712**、02 560×584 → **568×560**、01 不变。另有逃生口 `layout.inner_direction`（`auto` 缺省，给 `TB`/`LR` 则把深度 ≥ 1 钉死且优先级最高）。 |
| **D21** | **走线逐边定框架（D20 的必要配套）** | 逐层交替后全图不再有唯一虚拟轴，故走线框架改为**逐边**判定：由包含两端点的最内层单元（LCA 单元）的方向决定（同带内边用带内方向、跨带边用第 0 层方向）。实现上把节点矩形 / 层带 / 走廊按该边的框架转置后跑原有候选逻辑，输出点再转置回来；「已占用线段」统一按物理口径存，比较时翻转轴标签即可（转置只换轴、数值不变），**候选逻辑零改动**。 |
| **D22** | 跨框架坐标换算的两个坑（实测） | ① **子单元内容原点的坐标系**：父子单元方向互为转置时，不能把分组框在父框架下的 `(main, cross)` 直接当作子单元框架的原点，必须先换算成分组框**物理**左上角、再按子单元方向表达，否则子单元整体漂到别的带上去（05 首次跑交替时 45 条边全部穿模，就是这么来的）。② **原「实在无解」兜底路径**是斜线（两个端点直连），draw.io 会自行正交化，观感不可控；已改为「下出 → 中线 → 上入」的正交兜底。 |
| **D23** | **绘制层级定稿：分组框 → 节点 → 连线（用户裁决，推翻 D14②）** | 用户验收发现 02 里 `App→gift_bff`、`Web→gift_bff` 看起来"从分组开始连"。定位：这两条边的起点是节点底边（y=84/100），而 `客户端` 组框是 `filled` 变体（不透明填充 `#111c33`）且底边在 y=120 —— 连线在组框**下层**，组内那段被填充色盖掉了。改为**三层顺序**：分组框（最底）→ 节点 → 连线（最上）。连线在最上层是安全的：走线器保证除首尾锚点外不与任何节点矩形相交，压在卡片上的只有箭头落点那一圈。 |
| **D24** | **长边优先外绕 + 绕开无关分组框（用户裁决）** | 同事提出"希望连线尽量往外围绕"，用户定为：**只对长边（类型 C：跨多层正向边、逆向回边）生效**，且"外面"指**绕开无关分组框**。实现：① 长边的走廊优先级改为「**较近一侧**的外侧栏杆优先 → 内部安全列间隙」；② 把**与本边无关的分组框**加入碰撞障碍（端点所在分组及其全部祖先允许穿过，其余一律不许进入）。类型 A / B 完全不变。 |
| **D25** | 外圈栏杆余量 & 只许向外漂移 | 用户验收 03 发现"连线和 group 的虚框重合"。实测：组框左边在 `x=24`，两条长边的竖向通道却落在 `x=0` 与 `x=8`（只差 16px）。两处原因 —— ① 余量太小的 `OUTER_CHANNEL_GAP=24`；② **车道偏移是双向的**，`+offset` 会把栏杆从外侧拉回内容区。修法：`OUTER_CHANNEL_GAP` 24→**56**、`TOP_RAIL_HEIGHT` 28→**56**，并让栏杆位置只接受「更外」的偏移（`railXAt`）、顶部栏杆只接受「更高」。 |
| **D26** | **开放侧端口 + 尽量减少弯折（用户裁决）** | 同事希望"首行/末行可以走上边和下边出入，首列/末列可以走左边和右边出入，并尽量减少弯折"。实现：布局层为每个条目算出四个侧哪些「朝外开放」（最外层那一行 + 每行最外侧那一列才有留白），走线器在这些侧上新增两个候选族 —— ⑥ **逆向直连**（目标在上方且两侧端口都开放 → 「上边出、下边入」，03 的 `上报进度` 由 4 折降到 2 折）、⑦ **外圈侧向直连**（同侧端口都开放 → 「同侧出 → 外侧通道 → 同侧入」2 折，05 的跨域/回流由 4 折降到 2 折）。端口方向按**单元轴口径**记录，映射到逐边框架时按是否互为转置整体对调。 |
| **D28** | **跨层连线优先「两端都走对外侧」（用户裁决）** | 用户观察："跨层连线时，最左、最右侧几乎总是从对外的那一侧最优，而不是从上面或下面；最上、最下侧的也同理。"落点：新增候选族 ⑨ —— 源从**主轴对外侧**（首行上 / 末行下）出、目标从**次轴对外侧**（首列左 / 末列右）入，中间借「顶/底栏杆 + 左右外侧栏杆」绕行（`bottomRailY` 与 `topRailY` 对称，栏杆一律只许向外漂移）。只在长边放行、只服务正向边（目标在上方仍交给 ⑥ / ⑤）。03 的 `持久化` 由此从 4 折降到 3 折（即用户画的红线形态），且不再横切 `拉取资源`。 |
| **D29** | **候选族私有闸门 → 全局三轮裁决（实测修正，取代 D27 的手段）** | 03 的 `持久化` 复现出 D27 手段的副作用：⑦/⑧ 族内设的"不许交叉"闸门否掉了族内**更省**的 3 折走法，而 ④ 族拥有**完全相同**的收尾段（同样交叉）却因没设闸而中选 —— 3 折白换成 4 折。修法：把交叉判据上移到主循环，改为三轮（干净轮：碰撞 / 重叠 / 交叉皆不许 → 让步轮：只禁碰撞与重叠 → 兜底轮：只禁碰撞），族内顺序只在**同一轮内**做优先级，于是"谁少一折"与"谁不交叉"的取舍不再取决于哪个族恰好设了闸。D27 的目标（05 交叉数 0、且仍保留 2 折长边）不变：03 交叉 4→0、总折数 16→13，01/02/04/05 产物逐字节不变。 |
| **D27** | ⑦ 的自交叉护栏（实测修正） | ⑦ 第一版让 05 的交叉数从 0 涨到 5：相邻长边的短横段会穿过彼此的竖段（它们共用同一片栏杆区）。给 ⑦ 内置一道「不与已放置连线**十字相交**」的自检，不满足就整体让位给 ④ / ⑤。结果：05 交叉数回到 0，且 5 条长边里仍有 2 条拿到 2 折。这正对应同事提的"**在不交叉的前提下**尽量走外面"。 |

### 7.1 样式映射表（D3，深色主题）

**节点卡片**（基础 style：`rounded=1;whiteSpace=wrap;html=1;`）

| variant | fillColor | strokeColor | fontColor | 语义 |
| :--- | :--- | :--- | :--- | :--- |
| `default` | `#1e293b` | `#334155` | `#e2e8f0` | 普通模块 |
| `primary` | `#0c4a6e` | `#38bdf8` | `#e0f2fe` | 核心 / 入口模块（Sky Blue） |
| `danger` | `#4c1d24` | `#f87171` | `#fee2e2` | 风险 / 故障点 / 待下线 |
| `warning` | `#4a3712` | `#fbbf24` | `#fef3c7` | 待治理 / 观察项 |
| `muted` | `#1e293b` | `#334155` | `#64748b` | 弱化 / 边缘模块（仅文字降亮） |

**分组容器**

| variant | strokeColor | fillColor | fontColor | 其余 |
| :--- | :--- | :--- | :--- | :--- |
| `dashed`（默认） | `#334155` | `none` | `#94a3b8` | `dashed=1;align=left;verticalAlign=top;spacingLeft=10;spacingTop=5;` |
| `filled` | `#334155` | `#111c33` | `#94a3b8` | 同上但 `dashed=0` |

**连线**（基础 style：`edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;fontColor=#cbd5e1;` 来自 PRD §4.4.2）

| style | 追加片段 |
| :--- | :--- |
| `solid`（默认） | `endArrow=classic;endFill=1;` |
| `dashed` | `endArrow=classic;endFill=1;dashed=1;dashPattern=8 4;` |
| `bidirectional` | `startArrow=classic;startFill=1;endArrow=classic;endFill=1;` |

### 7.2 尺寸与字号 token（D1 / D4）

| token | 值 | 用途 |
| :--- | :--- | :--- |
| 节点宽 | 240px（固定） | —— |
| 标题字号 | **14px / bold** | `node.title`，居中 |
| 描述字号 | **12px / normal** | `node.desc`，居中，紧随标题下一行 |
| items 字号 | **12px** | `node.items`，左对齐，可等宽字体倾向 |
| 行高 | title 20 / desc 18 / items 22 | 高度计算用 |
| 节点内边距 | 合计 16px（上下各 8） | —— |
| 分组内边距 | 24px | 每层分组包络时叠加 |
| 组标题字号 | 12px / `#94a3b8` | `group.title`，容器左上角 |
| 同级组间距 | 32px | ELK spacing |
| 节点间距 | 同层 24px / 跨层 48px | ELK spacing |
| 画布边距 | 40px | 自适应尺寸时外扩 |

**节点高度公式**（对 PRD §4.1.2 的收敛版，消除 56/48 矛盾）

```text
height = max(48, 16 + 20 + (desc ? 18 : 0) + items.length * 22)
```

即：内边距 16 + 标题行 20 + 描述行（有则 18）+ 条目行（每条 22），并以 48px 为下限。
覆盖验证：无 desc 无 items → 36 → 取 48 ✓（符合 D1）；有 desc 无 items → 54；无 desc 且 2 条 item → 80。

**draw.io 侧落地方式**：标题字号走 cell style 的 `fontSize=14;fontStyle=1`（加粗），`desc`/`items` 用 `<font size="1">` 包裹（draw.io 渲染约 10–12px）；若实测观感与 12px 差距明显，在 M3 视觉验证阶段微调 `<font size>` 取值并回写本节。

### 7.3 HTML value 结构（D4）

```html
<b>节点标题</b><br/><font size="1">节点描述（居中）</font><hr/><font size="1">rpc:OrderQuery</font><br/><font size="1">rpc:OrderCreate</font>
```

---

## 8. 风险与应对

| 风险 | 影响 | 应对 |
| :--- | :--- | :--- |
| R1 `INCLUDE_CHILDREN` 在 3 层嵌套下的坐标质量或性能不达标 | 布局不可用 | 按 T2.4 降级预案改"自底向上逐层布局"；`04-nested-groups.yaml` 作为对比基准 |
| R2 ELK 层级布局下跨层连线路由不理想 | 连线穿模 | 组间边在 ELK 中声明端口约束；必要时改用自研正交路由器消费 ELK 坐标 |
| R3 draw.io 对显式 `mxPoint` 折线 + `orthogonalEdgeStyle` 的处理与预期不符 | 导出与预览不一致 | M3 先用 1 个样例做 spike；不行则退化为只给 source/target 让 draw.io 自动路由 |
| R4 HTML value 中 `<hr/>` / `<font size="1">` 渲染与设计值不符 | 卡片观感偏差 | 视觉验证阶段实测并回写 §7.2；必要时改用 `<br/>` + 下划线 |
| R5 mxGraph 嵌套容器要求子坐标相对父、父 cell 先声明 | XML 打不开或层级错乱 | T2.6 已约定布局输出保持父相对坐标；T3.7 强制拓扑序输出，并有单测覆盖 |
| R6 固定 240px 宽 + 长 RPC 名称溢出 | 文字被裁 | 尺寸预估器按折行数动态加高；仍溢出则回看 §7.2 是否放宽宽度 |
| R7 pnpm 安装受网络限制 | M0 阻塞 | 备选 `npm i -g pnpm` 或改用 npm workspaces（结构不变，仅换 workspace 声明文件） |

---

## 9. 执行顺序速览

```text
M0 工程基线
   │
   ├──► M1 DSL 与校验器 ──┐
   │                      ├──► M3 draw.io 导出 ──► M4 编排 + CLI + 端到端验证
   └──► M2 布局引擎 ──────┘
```

每个里程碑完成后单独提交一次，便于回溯与评审。

---

# dsh-diagram 工作计划（Phase 2 · dsh 插件集成）

| 项 | 内容 |
| :--- | :--- |
| 依据文档 | [prd.md](./prd.md) §4.2 / §4.3 / §4.4 / §7 Phase 2 |
| 前置 | Phase 1 引擎（`schema` / `layout` / `drawio` / `core`）已交付并验收（§5.3） |
| 交付路线 | **用户裁决（2026-10-01）：先最小闭环 S1 验证插件接口，再接 SVG 卡片 S2** |
| 状态 | S1 / S2 均已落地并端到端验证（见 P2.4 / P2.6）；遗留见 P2.5 |

## P2.1 交付物形态：一个可安装 bundle

安装单元是仓库内的 `plugin/` 目录（**刻意不是 pnpm workspace 成员**，避免与 root 包名冲突）：

```text
plugin/
├── package.json          # name=@gjy_1992/dsh-diagram，声明 dsh.bundle.patch + dsh.client
├── cordis.patch.yml      # insert 一行：id=dsh-diagram（set_plugin 的 target 是 include:dsh-diagram）
├── icon.svg              # 插件管理页卡片图标
├── locale/{zh,en}.json   # 展示标题与描述（不激活插件也能读到）
├── src/host.ts           # 宿主半源码：defineTool + 自愈载荷 + save_drawio
├── src/client.tsx        # 客户端半源码：keyed toolview
├── index.js              # ← 打包产物（宿主半，ESM，提交进仓库）
└── client.js             # ← 打包产物（客户端半，__ModuleLoader__ 信封）
```

`scripts/build-plugin.mjs` 用 **esbuild** 出两半，不新增构建依赖：按「环境变量 → 本仓库 → 本机 dsh checkout 的 pnpm 存储」候选顺序解析 esbuild。宿主半把 `@deepseek-ai/*` 保持 external（必须与运行时同一份实例），客户端半把 `react`/`react/jsx-runtime` 留给浏览器模块表、其余（含 `@dsh-diagram/*` 引擎）全部内联。

## P2.2 工具契约（用户逐条确认后冻结）

工具面**只有 1 个** `render_architecture`：校验是它的内部步骤，导出由卡片承担。

| 项 | 取值 |
| :--- | :--- |
| 参数 | `title`(必填) / `yaml_spec`(必填) / `save_drawio`(可选布尔，缺省 false) |
| 输出 | `{ groups, nodes, edges, width, height, file_name, saved_path? }`；`render` 只吐一行中文摘要 |
| 失败载荷 | `Error: ValidationError: yaml_spec 中有 N 处问题…` + 逐行 `序号. path [CODE] message Did you mean '…'?`（上限 12 条） |
| description | 见 `plugin/src/host.ts` 的 `DESCRIPTION`；**不含 `layout`**，含三段枚举（node/group/edge 的 variant/style） |

### 契约决策

| ID | 决策 | 理由 |
| :--- | :--- | :--- |
| **P2-D1** | 卡片**客户端自带引擎**，从调用参数 `yaml_spec` 现场解析 + 布局 + 渲染 | 零上下文开销、replay/fork 后可重现；备选（宿主算好塞进 result / 客户端回调宿主 RPC）分别要背几十 KB token 或多一层引用 |
| **P2-D2** | 卡片挂在 keyed slot `tool.call.toolview`（key = wire 工具名），**不是右侧面板** | 官方口径：Client 自行从「原始参数 + 结果内容 + 失败状态」派生展示；keyed 命中即**接管整行**，故卡片自带行头并保留 `data-chat-anchor-key` / `data-chat-call-id` 契约 |
| **P2-D3** | 宿主不吐 XML、不落盘（除非 `save_drawio`） | 成功只回一行摘要；XML 留在宿主，避免每次请求都背整份 draw.io 明文 |
| **P2-D4** | `layout` 字段保留在 YAML schema，但**不进模型文档** | 用户裁决：`direction` / `inner_direction` / `max_columns` 留给手动 / UI 通道，模型不该碰几何 |
| **P2-D5** | 落盘走 `ctx.fs`（受策略治理、计入工作区变更），路径 `<会话 cwd>/<file_name>` | 不绕过用户的文件规则；写入后补发 `fs/observed` 保持观察账本真实 |
| **P2-D6** | 失败载荷用人类可读逐行，不用 JSON 块 | 模型读得更好，客户端卡片也能直接当错误行显示 |

## P2.3 宿主侧实现要点

* `execute` 里唯一失败通道是 `throw new Error(formatDiagnostics(...))` —— 模型看到 `Error: <诊断文本>`，据此改写 `yaml_spec` 重试，即 PRD §4.3 的自愈闭环。
* `packages/core` 的 `renderArchitecture()` 新增 `summary` 字段（`{groups,nodes,edges,width,height,fileName}`），XML 仍留给 CLI 使用。
* `defineTool` 的输出对象**必须显式写 `additionalProperties`**（DSH 硬约束，缺了注册时就炸）。

## P2.4 S1 执行结果（2026-10-01）

| 验收项 | 结果 | 证据 |
| :--- | :--- | :--- |
| `pnpm build`（tsc strict） | ✅ exit 0 | —— |
| 两半打包 | ✅ `index.js` 445 KB（引擎+Ajv+js-yaml 内联）/ `client.js` 6.7 KB | `pnpm build:plugin` |
| bundle 安装 | ✅ `application: applied`，profile 出现 `link:` 依赖 | `plugin_manager install_bundle` |
| 宿主 Tool 注册 | ✅ `render_architecture` 进入本 agent 可见工具集 | `cordis_inspect_query` Host `Tool.listTools` |
| 客户端 slot 注册 | ✅ occupant `{ key: "render_architecture", active: true }` | `cordis_inspect_query` Client `Slots.listSubTree` |
| 真实调用（成功路径） | ✅ “已生成架构图：4 个分组 / 9 个节点 / 8 条连线，画布 1252×902…” | 狗粮图：画插件自身架构 |
| 真实调用（自愈路径） | ✅ `Error: ValidationError: yaml_spec 中有 1 处问题，请修正后重新调用本工具。` | 反例 `variant: core` |
| `save_drawio` 落盘 | ✅ 重启后复验通过 | 真实调用返回 `已落盘到 F:\gitProject\dsh-plugins\dsh-diagram\S2 落盘复验.drawio`，磁盘上确有该文件 |

### 实测踩坑（都不是猜测）

* **C1 · `fs.writeText` 省略 `sandboxPolicy` ≠ 沿用当前会话策略**。`fs-sandbox/src/index.ts:123` 是 `const policy = sandboxPolicy ?? this.ctx.sandboxPolicy.resolve()` —— 不带 session 的 `resolve()` 用的是**部署默认**（`workspace-write` + 部署兜底根），于是会话工作区里的目标被判成"外面"，报 `cannot write "…": file access denied under workspace-write mode`。修法：每次执行都 `ctx.sandboxPolicy.resolve({ session })` 再显式传下去（与 `tool-fs` 一致）。
* **C2 · 本 profile 的宿主侧热更新是关的**。`hmr` 行默认 `root: []`（只保留显式配置监听），且 `plugin_manager` 的 `set_plugin` 关→开循环**不会**让已缓存的 ESM 模块失效 —— 实测：改完诊断文案、重打包、重启插件后，工具调用仍返回旧文案。**结论：宿主半的任何改动都需要重启 dsh 才生效**；但**客户端半不需要** —— 客户端产物的 URL 带内容 sha1 的 `rev` 戳，重打包后刷新页面就能取到新字节（S2 实测：刷新前后「带 SVG 的卡片数」3 → 6）。

## P2.5 遗留与 TODO（全部登记，2026-10-01 第二轮更新）

### 已完成（第三轮，2026-10-01）

| ID | 项 | 结果 |
| :--- | :--- | :--- |
| **T1** | 双向文件级工具对 `yaml_to_drawio` + `drawio_to_yaml` | ✅ 见 §P2.7（子代理交付；主代理独立复验：改动范围合规、tsc 绿、5 个样例往返全绿） |
| **T2** | schema 错误与引用/层级错误**合并**报告 | ✅ 见 §P2.8 |
| **T7** | 卡片暴露 `saved_path` | ✅ 卡片行下新增「已落盘到 <绝对路径>」 |

### 待做（按建议顺序）

| ID | 项 | 说明 | 优先级 |
| :--- | :--- | :--- | :--- |
| **T6** | 回合末尾的卡片再现（turnTail 条目） | 工具行被 step 折叠行收起时，回合末尾仍能看到本轮架构图 | 高（用户提出） |
| **T3** | 插件两半无类型检查 | 未装 `@types/react`；`plugin/src/**` 只经 esbuild 语法 + 运行验证。补法：plugin 局部 tsconfig | 中 |
| **T8** | 行头打磨 | 现在按 token 自绘，不是 ui-primitives ToolRow 的逐像素复刻（缺 hover 态、折叠动画、Inspect 入口） | 低（观感） |
| **T5** | 卡片像素级视觉回归 | **可做了**（见 P2.6 更正）：先把该 step 的「已调用工具」折叠行点开再截图 | 低 |
| **T9** | PRD Phase 3 · 行内 ` ```arch-yaml ` 预览 | PRD §7 Phase 3 第 1 条，双通道容错 | 观望 |
| **T10** | PRD Phase 3 · 节点点击详情面板 | 悬停高亮已做；点击开面板未做 | 观望 |
| **T11** | `layout` 的手动通道 | 已裁决 layout 不进模型文档、留给用户手改 YAML；「改完看效果」由 T1 的 `yaml_to_drawio` 承担 | 由 T1 覆盖 |
| **T12** | 发布通路 | `dsh plugin add @gjy_1992/dsh-diagram` 需 npm 发布 + 版本流程（PRD §6.4） | **押后**（用户裁决） |

### 不做（用户裁决，留档避免反复讨论）

| ID | 项 | 裁决 |
| :--- | :--- | :--- |
| **T4** | `save_drawio` 端到端复验 | ✅ 已完成 |
| **X1** | 用 draw.io 客户端打开浏览器下载的 .drawio | 不做：不强求用户装 draw.io（Phase 1 已用桌面版验过宿主产物） |
| **X2** | 改变宿主的 step 折叠默认行为 | 不做：`message.stepProcess` 属 ui-chat（`shadows-shipped-ui`），插件只旁路（T6），不替宿主决定 |

### 第二轮决策

| ID | 决策 | 说明 |
| :--- | :--- | :--- |
| **P2-D7** | 发布押后 | 先把功能做完整，发布通路最后再谈 |
| **P2-D8** | T1 从「单向 drawio→yaml」升级为**双向文件级工具对** | `yaml_to_drawio`（新增）+ `drawio_to_yaml`。动机：`layout` 是留给**用户手改 YAML** 的，改完要能"看到效果"，所以需要一个以**文件路径**为入口的渲染工具。`render_architecture` 是模型内联写 YAML 的通道，不该被用来反复渲染用户手改的文件 |
| **P2-D9** | 放弃 draw.io 客户端验证 | 见 X1 |
| **P2-D10** | 折叠问题用 turnTail 旁路，不覆盖宿主 | 见下 |

### T6 技术方案（回合末尾再现卡片）

**根因（实测定位）**：工具调用渲染在 ui-chat 的 **step 过程折叠行**内（locale key `message.stepProcess.done.tools` = 「已调用工具」），回合结束后默认收起；折叠态下子元素仍挂在 DOM（`getBoundingClientRect()` 有值）但**不绘制** —— 这既解释了用户看到的"卡片被折叠"，也解释了 P2.6 里我截图总截到旁白的原因（此前归因为"分页层"，**此处更正**）。

**做法**：向 `conversation.chat.turnTail`（list 槽，scope session）注册一个 **fresh id** `dsh-diagram-turn-preview` 的条目，在**回合末尾**渲染本轮架构图的紧凑预览（标题 + 缩略 SVG + 下载按钮），与工具行是否折叠无关。

**槽位契约（inspect 实测）**：

* 注册项：`{ name, id, order?, label? }`；"A fresh `id` adds an entry; entries without content return null."
* owner props：`{ turn: TurnLocation; seq: number; openFile: (path: string) => void }`
* `TurnLocation`：`{ turn, start, end, status, steps, data }`（`packages/client/ui-conversation/src/client/contract/conversation.ts:95`）

**先例（用户 profile 里现成跑着的第三方实现）**：`dsh-univer-office` 的 `univer-turn-preview`（`lib/client.js` 约 23306–23355），三条可抄的经验：

1. `inject = ['slots', 'locale', 'conversation', 'uiConversation']`，并 `uiConversation.events.register(<事件定义>)`（对 "already registered" 容错）来承载"本回合有哪些工件"的数据。
2. 新契约用 `{ name, id, locale, inject }` 注册；若宿主抛 `requires options.select`，退回旧契约 `{ name, priority: -10, locale, select, inject }` —— 兼容分支照抄一份防御（本机 0.1.7-rc.2 应走新契约）。
3. list 槽给的是 owner props 而非 chain 的 `matched`，**条目组件自己解析本回合并匹配**。

**验收**：连续两次调用 `render_architecture`，回合结束后**不展开任何折叠行**即可在回合末尾看到图；点下载能拿到 .drawio。

### 分工与写作用域（互不重叠）

| 工作流 | 负责 | 写作用域 |
| :--- | :--- | :--- |
| T1 双向文件工具 | 子代理 `t1-roundtrip` | `packages/drawio/src/parse-drawio.ts`(新)、`packages/drawio/src/index.ts`、`plugin/src/tools/files.ts`(新)、`plugin/src/host.ts` |
| T2 合并报告 | 主代理 | `packages/schema/src/validate.ts`、`packages/schema/src/diagnostics.ts` |
| T6 turnTail 再现 | 主代理（T2 之后） | `plugin/src/client.tsx`、`plugin/src/diagram/*` |
| **打包与安装** | **只由主代理做** | `plugin/index.js`、`plugin/client.js`、`scripts/build-plugin.mjs` |

打包独占的理由：`node scripts/build-plugin.mjs` 会同时重写两半产物，两个写者并发会互相覆盖。子代理只用 `tsx`/CLI 验证纯逻辑，产物由主代理统一重建（宿主半改动需重启才生效，攒到一次重启）。

## P2.6 S2 执行结果（2026-10-01）：SVG 深色预览卡片

### 落地结构

| 文件 | 职责 |
| :--- | :--- |
| `packages/schema/src/browser.ts` | 浏览器入口：**只有** types + `parseYaml` + `normalizeSpec`，刻意不含 Ajv |
| `packages/schema/src/normalize.ts` | 从 `validate.ts` 抽出的填缺省函数，宿主与浏览器共用（两侧口径不漂移） |
| `plugin/src/diagram/scene.ts` | 纯场景构建：`LayoutResult` → 矩形 / 折线 / 文本图元 + 调色 |
| `plugin/src/diagram/DiagramCanvas.tsx` | React 画布：pan/zoom、hover 高亮入出边、适应宽度/整图/±/下载 工具条 |
| `plugin/src/client.tsx` | 卡片行头 + 生命周期：从 `yaml_spec` 现场 `parse → normalize → layout → scene` |

### 三条关键实现口径

1. **浏览器半绝不能有 Ajv**：`layout/layering.ts` 有一处 `MAX_GROUP_LEVELS` 的**值**导入走的是包根 specifier，而包根 `export * from './validate'`（Ajv + 编译 schema 的 `new Function`）。构建脚本因此把包根 specifier **别名**到 `browser.ts`（这是必须，不是优化）——实测客户端产物 Ajv 痕迹 **0**，引擎痕迹在。
2. **SVG 坐标 1 单位 = 1px**：`<svg>` 的 viewBox 就是容器像素，屏幕 ↔ 内容换算只有一层 `(p - view) / k`；初始按适应宽度且不放大超过 1:1，过高时容器截断并允许纵向拖动。
3. **预览与导出同源**：卡片与「下载 .drawio」用同一份 `LayoutResult`，所以所见与文件所出逐点一致。

### 验收（真实运行时，不是单测）

| 验收项 | 结果 | 证据 |
| :--- | :--- | :--- |
| SVG 渲染 | ✅ 6/8 张卡片带 SVG（3 次成功 + 3 次因落盘被拒但图本身有效）；样例为 9 节点 / 4 分组框 / 8 箭头 / 5 标签 | DOM 枚举 |
| 文字不溢出卡片 | ✅ 9 个节点全部 `overflowY ≤ -12px`、`overflowX ≤ -19px`，`worstOverflow = 0` | `getBBox()` 几何自检 |
| 适应宽度 | ✅ `translate(15.29 15.29) scale(0.9556)`，正好是 `margin×k` 与 `hostWidth/contentW` | transform 读取 |
| 滚轮缩放 | ✅ `scale 1.3697 → 1.9632`，`translate` 同步（以光标为锚点） | 派发 wheel 前后比对 |
| 悬停高亮入出边 | ✅ 悬停 1 个节点 → 3 条相连边转 `#38bdf8`、其余 5 条 `opacity 0.22`、节点描边转 `#38bdf8` | stroke / opacity 统计 |
| 下载 .drawio | ✅ Blob 11,264 B / `application/xml;charset=utf-8` / 文件名 `dsh-diagram Phase 2 插件架构.drawio` / 内容 `<mxfile host="dsh-diagram">…<mxGraphModel>` | 拦截 `URL.createObjectURL` 与 `HTMLAnchorElement.click` |
| 客户端热更新 | ✅ 重打包后**刷新页面**即生效，无需重启 dsh | 刷新前后「带 SVG 的卡片数」3 → 6 |
| 失败卡片仍出图 | ✅ `save_drawio` 被拒的卡片现在「图 + 错误文本」同时可见 | 卡片数 6/8 的由来 |

### 验证手段的限制（如实记录）

* **卡片像素截图（此处更正早先的归因）**：截图失败的原因**不是**"分页式对话层"，而是工具行位于 ui-chat 的 **step 过程折叠行**（「已调用工具」）内部 —— 折叠态下子元素仍挂在 DOM（`getBoundingClientRect()` 有值）但**不绘制**，同坐标的 `elementFromPoint()` 返回可见的旁白 `<p>`，于是 `locator.screenshot()` 卡在 actionability 超时、`page.screenshot({clip})` 只能截到旁白。**绕法**：先把该 step 的折叠行点开再截图（T5 因此从"不可得"改为"可做"，并把根因与旁路方案登记为 T6）。
* **下载事件拦不到**：BrowserRig 是扩展承载页，Chromium 禁掉了 `Browser.setDownloadBehavior`。改为拦截 `URL.createObjectURL` + `anchor.click`，证明「浏览器里生成了正确的字节与文件名」；真正的保存动作由浏览器自己完成。

## P2.7 T1 执行结果（2026-10-01）：文件级双向工具对

> §P2.5 的 T1 行原本指向「P2.7 任务书」，而任务书只存在于派发时的那份 prompt 里、并未落盘。本节同时承担**契约**与**结果**记录。

### 交付物

| 文件 | 职责 |
| :--- | :--- |
| `packages/drawio/src/parse-drawio.ts` | **新建**：明文 `.drawio` → YAML DSL 反解。纯函数、零 `node:*` 依赖（包根会被客户端产物内联，压缩页解压靠注入 `InflateRaw`） |
| `packages/drawio/src/index.ts` | 加一行 `export * from './parse-drawio';` |
| `plugin/src/tools/files.ts` | **新建**：`yaml_to_drawio` + `drawio_to_yaml` 两个宿主工具的工厂 |
| `plugin/src/host.ts` | `apply()` 里注册两个新工具；`formatDiagnostics` 以**依赖注入**传入，避免 host.ts ↔ tools/files.ts 循环 import |
| `scripts/roundtrip-check.ts` | **新建**：往返一致性 / 幂等 / 压缩页 / 手改降级的程序化断言 |

### 契约

| 工具 | 参数 | 输出 | 失败通道 |
| :--- | :--- | :--- | :--- |
| `yaml_to_drawio` | `path`(必填) / `save_drawio`(可选，**缺省 true**) | `{ groups, nodes, edges, width, height, file_name, saved_path? }`（与 `render_architecture` 同构） | `throw new Error(formatDiagnostics(...))`（复用 `render_architecture` 的实现） |
| `drawio_to_yaml` | `path`(必填) | `{ yaml_spec, warnings }` | 压缩页解压失败 / 非 draw.io 明文 / 无任何节点 → `throw`；**部分**不可还原 → `warnings` |

关键行为：**`.drawio` 落在 YAML 同目录**（不是会话 cwd）；文件名取 `meta.title`，缺失时回落到「YAML 文件名去扩展名」；读文件后补发 `fs/observed`，否则模型紧接着 `edit` 这个 YAML 会被 `fs-observation-policy` 判 `FS_NOT_OBSERVED`（README 明说「直接 ctx.fs 读取不发 fs/observed」）。

### 验收（命令与输出）

```text
$ pnpm exec tsx scripts/roundtrip-check.ts
往返一致性检查：YAML → buildDrawio → parseDrawio → YAML

✅ 一致  examples/03-rpc-items.yaml  (3 分组 / 6 节点 / 7 连线)
✅ 一致  examples/04-nested-groups.yaml  (5 分组 / 5 节点 / 4 连线)

手改夹具（examples/03-rpc-items.yaml，5 处外科手术）反解告警 7 条：
  · 文件里有 2 个 <diagram> 页，只反解了第一页。
  · 分组 'g_infra'：style 里既没有 dashed 也没有 fillColor，variant 已回落为默认的 dashed。
  · 节点 'director'：配色不在引擎调色板里（fillColor=#123456），variant 已回落为 default。
  · 连线 'e_0'：两个方向都没有箭头，DSL 无此形态，已按有无 dashed 处理。
  · 顶点 'free_note' 看起来不是本工具导出的卡片（…）：已按普通节点收下（title 取纯文本、variant=default），请人工确认是否保留。
  · 已丢弃 17 个 cell 的几何坐标（x / y / width / height）：DSL 不含坐标，重新渲染时由布局引擎重排。
  · layout 三项（direction / inner_direction / max_columns）不写在 .drawio 里，未还原；需要时请手工补写。
```

额外跑通了全部 5 个合法样例（`examples/01,02,03,04,05`）：`id 集合 + title/desc/items/variant/group/parent/from/to/label/style` 逐条一致、反解产物自身可再校验、二次往返逐字节幂等、压缩页与明文结果相同。`pnpm build`（tsc strict，`& "$PWD\node_modules\.bin\tsc.cmd" --noEmit`）exit 0。

### 关键结论：`presentationMeta` → 客户端 `meta` **成立**（已验证）

| 环节 | 证据 |
| :--- | :--- |
| 投影器只在**根调用**上执行 | `dsh/packages/core/tools/src/index.ts:1845`（`if (exec.parent === undefined && tool.output.presentationMeta !== undefined)`），结果落 `meta`（同文件 `:1852`、`:1859`） |
| `tool/result` 事件**携带** `meta` | `dsh/packages/core/agent-loop/src/tool-calls.ts:288`（`...result.meta !== undefined ? { meta: result.meta } : {}`） |
| 事件 schema 允许 `meta` | `dsh/packages/core/session/src/types.ts:384`（`meta?: JsonValue`，必须 JSON 可序列化，`Session.append` 用 `isJsonValue` 运行时校验） |
| 客户端投影出 `ToolResultNode.meta` | `dsh/packages/client/ui-chat/src/client/conversation-nodes/tool.ts:77`（`meta: match.event.data.meta`） |
| 类型里就有这个字段 | `dsh/packages/client/ui-conversation/src/client/contract/records.ts:170`（`meta?: unknown`） |
| 视图确实拿得到 | `dsh/packages/client/ui-tool/src/client/tool/ToolCallTree.tsx:57` 把 owner（含 `phase:'result', block: ToolResultNode`）交给 `tool.call.toolview`；类型见 `packages/client/ui-tool/src/client/contract/slots.ts:100/103` |

因此卡片读法为 **`block.meta?.yaml_spec`**，且**零模型上下文开销**（`meta` 只进会话日志，不进模型消息）。

两个必须知道的限制：

1. **PTC 嵌套派发拿不到 meta**：经 `run_code` 派发的子调用 `exec.parent !== undefined`，投影器被跳过（同源注释见 `packages/client/ui-tool/src/client/tool/models/image-card-model.ts:36-38`）。订阅方必须容忍 `meta` 缺失并降级（例如卡片只显示摘要 + 保存路径）。
2. 因此本工具的 `presentationMeta` 用 **`WeakMap<args, yaml>`** 按调用身份取值（`presentationMeta(args, value)` 的 `args` 与 `execute` 的 `args` 是同一个对象：`index.ts:1581` 与 `:1848` 都读 `exec.arguments`）。用模块级变量会在并发调用间串味；已在 `tmp/t1-harness.ts` 里断言「换一个 args 对象取不到别人的 YAML」。

**没有**采用「把 YAML 塞进结果文本」的降级方案（那会进模型上下文、每次请求重复计费）。

### 反解无法还原的清单与降级策略

| 无法还原 | 降级策略 |
| :--- | :--- |
| 几何坐标（x/y/width/height、连线折点） | **丢弃** + 汇总 warning（「已丢弃 N 个 cell 的几何坐标」）。DSL 无坐标，重排由引擎重算 |
| `layout` 三项（direction / inner_direction / max_columns） | **不写** + 固定一条 warning 提示手工补写。它们本来就不在图里 |
| `meta` 的 desc / summary / guide | **丢弃**（`.drawio` 里没有位置存它们）；`meta.title` 从 `<diagram name>` 还原 |
| 自由新增的图形 / 文本框 | **收下**（用户手加的东西也是他改的内容，丢掉更糟）：`title` 取纯文本、`variant=default`，并给一条合并 warning 让用户确认 |
| 自定义样式（配色/形状/字号被改） | 写不出 DSL 的**形状/字号**丢弃；**配色**尽力反查 `NODE_THEME`，查不到则回落 `default` + warning |
| 多页 `<diagram>` | 只反解第一页 + warning |
| 无 `source`/`target` 的浮动连线 | **丢弃** + warning |
| 边 id（`e_0`…） | DSL 里没有边 id，天然丢弃（幂等性不受影响） |

压缩页（draw.io 默认「压缩」保存）**自动解压**（base64 → `inflateRaw` → `decodeURIComponent`），解压失败给可操作文案。反解侧刻意保持零依赖，解压函数由宿主注入，因此 `scripts/roundtrip-check.ts` 能用 node:zlib 注入同一个函数并断言「压缩页与明文逐字节相同」。

## P2.8 T2 执行结果（2026-10-01）：结构 + 引用 + 层级一次报全

### 问题

`validateArchSpec` 在 Ajv 阶段失败即 `return`，拓扑/层级检查根本不跑 —— 模型要先修完结构、再修引用、再修层级，一轮只拿一类错误。PRD §4.3 期望「一次把问题都摆出来」。

### 做法：把引用级检查抽成两条路径共用的唯一实现

* 新增 `RefView`（每个条目只留「能读出来的合法 id」+ 它在原数组中的下标）与 `refViewOf()`：对**任意输入**尽力抽取，绝不抛异常。
* 引用级检查（ID 重复 / node↔group id 冲突 / 外键 / parent 自引用·成环·深度）集中到 `collectReferenceDiagnostics(view)`：
  * 结构通过 → 对 `NormalizedSpec` 跑一遍，全绿才算 ok（行为与历史逐条一致）；
  * 结构失败 → **也**对原始输入跑一遍，两类诊断合并返回。
* 防御式契约：读不出合法 id 的条目一律跳过（该问题 Ajv 已报过），因此不新增失败模式、也不会重复报同一个问题。

### 验收

| 验收项 | 改动前 | 改动后 |
| :--- | :--- | :--- |
| 反例 `tmp/diag-check.yaml`（错误枚举 + 悬空 `edge.from` + 悬空 `parent`） | 1 条（只报枚举） | **3 条**：`SCHEMA_ENUM` + `EDGE_SOURCE_UNKNOWN`（带 did-you-mean）+ `GROUP_PARENT_UNKNOWN` |
| `examples/90-invalid.yaml`（回归） | 5 条、特定顺序 | **同样 5 条、顺序一致**（零漂移） |
| `pnpm build`（tsc strict） | — | exit 0 |
| 5 个合法样例端到端（`cli build-all examples`） | 5/5 | 5/5 |

### 顺带修的一处文案

`formatDiagnostics(diagnostics, subject = 'yaml_spec')`：文件级工具的入参是 `path`，首行若仍说「yaml_spec 中有 N 处问题」，模型会去找一个不存在的 `yaml_spec`。现在 `yaml_to_drawio` 传 `args.path`（`files.ts` 走依赖注入，改动落在 host.ts 一处 + 调用处一处）。

### 客户端集成（同一轮做掉的）

* `plugin/src/client.tsx` 现在注册**两个** keyed toolview（`render_architecture` + `yaml_to_drawio`，generator 形态一次注入）。
* YAML 来源优先级：`args.yaml_spec` → `block.meta.yaml_spec`（`tool/result.meta`，零模型上下文开销）；两者都没有时**显示一行说明**（`run_code` 嵌套调用拿不到 meta），而不是空白卡片。
* 文件级工具没有 title 参数：回落 `YAML 的 meta.title`；`meta.saved_path` 直接显示为「已落盘到 <绝对路径>」（T7）。
* 产物自检：宿主半 476.6 KB（三个工具、`node:zlib` 保持 external）；客户端半 195.8 KB / 22 模块，**Ajv 痕迹 0、parse-drawio 污染 0**（esbuild 全量 tree-shake）。

### 生效条件（重要）

宿主半的改动（T2 的合并报告 + 两个新工具）**必须重启 dsh 才生效**（P2.4 的 C2）；客户端半刷新页面即生效。本轮改动攒到**一次重启**。
