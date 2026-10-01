// 由 scripts/build-plugin.mjs 生成，请勿手改（改 plugin/src/client.tsx）。
window.__ModuleLoader__.load({
  id: "@gjy_1992/dsh-diagram",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    (function (module, exports, require) {
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugin/src/client.tsx
var client_exports = {};
__export(client_exports, {
  default: () => client_default
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var NS = "dsh-diagram";
var TOOL_NAME = "render_architecture";
var zh = {
  title: "\u67B6\u6784\u56FE",
  preparing: "\u6B63\u5728\u8BFB\u53D6\u53C2\u6570\u2026",
  running: "\u6B63\u5728\u6E32\u67D3\u2026",
  done: "\u5DF2\u6E32\u67D3",
  failed: "\u6E32\u67D3\u5931\u8D25",
  placeholder: "SVG \u9884\u89C8\u4E0E\u300C\u4E0B\u8F7D .drawio\u300D\u5C06\u5728 S2 \u63A5\u5165\uFF0C\u5F53\u524D\u662F\u5360\u4F4D\u5361\u7247\u3002",
  detail: "\u8BE6\u60C5"
};
var en = {
  title: "Architecture diagram",
  preparing: "Reading arguments\u2026",
  running: "Rendering\u2026",
  done: "Rendered",
  failed: "Render failed",
  placeholder: "SVG preview and .drawio download land in S2; this is the placeholder card.",
  detail: "Details"
};
function flatten(content) {
  return content.map((block) => block.type === "text" && typeof block.text === "string" ? block.text : JSON.stringify(block)).join("\n");
}
function readSlice(block) {
  const settled = typeof block.kind === "string";
  const argsRaw = settled ? block.call?.argsRaw ?? "" : block.phase === "start" ? block.argsRaw ?? "" : null;
  let title = "";
  let yamlSpec = "";
  if (argsRaw !== null && argsRaw !== "") {
    try {
      const parsed = JSON.parse(argsRaw);
      if (typeof parsed.title === "string") title = parsed.title;
      if (typeof parsed.yaml_spec === "string") yamlSpec = parsed.yaml_spec;
    } catch {
    }
  }
  const result = settled ? flatten(block.content ?? []) : null;
  const isError = settled ? block.isError === true : false;
  const state = !settled ? block.phase === "preparing" ? "preparing" : "running" : isError ? "error" : "ok";
  return { argsRaw, yamlSpec, title, result, isError, state };
}
var styles = {
  row: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px 12px",
    border: "1px solid var(--dsw-alias-border-l1)",
    borderRadius: "10px",
    background: "var(--dsw-alias-bg-layer-1)"
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "var(--dsw-alias-label-primary)"
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flex: "0 0 auto"
  },
  name: { fontWeight: 600 },
  summary: {
    flex: "1 1 auto",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--dsw-alias-label-secondary)",
    fontSize: "12px"
  },
  toggle: {
    flex: "0 0 auto",
    border: "none",
    background: "transparent",
    color: "var(--dsw-alias-label-secondary)",
    cursor: "pointer",
    fontSize: "12px",
    padding: "2px 4px"
  },
  body: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "12px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--dsw-alias-label-secondary)",
    background: "var(--dsw-alias-bg-layer-2)",
    border: "1px solid var(--dsw-alias-border-l1)",
    borderRadius: "8px",
    padding: "8px 10px",
    margin: 0,
    maxHeight: "260px",
    overflow: "auto"
  },
  note: {
    fontSize: "12px",
    color: "var(--dsw-alias-label-secondary)"
  }
};
function stateColor(state) {
  if (state === "error") return "var(--dsw-alias-state-error-primary)";
  if (state === "ok") return "var(--dsw-alias-state-success-primary)";
  return "var(--dsw-alias-state-idle-primary)";
}
function DiagramCard(props) {
  const { block, t } = props;
  const slice = readSlice(block);
  const [open, setOpen] = (0, import_react.useState)(false);
  const statusText = slice.state === "preparing" ? t("preparing") : slice.state === "running" ? t("running") : slice.state === "error" ? t("failed") : t("done");
  const summary = slice.title !== "" ? slice.title : statusText;
  const body = slice.result ?? slice.argsRaw ?? "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.row, "data-dsh-diagram-card": TOOL_NAME, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...styles.dot, background: stateColor(slice.state) }, "aria-hidden": true }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.name, children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.summary, children: summary }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: stateColor(slice.state), fontSize: "12px" }, children: statusText }),
      body !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: styles.toggle, onClick: () => setOpen((v) => !v), children: t("detail") })
    ] }),
    slice.state === "ok" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.note, children: t("placeholder") }),
    open && body !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: styles.body, children: body })
  ] });
}
var client_default = {
  inject: ["slots", "locale"],
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-diagram: dictionaries");
    const t = ctx.locale.bind(NS);
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register(
      { name: "tool.call.toolview", key: TOOL_NAME, locale: NS },
      (props) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiagramCard, { ...props, t })
    ));
  }
};

    })(module, exports, require);
    return module.exports.default ?? module.exports;
  },
});
