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
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

### Install

```bash
dsh plugin add @gjy_1992/dsh-diagram
```

Or install a checkout directly (the plugin directory is a self-contained bundle):

```
plugin_manager  install_bundle   target: <repo>\plugin
```

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
