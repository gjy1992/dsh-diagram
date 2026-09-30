# 需求规格说明书 (PRD)：dsh-diagram 架构图生成与 draw.io 导出插件

| 文档版本 | 创建时间 | 负责人 | 状态 | 适用项目 |
| :--- | :--- | :--- | :--- | :--- |
| v1.0.0 | 2026-09-30 | Core Architecture Team | Draft | DeepSeek Harness (`dsh`) 插件生态 |
| v1.1.0 | 2026-09-30 | Core Architecture Team | Draft | 同上（同步 Phase 1 实施决策：嵌套分组、高度公式、样式映射表、画布自适应、mxfile 容器） |

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
* **程序化自动排版**：前端引入成熟的 DAG 布局引擎（ELK.js / Dagre.js），将几何坐标计算彻底移交算法处理。
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
      ├─► ③ 尺寸预估器：根据 title + items 长度动态计算 Node 宽高
      ├─► ④ 布局计算层 (ELK.js)：运行分层布局，计算出 (x, y) 及正交折线路径
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

* 分组框（Group）尺寸：由 ELK.js 根据其包含的子节点 / 子分组集合，加上内边距（Padding: 24px）**逐层自动包络**计算；坐标为**相对上级容器**（与 draw.io 嵌套容器要求一致）。

**布局间距预设**

| 项 | 值 |
| :--- | :--- |
| 同级分组间距 | 32px |
| 节点同层间距 | 24px |
| 节点跨层间距 | 48px |
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
   * **输出顺序约束**：父 cell 必须先于其子 cell 声明，按层级拓扑序输出。
3. 连线映射：
   生成 `<mxCell edge="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;fontColor=#cbd5e1;labelBackgroundColor=#152238;" source="${edge.from}" target="${edge.to}" parent="1">`。
   * `labelBackgroundColor` 是必需的：draw.io 连线标签默认白底，深色主题下浅色文字会几乎不可读（已实测确认）。
   * 折线路径写入 ELK 计算出的显式 `<Array as="points">`（绝对坐标），保证导出结果与预览一致。
     * 注意：ELK 的 section 坐标是相对「两端点所在分组的最近公共祖先」记录的，跨分组连线才是根画布坐标；同属一个分组的连线需要叠加该分组的绝对偏移才是绝对坐标。
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
   * 拓扑节点数 <= 50 时，ELK.js 在浏览器端的布局计算与 SVG 首次渲染耗时需 < 200ms。
   * draw.io XML 导出计算需在毫秒级内完成。
2. 兼容性：
   * 生成的 .drawio 文件必须百分之百兼容 draw.io 官方 Web 端（app.diagrams.net）及 VS Code Draw.io 扩展插件。
3. 架构解耦：
   * 插件遵循 dsh Cordis 微内核架构标准，支持通过 dsh plugin add @dsh/diagram 单独安装与热卸载。


---

### 7. 实施路线图 (Milestones)

* Phase 1 (MVP)：
  - 完成 YAML Schema 定义与 Ajv 静态校验函数（含分组嵌套的环检测与深度校验）。
  - 完成 ELK.js 布局引擎，支持 groups 多层嵌套（`hierarchyHandling=INCLUDE_CHILDREN`）。
  - 跑通 YAML 到 draw.io 明文 XML 的转换，并导出 PNG 完成功能级验证。
* Phase 2 (dsh Plugin 集成)：
  - 注册 render_architecture Tool。
  - 实现 ToolError 自愈反馈逻辑。
  - 在 dsh-web 构建 SVG 深色预览卡片及导出操作栏。
* Phase 3 (体验增强)：
  - 增加对行内 ```arch-yaml Markdown 块的纯手动预览支持（双通道容错）。
  - 支持节点点击查看详情与连线高亮交互。