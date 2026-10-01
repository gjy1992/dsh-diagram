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
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

### 安装

```bash
dsh plugin add @gjy_1992/dsh-diagram
```

也可以直接装检出目录（插件目录本身就是一个自包含 bundle）：

```
plugin_manager  install_bundle   target: <repo>\plugin
```

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
