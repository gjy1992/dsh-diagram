---
description: "dsh-diagram 的可安装 DeepSeek Harness bundle：三个工具（render_architecture / yaml_to_drawio / drawio_to_yaml）架在 YAML 架构 DSL 之上，对话内渲染深色预览卡片，导出明文 .drawio，并提供可自愈的结构化诊断回传。"
kind: "package-reference"
---

# @gjy_1992/dsh-diagram

[English](README.md) | 中文

## Summary

本包是 [dsh-diagram](https://github.com/gjy1992/dsh-diagram) 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）bundle。装上它会注册三个工具，并接管它们在对话里的行：模型（或磁盘上的一个文件）用 YAML 描述系统 —— 谁包含谁、谁调用谁 —— 其余全部由引擎计算。描述里**只写语义**：坐标、折行、分层、正交走线、分组包络、配色都不由模型书写。预览卡片按深色主题在对话里把图渲染出来，也可以导出明文 `.drawio` 继续在 draw.io 里手工精修。校验失败会一次回一份结构化报告 —— 结构、引用、层级三类问题全部列出，每条带路径、错误码和 did-you-mean 候选 —— 模型一轮就能改完。

## Table of Contents

- [Use this package](#use-this-package)
- [用法示例](#用法示例)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

### 安装

安装检出目录即可 —— 仓库里已提交的 `index.js` 与 `client.js` 就是构建产物，不需要先编译或拷贝。

在 dsh 对话里说一句：

> 把 `<repo>\plugin` 这个 bundle 装到当前 profile。

agent 会执行一次 `plugin_manager` 调用 —— 它是 dsh 的工具，不是 shell 命令：

```text
plugin_manager(action: install_bundle, target: <repo>\plugin)
```

Web GUI 的插件页暴露同一套控件，也是 dsh 让你批准依赖构建脚本的地方。profile 由 `dsh` 代写（`link:` 依赖、`dsh.profile.bundles`、patch 里那一行）—— 这三处都不要手改，也不要在 profile 目录里跑 pnpm。

| 要求 | 取值 |
| :--- | :--- |
| `dsh` | `>= 0.1.7-rc.2`。`peerDependencies` 那一行同时是 dsh 的兼容性闸门：超出区间的运行时会把这一行 disable 掉，而不是硬加载 |
| 运行时依赖 | 无。宿主半只 import dsh 自带的 `@deepseek-ai/dsh-tools`；引擎其余部分在打包时已内联 |

**宿主半**的改动需要重启 `dsh`（Node 会按 URL 缓存模块作业）；**客户端半**刷新页面即生效。

### 三个工具

| 工具 | 什么时候用 | 入参 |
| :--- | :--- | :--- |
| `render_architecture` | 模型自己内联写 YAML | `title`、`yaml_spec`、`save_drawio?`（缺省 `false`） |
| `yaml_to_drawio` | 人改了某个 `.yaml`，想看效果 | `path`、`save_drawio?`（缺省 **`true`**，落在 YAML 同目录） |
| `drawio_to_yaml` | 人在 draw.io 里改了图，想把语义捡回来 | `path` |

三个工具的失败通道是同一条：一份结构化报告，含 `path`、错误码与 did-you-mean 候选。

### YAML DSL

只有 `nodes` 与 `edges` 必填，其余都可选。

```yaml
version: "1.0"
meta:    { title, desc, summary, guide }        # 画布标题、副标题、摘要、阅读导语
groups:  [{ id, title, variant, parent }]       # 嵌套只用 parent 单向声明，禁 children 数组，最深 3 层
nodes:   [{ id, title, group, desc, variant, items: [rpc:OrderQuery] }]
edges:   [{ from, to, label, style }]
layout:  { direction, inner_direction, max_columns }   # 刻意不进模型可见的工具描述
```

| 字段 | 取值 |
| :--- | :--- |
| `node.variant` | `default` 普通 · `primary` 核心入口 · `danger` 风险/待下线 · `warning` 待治理 · `muted` 弱化 |
| `group.variant` | `dashed` 虚线透明框（默认）· `filled` 实色填充框 |
| `edge.style` | `solid`（默认）· `dashed` · `bidirectional` |

`node.items` 列该模块承载的 RPC / 接口清单，卡片按条数自动加高。

### 与 `.drawio` 往返

`drawio_to_yaml` 能把 `.drawio` —— 明文的，或 draw.io 默认压缩保存的 —— 反解成语义 YAML：分组、节点、连线的语义字段都能还原。几何坐标会被丢弃（DSL 里没有坐标，下次渲染由引擎重排）；自由新增的图形、自定义样式与 `layout` 三个旋钮会逐条列在 `warnings` 里供人工确认。

## 用法示例

装上本 bundle 之后，下面这条链路就是产品的全部：**一句话进 → 一次工具调用 → 对话里出一张卡片**。示例对象就是构建本 bundle 的那个仓库。

**1 · 用一句话提需求。** *「把 dsh-diagram 这个仓库的结构画成架构图。」* 不提 YAML、不提坐标、不提配色 —— 写 DSL 是模型的事，不是用户的事。

**2 · 模型写出规格。** 只写语义：谁包含谁、谁依赖谁。位置和色值一个都不写，因为两样都由引擎算。下面是它为这个仓库写出的规格：

<details>
<summary>YAML</summary>

```yaml
version: "1.0"

meta:
  title: dsh-diagram 仓库关系图
  desc: packages/ 引擎 · plugin/ 可安装 bundle · scripts/ 构建与验证
  summary: 本图由本仓库自己的引擎渲染：YAML → 校验 → 分层/坐标/走线 → .drawio
  guide: 箭头 = 依赖 / 使用方向（A → B：A 依赖、读取或写出 B）

layout:
  direction: TB

groups:
  - id: g_pkgs
    title: packages/ 引擎（pnpm workspace，零图布局依赖）
    variant: filled
  - id: g_schema
    title: schema
    parent: g_pkgs
  - id: g_layout
    title: layout
    parent: g_pkgs
  - id: g_drawio
    title: drawio
    parent: g_pkgs
  - id: g_core
    title: core
    parent: g_pkgs
  - id: g_plugin
    title: plugin/ 可安装 bundle（刻意不是 workspace 成员）
    variant: filled
  - id: g_scripts
    title: scripts/ 构建与验证
  - id: g_spec
    title: 规格与产物（out/ 已 gitignore）
    variant: dashed

nodes:
  - id: n_types
    title: 类型定义
    group: g_schema
    desc: ArchSpec / Meta / Group / Node / Edge
    variant: primary
  - id: n_validate
    title: 校验器
    group: g_schema
    desc: Ajv draft 2020-12 + 语义检查
    variant: warning
    items:
      - 结构 / 引用 / 层级一次报全
      - 嵌套 parent 环与深度 ≤ 3
      - did-you-mean 候选
  - id: n_parse
    title: YAML 解析
    group: g_schema
    desc: js-yaml，错误转同构诊断
    items:
      - 行号对齐
      - 缺省值填充

  - id: n_sizing
    title: 尺寸预估
    group: g_layout
    items:
      - 固定 240px 宽
      - title / desc / items 行高
  - id: n_layering
    title: 分层
    group: g_layout
    desc: 单元级 Meta-DAG
    items:
      - 入度优先破环
      - 最长路径分层
      - 脊柱-肋骨折叠
  - id: n_placement
    title: 坐标分配
    group: g_layout
    items:
      - (Rank, Order) 虚拟双轴
      - 列槽位对齐矩阵
      - 方向逐层交替
  - id: n_routing
    title: 正交走线
    group: g_layout
    variant: primary
    items:
      - 三类型通道
      - 长边外绕、绕开无关组
      - 交叉全局三轮裁决

  - id: n_model
    title: mxGraphModel
    group: g_drawio
    items:
      - 画布随 bounds 自适应
      - 无压缩明文 mxfile
  - id: n_cells
    title: cell 生成
    group: g_drawio
    items:
      - 分组容器（可嵌套）
      - 卡片 HTML value
      - 显式折线 mxPoint
  - id: n_serialize
    title: 序列化
    group: g_drawio
    items:
      - 父 cell 先于子 cell
      - 转义 & < > "
  - id: n_parse_drawio
    title: 反解 parse-drawio
    group: g_drawio
    desc: .drawio → YAML
    variant: muted
    items:
      - 明文与压缩页
      - 手改降级 + warnings

  - id: n_render
    title: renderArchitecture()
    group: g_core
    desc: parse → validate → layout → export
    variant: primary
  - id: n_cli
    title: CLI
    group: g_core
    desc: validate / build / build-all

  - id: n_host
    title: 宿主半 index.js
    group: g_plugin
    variant: primary
    desc: esbuild 产物，@deepseek-ai/* 外置
    items:
      - render_architecture
      - yaml_to_drawio
      - drawio_to_yaml
  - id: n_client
    title: 客户端半 client.js
    group: g_plugin
    variant: primary
    desc: 浏览器模块表里的 React 工厂
    items:
      - tool.call.toolview 卡片
      - conversation.chat.turnTail 预览
      - 客户端自带引擎（无 Ajv）
  - id: n_patch
    title: cordis.patch.yml
    group: g_plugin
    desc: insert 一行 dsh-diagram
    variant: muted

  - id: n_build_plugin
    title: build-plugin.mjs
    group: g_scripts
    items:
      - esbuild 出两半
      - client 套 __ModuleLoader__ 信封
  - id: n_typecheck
    title: typecheck-plugin.mjs
    group: g_scripts
    desc: 映射 dsh 检出的 .d.ts
  - id: n_selfcheck
    title: verify-plugin-activation.ps1
    group: g_scripts
    desc: 隔离 profile 起新进程
    items:
      - 组合检查（--dump-config）
      - 激活检查（stderr 无告警）
  - id: n_audit
    title: audit-routing.ts
    group: g_scripts
    desc: 走线质量程序化断言
  - id: n_roundtrip
    title: roundtrip-check.ts
    group: g_scripts
    desc: YAML 与 .drawio 幂等

  - id: n_examples
    title: examples/*.yaml
    group: g_spec
    items:
      - 01–05 合法样例
      - 90-invalid 反例
  - id: n_out
    title: out/*.drawio + PNG
    group: g_spec
    variant: muted
    desc: draw.io 桌面版导出

edges:
  - from: n_parse
    to: n_types
    label: 依赖
  - from: n_validate
    to: n_types
    label: 依赖
  - from: n_sizing
    to: n_types
    label: 依赖
  - from: n_layering
    to: n_validate
    label: 常量导入
  - from: n_placement
    to: n_layering
    label: 消费分层
  - from: n_routing
    to: n_placement
    label: 消费坐标
  - from: n_model
    to: n_routing
    label: 消费折线
  - from: n_cells
    to: n_model
    label: 写 cell
  - from: n_serialize
    to: n_cells
    label: 序列化

  - from: n_render
    to: n_validate
    label: 串联
  - from: n_render
    to: n_routing
    label: 串联
  - from: n_render
    to: n_serialize
    label: 串联
  - from: n_cli
    to: n_render
    label: 调用
  - from: n_cli
    to: n_examples
    label: 读入
  - from: n_cli
    to: n_out
    label: 写出

  - from: n_host
    to: n_render
    label: 内联打包
  - from: n_client
    to: n_parse
    label: 自带引擎
  - from: n_client
    to: n_routing
    label: 布局
  - from: n_client
    to: n_serialize
    label: 导出
  - from: n_patch
    to: n_host
    label: 插入行

  - from: n_build_plugin
    to: n_host
    label: 生成
  - from: n_build_plugin
    to: n_client
    label: 生成
  - from: n_typecheck
    to: n_client
    label: 类型检查
  - from: n_selfcheck
    to: n_host
    label: 激活自检
  - from: n_audit
    to: n_routing
    label: 断言
  - from: n_roundtrip
    to: n_parse_drawio
    label: 往返
  - from: n_roundtrip
    to: n_examples
    label: 读夹具
```

</details>

**3 · 调一次工具。**

```text
render_architecture(
  title     = "dsh-diagram 仓库关系图",
  yaml_spec = <上面的 YAML>
)
```

这次调用在对话里只留一行正文 —— 从不回 XML：

```text
已生成架构图：8 个分组 / 23 个节点 / 27 条连线，画布 2352×1540；预览卡片已挂在对话中，可导出 dsh-diagram 仓库关系图.drawio。
```

**4 · dsh 把卡片渲染出来。** 可缩放、连线悬浮高亮；下面的 PNG 就是同一份布局经 draw.io 导出的结果：

<img src="https://raw.githubusercontent.com/gjy1992/dsh-diagram/master/repo-map.png" width="1100" alt="dsh 对话里为该仓库渲染出的预览卡片">

**5 · 顺手拿走文件，或者下次再来。** `save_drawio: true` 会把 `.drawio` 写进会话工作区，可以继续在 draw.io 里精修；`drawio_to_yaml` 把手改过的图变回 YAML，同一条闭环能再跑一遍。规格写错时也只回一份报告：每个问题都带路径与 did-you-mean 候选。

## Understand the implementation

### 两半

| 文件 | 属于 | 是什么 |
| :--- | :--- | :--- |
| `index.js` | 宿主半 | ESM bundle。注册三个工具；`@deepseek-ai/*` 保持 external（必须是运行时那一份实例），整个引擎内联 |
| `client.js` | 客户端半 | 浏览器模块表里的工厂（`window.__ModuleLoader__.load`）。渲染预览卡片与回合末尾预览；`react` 来自浏览器模块表，其余内联 |
| `cordis.patch.yml` | — | 把 `dsh-diagram` 行插进 profile |
| `locale/{en,zh}.json` | — | 展示标题与描述，不激活插件也能读到 |
| `icon.svg` | — | 插件管理页卡片图标 |

客户端半刻意自带一份引擎、现场重新解析 `yaml_spec`：卡片零模型上下文开销，replay / fork 出来的会话不需要回宿主一趟就能复现同一张图。浏览器侧用的 schema 入口完全不含 Ajv，所以客户端产物里没有校验器。

### 两半怎么构建

仓库里的 `scripts/build-plugin.mjs` 跑两次 esbuild：宿主半出 ESM，`@deepseek-ai/*` 外置；客户端半出 CJS 主体，再套 `__ModuleLoader__` 信封，`react` / `react/jsx-runtime` 留给浏览器模块表。干净重建是确定性的 —— 无 diff。

宿主半要 import `@deepseek-ai/dsh-tools`，而这个 import 必须解析到运行时用的同一个模块实例。当插件以**目录链接**方式安装时，dsh 只有在包的 `peerDependencies` 里声明了它，才会把这个 bare specifier 路由到运行时包表；没声明就落到原生解析，整行以一句光秃秃的 `failed to import` 失败。

### 文件落在哪

`yaml_to_drawio` 写在它读的那个 YAML 文件旁边（不是会话工作目录），文件名取 `meta.title`。`render_architecture` 只在 `save_drawio: true` 时写到会话工作目录。写入走宿主 fs 服务，因此受会话文件策略治理，并计入工作区变更。

## Further Exploration

- 仓库、`prd.md`、`PLAN.md`、`design.md`：<https://github.com/gjy1992/dsh-diagram> —— `PLAN.md` 记录了本 bundle 背后每一次实测与每一个坑，包括上面那条 peer 路由要求。
- 仓库里的 `examples/`：5 份合法规格 + 1 份专门练诊断的反例。

## Model Experience

### 模型看到什么

工具描述就是完整契约：字段、三个枚举、嵌套规则，以及「禁止坐标与十六进制色值」。调用成功只回一行统计 —— `N 个分组 / N 个节点 / N 条连线，画布 W×H` —— 从不回 XML，所以一张大图不会在每次请求上重复计费。卡片需要的数据走 tool-result 元数据：能到客户端，不进模型上下文。

### Token 影响

模型只写 YAML。一张 9 节点、带分组卡片与 RPC 列表的图是几百 token；等价的裸 draw.io XML 要大一个数量级，而且照样排得难看。

## Known Limitations and Deferred Work

- **不存在行内 ` ```arch-yaml ` 围栏预览。** 宿主的 markdown 渲染器只吃 props —— 没有围栏注册表，内部也没有槽位 —— 所以围栏永远渲染成普通代码块，本 bundle 只能把预览作为一行卡片附加在旁边。
- **预览不构成像素级保证。** 几何与预览的一致性是程序化断言的（走线不变量、不穿节点），但栅格化后的观感靠肉眼。
- **宿主半改动需要重启。** Node 按 URL 缓存模块作业（失败的和成功的都缓存），所以修好的 import 路径无法在正在运行的进程里重试。

### Dev Note

本 bundle 是**构建产物**，不是手写文件。改仓库里的 `plugin/src/**` 然后跑 `pnpm build:plugin`；提交进仓库的 `index.js` 与 `client.js` 就是构建输出，仓库里的 `pnpm verify:activation` 会起一个一次性 profile 证明结果真的能激活。

## License

MIT —— 见[仓库 LICENSE](https://github.com/gjy1992/dsh-diagram/blob/master/LICENSE)。