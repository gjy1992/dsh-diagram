---
description: "A YAML-driven architecture-diagram engine plus an installable DeepSeek Harness plugin: the zero-graph-library layout and orthogonal-routing engine, the plaintext .drawio exporter, and the Cordis bundle that renders dark preview cards and .drawio downloads inside a dsh conversation."
kind: "repository-reference"
---

# dsh-diagram

English | [中文](README.zh.md)

## Summary

dsh-diagram turns a short YAML description of a system — who contains whom, who calls whom — into a dark, card-style architecture diagram. The description carries **semantics only**: coordinates, line wrapping, layering, orthogonal routing, grouping envelopes, and colors are all computed by the engine, so neither a model nor a human has to think about geometry. The repository ships two things that share one engine: a set of TypeScript workspace packages that validate, lay out, and export diagrams, and an installable [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin that registers three tools, renders the preview card inside the conversation, and exports a plaintext `.drawio` file you can keep editing in draw.io. The layout chain depends on **no graph-layout library** (ELK and dagre were both evaluated and removed); a 50-node diagram lays out in single-digit milliseconds, and the routing invariants are asserted programmatically rather than judged by eye.

## Table of Contents

- [What it gives you](#what-it-gives-you)
- [Usage example](#usage-example)
- [Use this repository](#use-this-repository)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## What it gives you

One YAML description in, three tools out. This is the plugin's whole surface:

| Tool | What it does | Arguments | Returns |
| :--- | :--- | :--- | :--- |
| `render_architecture` | the model writes the YAML inline; a preview card appears in the conversation | `title` (required), `yaml_spec` (required), `save_drawio?` (default `false`) | `groups` / `nodes` / `edges` / `width` / `height` / `file_name`, plus `saved_path` when it wrote a file |
| `yaml_to_drawio` | render a `.yaml` a human edited — the `.drawio` is written **next to the YAML** | `path` (required), `save_drawio?` (default **`true`**) | the same shape as above |
| `drawio_to_yaml` | the return trip: a `.drawio` adjusted by hand goes back to semantic YAML | `path` (required) | `yaml_spec` + `warnings[]` (geometry, free-hand shapes, custom styles, the three `layout` knobs) |

What that buys you inside a conversation:

- **A dark preview card rendered in the chat** — zoomable, with hover-highlighted edges. The card is drawn from tool-result metadata, so even a 50-node diagram costs no extra model context.
- **A plaintext `.drawio`** you can keep editing in draw.io: uncompressed XML that matches the CLI's output byte for byte apart from the `<diagram>` id/name, so there is no lock-in.
- **A round trip** — `drawio_to_yaml` recovers titles, descriptions, `items`, variants and nesting from a hand-edited file, and lists what it could not recover instead of guessing.
- **One structured failure report** — every structural, reference and hierarchy problem at once, each with a path, a code and a did-you-mean candidate (capped at 12 lines), so the model fixes them in a single retry.

## Usage example

Nothing below is hand-drawn, and this is the product end to end: **a sentence in → one tool call → a card in the conversation**. The subject is this repository itself.

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

<img src="repo-map.png" width="1100" alt="The preview card rendered in dsh for the dsh-diagram repository">

**5 · Keep the file, or come back later.** `save_drawio: true` writes the `.drawio` into the session workspace for further editing in draw.io, and `drawio_to_yaml` turns a hand-edited diagram back into YAML so the loop can run again. A spec with mistakes comes back the same way — one report listing every problem with its path and a did-you-mean candidate.

## Use this repository

### Install the plugin

The plugin lives in [`plugin/`](plugin) as a self-contained bundle (deliberately *not* a workspace member). Install it into a `dsh` profile either from npm, or straight from a checkout:

```
plugin_manager  install_bundle   target: C:\path\to\dsh-diagram\plugin
```

```bash
dsh plugin add @gjy_1992/dsh-diagram
```

A change to the plugin's **host half** needs a `dsh` restart to take effect (Node caches module jobs by URL); the **client half** reloads on a page refresh. See [`plugin/README.md`](plugin/README.md) for the three tools and the YAML cheat sheet.

### Run the engine from the command line

```bash
pnpm install
pnpm cli validate examples/03-rpc-items.yaml      # structured diagnostics, exit 0/1
pnpm cli build examples/03-rpc-items.yaml -o out  # -> out/03-rpc-items.drawio
pnpm build:examples                               # every example at once
```

### Verify

Every claim this project makes has a command behind it:

| Command | What it proves |
| :--- | :--- |
| `pnpm build` | the whole workspace type-checks under `strict` |
| `pnpm build:examples` | five valid specs render end to end; the invalid one fails with structured errors |
| `pnpm audit:routing` | non-orthogonal segments, node crossings, unrelated-group crossings, and edge crossings are counted per example (the first three must be 0) |
| `pnpm verify` | renders every example and exports each `.drawio` to PNG through the local draw.io desktop CLI |
| `pnpm build:plugin` | builds both plugin halves with esbuild (deterministic: a clean rebuild produces no diff) |
| `pnpm verify:activation` | boots an isolated `dsh` profile in a fresh process and asserts the plugin composes *and* activates |
| `pnpm roundtrip` | `YAML → .drawio → YAML` stays faithful and idempotent |

`pnpm typecheck:plugin` additionally needs a built `dsh` source checkout (see [Known Limitations](#known-limitations-and-deferred-work)).

## Understand the implementation

### Two halves, one engine

```text
schema  ──►  layout  ──►  drawio  ──►  core        (engine, pnpm workspace)
                                        │
                    plugin/src/host.ts ─┘           (three tools; engine inlined at build time)
                    plugin/src/client.tsx           (preview card; engine runs in the browser)
```

| Path | Responsibility |
| :--- | :--- |
| [`packages/schema`](packages/schema) | TypeScript types, a hand-written JSON Schema, Ajv validation, topology and hierarchy checks, `js-yaml` parsing, structured diagnostics with did-you-mean hints |
| [`packages/layout`](packages/layout) | Node sizing and text metrics, unit-level meta-DAG layering, spinal-rib in-line folding, gravity-ordered placement on a virtual two-axis `(Rank, Order)` model, orthogonal corridor routing |
| [`packages/drawio`](packages/drawio) | `mxGraphModel` generation, container/card/edge cells, the dark style map, plaintext serialization — and `parse-drawio`, the reverse direction |
| [`packages/core`](packages/core) | `renderArchitecture()`, the host-agnostic orchestrator (`parse → validate → layout → export`), plus the CLI |
| [`plugin`](plugin) | The installable `dsh` bundle: a host half with three tools and a client half with the preview card and the end-of-turn preview |

### Why the layout is self-written

The original design called for ELK.js. Two measured dead ends killed it: a single global layering pass pushed parallel chains into diagonal misalignment, and `compound` layout with `SEPARATE_CHILDREN` silently **dropped every edge crossing a child boundary**, so nothing containing a sub-group could be ordered at all. The engine now builds its own unit-level DAG, breaks cycles in-degree-first, layers by longest path, folds companion chains into the same row, sorts layers by gravity barycenter, and routes every edge through typed corridors. The full chain runs in 1–13 ms for 50 nodes (the ELK prototype took 284 ms).

### Verification style

The project's rule is that a claim needs a command: routing invariants are asserted in code (`pnpm audit:routing`), the plugin's activation is asserted by booting a throwaway profile in a fresh process (`pnpm verify:activation`), and the two export paths are compared byte-for-byte (the CLI `.drawio` and the tool-written one differ only in the `<diagram>` id/name).

## Further Exploration

- [`prd.md`](prd.md) — the requirements specification, including the DSL and the layout algorithm at spec level.
- [`PLAN.md`](PLAN.md) — the working plan and decision log: every measurement, every reversed decision, and every known trap (Node module-job caching, `pointer capture` swallowing clicks, peer-based module routing, PowerShell encoding).
- [`design.md`](design.md) — the layout Spec v2.0 (virtual two-axis model, folding gates, corridor types).
- [`examples/`](examples) — five valid specs (minimal, groups, dense `items`, three-level nesting, 50-node stress) and one invalid spec that exercises the diagnostics.

## Model Experience

### What the model sees

Three tools, one line of prose each in the transcript, and structured failures:

- `render_architecture` — the model writes the YAML inline; the tool description carries the whole DSL contract (fields, three enums, the "no coordinates, no hex colors" rule).
- `yaml_to_drawio` / `drawio_to_yaml` — file-level channels for a human-edited spec or a hand-adjusted `.drawio`.
- Success returns one summary line (`N groups / N nodes / N edges, canvas W×H`), never the XML: the `.drawio` stays on the host unless a file is asked for, and the card's data travels through tool-result metadata instead of the model context.
- Failure returns every structural, reference, and hierarchy problem at once, each with a path, a code, and a did-you-mean candidate, capped at 12 lines — the model fixes them in one retry instead of one error per turn.

### Token effect

The YAML DSL is the only thing the model writes. A nine-node diagram with grouped cards and RPC lists costs a few hundred tokens of YAML; the equivalent raw draw.io XML would cost an order of magnitude more and would still be laid out badly, because models are poor at absolute coordinates.

## Known Limitations and Deferred Work

- **Inline ` ```arch-yaml ` fence preview (PRD Phase 3) is shelved.** The markdown renderer in `dsh-client-ui-primitives` takes props only — no code-fence registry, no slot inside it — so a plugin cannot substitute a preview in place of a fenced block without shadowing the whole assistant chat node. A newly found path (a plugin-owned Conversation Definition plus a `conversation.chat.node` view) can add a **row in the flow**, but not replace text inside the message; it awaits a decision. See `PLAN.md` §P2.15.
- **`pnpm typecheck:plugin` needs a built `dsh` source checkout.** The installed desktop runtime ships no `@deepseek-ai/cordis` type declarations, so type checking the plugin halves from the packaged app alone would be a false green.
- **Pixel-level card regression has not been automated.** The workaround (expand the host's collapsed step row before screenshotting) is known, but the check is manual.
- **The Windows verification scripts are not portable.** `pnpm verify` and `pnpm verify:activation` drive the local draw.io desktop CLI and the installed Electron runtime through PowerShell.

### Dev Note

`PLAN.md` is the source of truth for *why* things are the way they are. Before changing layout or routing behavior, read its decision log (§7 and Phase 2) — several plausible-looking improvements were measured, rejected, and recorded there, including the two ELK dead ends and the global three-round crossing arbitration.

## License

MIT — see [`LICENSE`](LICENSE).