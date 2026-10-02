---
description: "The installable DeepSeek Harness bundle for dsh-diagram: three tools (render_architecture, yaml_to_drawio, drawio_to_yaml) over a YAML architecture DSL, a dark preview card rendered inside the conversation, plaintext .drawio export, and the self-healing structured-diagnostics channel."
kind: "package-reference"
---

# @gjy_1992/dsh-diagram

English | [中文](README.zh.md)

## Summary

This package is the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) bundle for [dsh-diagram](https://github.com/gjy1992/dsh-diagram). Installing it registers three tools and takes over their rows in the conversation: the model (or a file on disk) describes a system in YAML — who contains whom, who calls whom — and the engine computes everything else. The description carries **semantics only**: coordinates, line wrapping, layering, orthogonal routing, grouping envelopes, and colors are never written by a model. A preview card renders the diagram in the dark theme inside the chat, and a plaintext `.drawio` file can be exported for further hand-editing in draw.io. Validation failures come back as one structured report — every structural, reference, and hierarchy problem at once, each with a path, a code, and a did-you-mean candidate — so the model can fix them in a single retry.

## Table of Contents

- [Use this package](#use-this-package)
- [Usage example](#usage-example)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

### Install

Install the checkout — the committed `index.js` and `client.js` are the build output, so nothing needs building or copying first.

Ask dsh in a conversation:

> Install the bundle at `<repo>\plugin` into this profile.

That is one `plugin_manager` call — a dsh tool, not a shell command:

```text
plugin_manager(action: install_bundle, target: <repo>\plugin)
```

The Web UI's plugin page exposes the same controls, and is also where dsh asks you to approve package build scripts. `dsh` writes the profile for you (the `link:` dependency, `dsh.profile.bundles`, the patch row) — do not edit those by hand or run pnpm in the profile directory.

| Requirement | Value |
| :--- | :--- |
| `dsh` | `>= 0.1.7-rc.2`. The `peerDependencies` entry doubles as dsh's compatibility gate: a runtime outside the range disables the row instead of loading it |
| Runtime dependencies | none. The host half imports only dsh's own `@deepseek-ai/dsh-tools`; the rest of the engine is inlined at build time |

A change to the **host half** needs a `dsh` restart (Node caches module jobs by URL); the **client half** reloads on a page refresh.

### The three tools

| Tool | When to use it | Arguments |
| :--- | :--- | :--- |
| `render_architecture` | the model writes the YAML inline | `title`, `yaml_spec`, `save_drawio?` (default `false`) |
| `yaml_to_drawio` | a human edited a `.yaml` and wants to see the result | `path`, `save_drawio?` (default **`true`**, written next to the YAML) |
| `drawio_to_yaml` | a human edited the diagram in draw.io and wants the semantics back | `path` |

All three fail through the same channel: one structured report with `path`, a code, and did-you-mean candidates.

### The YAML DSL

Only `nodes` and `edges` are required; everything else is optional.

```yaml
version: "1.0"
meta:    { title, desc, summary, guide }        # canvas title, subtitle, summary, reading guide
groups:  [{ id, title, variant, parent }]       # nesting is declared by `parent` only; no `children` array; depth <= 3
nodes:   [{ id, title, group, desc, variant, items: [rpc:OrderQuery] }]
edges:   [{ from, to, label, style }]
layout:  { direction, inner_direction, max_columns }   # kept out of the model-facing tool description
```

| Field | Values |
| :--- | :--- |
| `node.variant` | `default` ordinary · `primary` core entry · `danger` risk / to be retired · `warning` to be governed · `muted` de-emphasized |
| `group.variant` | `dashed` dashed transparent frame (default) · `filled` filled frame |
| `edge.style` | `solid` (default) · `dashed` · `bidirectional` |

`node.items` lists the RPCs or interfaces a module carries; the card grows a line per item.

### Working with `.drawio`

`drawio_to_yaml` converts a `.drawio` file — plaintext or draw.io's default compressed save — back into semantic YAML. Group, node, and edge semantics are restored. Geometry is dropped (the DSL has no coordinates; the engine re-lays-out on the next render), and free-hand shapes, custom styles, and the three `layout` knobs are reported line by line in `warnings` for a human to confirm.

## Usage example

With this bundle installed, the flow below is the product end to end: **a sentence in → one tool call → a card in the conversation**. The subject is the repository that builds the bundle.

**1 · Ask in plain language.** *"Draw the architecture of the dsh-diagram repository."* No YAML, no coordinates, no colours — the DSL is the model's job, not the user's.

**2 · The model writes a spec.** Semantics only: who contains whom, who depends on whom. It never states a position or a hex colour, because the engine computes both. This is the spec it produced for this repository:

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

**3 · It calls one tool.**

```text
render_architecture(
  title     = "dsh-diagram 仓库关系图",
  yaml_spec = <the YAML above>
)
```

The call returns a single line in the transcript — never XML:

```text
已生成架构图：8 个分组 / 23 个节点 / 27 条连线，画布 2352×1540；预览卡片已挂在对话中，可导出 dsh-diagram 仓库关系图.drawio。
```

**4 · dsh renders the card.** Zoomable, with hover-highlighted edges; the PNG below is that same layout exported through draw.io:

<img src="https://raw.githubusercontent.com/gjy1992/dsh-diagram/master/repo-map.png" width="1100" alt="The preview card rendered in dsh for the dsh-diagram repository">

**5 · Keep the file, or come back later.** `save_drawio: true` writes the `.drawio` into the session workspace for further editing in draw.io, and `drawio_to_yaml` turns a hand-edited diagram back into YAML so the loop can run again. A spec with mistakes comes back the same way — one report listing every problem with its path and a did-you-mean candidate.

## Understand the implementation

### The two halves

| File | Half | What it is |
| :--- | :--- | :--- |
| `index.js` | host | ESM bundle. Registers the three tools; `@deepseek-ai/*` stays external (it must be the runtime's own instance), the whole engine is inlined |
| `client.js` | client | A browser module-table factory (`window.__ModuleLoader__.load`). Renders the preview card and the end-of-turn preview; `react` comes from the browser module table, everything else is inlined |
| `cordis.patch.yml` | — | Inserts the `dsh-diagram` row into the profile |
| `locale/{en,zh}.json` | — | Display title and description, readable without activating the plugin |
| `icon.svg` | — | Plugin-manager card icon |

The client half deliberately carries its own copy of the engine and re-parses `yaml_spec` on the spot: the card costs zero model context, and a replayed or forked session reproduces the same diagram without a host round trip. The schema entry point used in the browser excludes Ajv entirely, so the client bundle contains no validator.

### How the halves are built

`scripts/build-plugin.mjs` in the repository runs esbuild twice: the host half as ESM with `@deepseek-ai/*` external, the client half as a CJS body wrapped in the `__ModuleLoader__` envelope with `react`/`react/jsx-runtime` left to the browser module table. A clean rebuild is deterministic — no diff.

The host half imports `@deepseek-ai/dsh-tools`, and that import must resolve to the same module instance the runtime uses. When the plugin is installed as a linked directory, dsh routes that bare specifier through the runtime's package table **only if the package declares it in `peerDependencies`**; without the declaration the import falls through to native resolution and the row fails with a bare `failed to import`.

### Where files land

`yaml_to_drawio` writes next to the YAML file it read (not into the session working directory), naming the file after `meta.title`. `render_architecture` writes into the session working directory only when `save_drawio: true`. Writes go through the host filesystem service, so they obey the session's file policy and appear as workspace changes.

## Further Exploration

- Repository, `prd.md`, `PLAN.md`, and `design.md`: <https://github.com/gjy1992/dsh-diagram> — `PLAN.md` records every measurement and every trap behind this bundle, including the peer-routing requirement above.
- `examples/` in the repository: five valid specs and one invalid spec that exercises the diagnostics.

## Model Experience

### What the model sees

The tool description is the whole contract: fields, the three enums, the nesting rule, and the ban on coordinates and hex colors. A successful call returns one summary line — `N groups / N nodes / N edges, canvas W×H` — never the XML, so a large diagram does not cost context on every request. The card's data travels through tool-result metadata, which reaches the client but not the model.

### Token effect

The model writes YAML and nothing else. A nine-node diagram with grouped cards and RPC lists is a few hundred tokens; the equivalent raw draw.io XML would be an order of magnitude larger and would still be laid out badly.

## Known Limitations and Deferred Work

- **An inline ` ```arch-yaml ` code-fence preview does not exist.** The host's markdown renderer takes props only — no fence registry, no slot inside it — so the fence always renders as an ordinary code block, and this bundle adds the preview as a card row instead.
- **The preview is not a pixel-level guarantee.** The geometry-preview pairing is asserted programmatically in the repository (routing invariants, no node crossings), but the rasterized appearance is checked by eye.
- **Host-half changes need a restart.** Node caches failed *and* successful module jobs by URL, so a fixed import path cannot be retried inside the running process.

### Dev Note

This bundle is built, not hand-written. Edit `plugin/src/**` in the repository and run `pnpm build:plugin`; the committed `index.js` and `client.js` are the build output, and the repository's `pnpm verify:activation` boots a throwaway profile to prove the result activates.

## License

MIT — see the [repository LICENSE](https://github.com/gjy1992/dsh-diagram/blob/master/LICENSE).