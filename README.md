---
description: "A YAML-driven architecture-diagram engine plus an installable DeepSeek Harness plugin: the zero-graph-library layout and orthogonal-routing engine, the plaintext .drawio exporter, and the Cordis bundle that renders dark preview cards and .drawio downloads inside a dsh conversation."
kind: "repository-reference"
---

# dsh-diagram

English | [中文](README.zh.md)

## Summary

dsh-diagram turns a short YAML description of a system — who contains whom, who calls whom — into a dark, card-style architecture diagram. The description carries **semantics only**: coordinates, line wrapping, layering, orthogonal routing, grouping envelopes, and colors are all computed by the engine, so neither a model nor a human has to think about geometry. The repository ships two things that share one engine: a set of TypeScript workspace packages that validate, lay out, and export diagrams, and an installable [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin that registers three tools, renders the preview card inside the conversation, and exports a plaintext `.drawio` file you can keep editing in draw.io. The layout chain depends on **no graph-layout library** (ELK and dagre were both evaluated and removed); a 50-node diagram lays out in single-digit milliseconds, and the routing invariants are asserted programmatically rather than judged by eye.

## Table of Contents

- [Use this repository](#use-this-repository)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

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
