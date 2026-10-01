# @gjy_1992/dsh-diagram

用 YAML 描述架构、由引擎自动排版、在对话里出深色卡片预览，并可一键导出原生 `.drawio`。
这是 [dsh（DeepSeek Harness）](https://github.com/gjy1992/dsh-diagram) 的可安装 bundle：装上就会
向 Agent 注册三个工具，并在对话里接管对应的调用行。

YAML 里**只写语义**（谁包含谁、谁调用谁），坐标、折行、分层、正交走线、配色全部由引擎算 ——
模型不需要（也不允许）输出任何坐标或十六进制色值。

## 要求

| 项 | 要求 |
| :--- | :--- |
| dsh | `>= 0.1.7-rc.2`（`peerDependencies` 同时是 dsh 的兼容性闸门，不匹配时整行会被 disable） |
| 运行环境 | 无额外依赖。宿主半只 import dsh 自带的 `@deepseek-ai/dsh-tools`，其余引擎代码在打包时已内联 |

## 安装

在 dsh 里用插件管理器安装（推荐）：

```
plugin_manager  install_bundle   target: @gjy_1992/dsh-diagram
```

或命令行：

```bash
dsh plugin add @gjy_1992/dsh-diagram
```

装上后**宿主半的改动需要重启 dsh 才生效**（Node 会按 URL 缓存模块作业），客户端半刷新页面即生效。

## 三个工具

| 工具 | 什么时候用 | 入参 |
| :--- | :--- | :--- |
| `render_architecture` | 模型自己内联写 YAML 出图 | `title`、`yaml_spec`、`save_drawio?`（缺省 false） |
| `yaml_to_drawio` | 用户手改过某个 `.yaml`，要看效果 | `path`、`save_drawio?`（缺省 **true**，落在 YAML 同目录） |
| `drawio_to_yaml` | 用户在 draw.io 里改过图，要捡回语义 | `path` |

三个工具的失败通道都是**结构化诊断**：一次报全部问题（结构 + 引用 + 层级），带 `path`、错误码和
did-you-mean 候选，模型据此自愈重试。

## YAML 速查

只有 `nodes` 与 `edges` 两个列表本身必填，其余都可选：

```yaml
version: "1.0"
meta:    { title, desc, summary, guide }        # 画布标题与导语
groups:  [{ id, title, variant, parent }]       # 嵌套只用 parent 单向声明，禁 children，最深 3 层
nodes:   [{ id, title, group, desc, variant, items: [rpc:OrderQuery] }]
edges:   [{ from, to, label, style }]
layout:  { direction, inner_direction, max_columns }   # 留给用户手改，不在模型文档里
```

| 字段 | 取值 |
| :--- | :--- |
| `node.variant` | `default` 普通 · `primary` 核心入口 · `danger` 风险/待下线 · `warning` 待治理 · `muted` 弱化 |
| `group.variant` | `dashed` 虚线透明框（默认）· `filled` 实色填充框 |
| `edge.style` | `solid` 单向实线（默认）· `dashed` 虚线 · `bidirectional` 双向 |

`node.items` 用来列该模块承载的 RPC / 接口清单，卡片会按行数自动加高。

## 从 `.drawio` 回到 YAML

`drawio_to_yaml` 能把（明文或 draw.io 默认压缩保存的）`.drawio` 反解成语义 YAML：
分组、节点、连线的语义字段都能还原；几何坐标会被丢弃（DSL 里没有坐标，重排由引擎重算），
自由新增的图形、自定义样式、`layout` 三项也会逐条列在 `warnings` 里供人工确认。

## 结构

```
index.js           宿主半（ESM，三个工具；@deepseek-ai/* 外置，其余内联）
client.js          客户端半（浏览器模块表里的 React 工厂：预览卡片 + 回合末尾预览）
cordis.patch.yml   把插件行插进 profile 的 patch
icon.svg           插件管理页卡片图标
locale/{zh,en}.json 展示标题与描述
```

## 许可

见仓库根目录。
