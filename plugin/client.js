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
var import_react4 = require("react");

// plugin/src/diagram/DiagramCanvas.tsx
var import_react = require("react");

// packages/drawio/src/style-map.ts
var NODE_THEME = {
  default: { fillColor: "#1e293b", strokeColor: "#334155", fontColor: "#e2e8f0" },
  primary: { fillColor: "#0c4a6e", strokeColor: "#38bdf8", fontColor: "#e0f2fe" },
  danger: { fillColor: "#4c1d24", strokeColor: "#f87171", fontColor: "#fee2e2" },
  warning: { fillColor: "#4a3712", strokeColor: "#fbbf24", fontColor: "#fef3c7" },
  muted: { fillColor: "#1e293b", strokeColor: "#334155", fontColor: "#64748b" }
};
var GROUP_THEME = {
  dashed: { strokeColor: "#334155", fillColor: "none", dashed: "1" },
  filled: { strokeColor: "#334155", fillColor: "#111c33", dashed: "0" }
};
var EDGE_BASE_STYLE = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;fontColor=#cbd5e1;labelBackgroundColor=#152238;";
var EDGE_STYLE_SUFFIX = {
  solid: "endArrow=classic;endFill=1;",
  dashed: "endArrow=classic;endFill=1;dashed=1;dashPattern=8 4;",
  bidirectional: "startArrow=classic;startFill=1;endArrow=classic;endFill=1;"
};
function nodeStyle(variant) {
  const theme = NODE_THEME[variant];
  return [
    "rounded=1",
    "whiteSpace=wrap",
    "html=1",
    `fillColor=${theme.fillColor}`,
    `strokeColor=${theme.strokeColor}`,
    `fontColor=${theme.fontColor}`,
    "fontSize=14",
    "align=center",
    "verticalAlign=top",
    "spacingTop=6"
  ].join(";") + ";";
}
function groupStyle(variant) {
  const theme = GROUP_THEME[variant];
  return [
    "container=1",
    "collapsible=0",
    "rounded=1",
    `dashed=${theme.dashed}`,
    `strokeColor=${theme.strokeColor}`,
    `fillColor=${theme.fillColor}`,
    "fontColor=#94a3b8",
    "fontSize=12",
    "align=left",
    "verticalAlign=top",
    "spacingLeft=10",
    "spacingTop=5"
  ].join(";") + ";";
}
function edgeStyle(style) {
  return `${EDGE_BASE_STYLE}${EDGE_STYLE_SUFFIX[style]}`;
}

// packages/layout/src/tokens.ts
var NODE_WIDTH = 240;
var NODE_PADDING_VERTICAL = 20;
var NODE_TEXT_MAX_WIDTH = NODE_WIDTH - 20;
var TITLE_FONT_SIZE = 14;
var TITLE_LINE_HEIGHT = 24;
var DESC_FONT_SIZE = 12;
var DESC_LINE_HEIGHT = 20;
var ITEM_FONT_SIZE = 12;
var ITEM_LINE_HEIGHT = 22;
var ITEM_SEPARATOR_HEIGHT = 14;
var MIN_NODE_HEIGHT = 48;
var UNIT_PADDING_X = 24;
var UNIT_PADDING_BOTTOM = 24;
var UNIT_HEADER_HEIGHT = 24;
var RANK_GAP = 48;
var CROSS_GAP = 40;
var UNIT_GAP = 56;
var MAX_RIB_LENGTH = 4;
var LANE_CLEARANCE = 12;
var LANE_STEP = LANE_CLEARANCE;
var LANE_LIMIT = 12;
var MAX_LANE_GAP = 200;
var OUTER_CHANNEL_GAP = LANE_CLEARANCE;
var TOP_RAIL_HEIGHT = LANE_CLEARANCE;
var COLLISION_PADDING = 4;
var CANVAS_MARGIN = 40;

// packages/layout/src/text-metrics.ts
var WIDE_CHAR_WIDTH_RATIO = 1;
var NARROW_CHAR_WIDTH_RATIO = 0.55;
var WIDE_CHAR_THRESHOLD = 11904;
function isWideChar(codePoint) {
  return codePoint >= WIDE_CHAR_THRESHOLD;
}
function estimateTextWidth(text, fontSize) {
  let width = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    width += (isWideChar(codePoint) ? WIDE_CHAR_WIDTH_RATIO : NARROW_CHAR_WIDTH_RATIO) * fontSize;
  }
  return width;
}
function estimateLineCount(text, fontSize, maxWidth) {
  if (text.length === 0) {
    return 0;
  }
  let lines = 0;
  for (const segment of text.split(/\r?\n/)) {
    if (segment.length === 0) {
      lines += 1;
      continue;
    }
    const width = estimateTextWidth(segment, fontSize);
    lines += Math.max(1, Math.ceil(width / maxWidth));
  }
  return lines;
}

// packages/layout/src/sizing.ts
function measureNodeSize(node) {
  const titleLines = estimateLineCount(node.title, TITLE_FONT_SIZE, NODE_TEXT_MAX_WIDTH);
  const descLines = node.desc ? estimateLineCount(node.desc, DESC_FONT_SIZE, NODE_TEXT_MAX_WIDTH) : 0;
  const itemLines = node.items.reduce(
    (total, item) => total + estimateLineCount(item, ITEM_FONT_SIZE, NODE_TEXT_MAX_WIDTH),
    0
  );
  const separatorHeight = node.items.length > 0 ? ITEM_SEPARATOR_HEIGHT : 0;
  const contentHeight = NODE_PADDING_VERTICAL + titleLines * TITLE_LINE_HEIGHT + descLines * DESC_LINE_HEIGHT + separatorHeight + itemLines * ITEM_LINE_HEIGHT;
  return {
    width: NODE_WIDTH,
    height: Math.max(MIN_NODE_HEIGHT, Math.ceil(contentHeight))
  };
}

// packages/schema/src/types.ts
var MAX_GROUP_LEVELS = 3;

// node_modules/.pnpm/js-yaml@4.3.2/node_modules/js-yaml/dist/js-yaml.mjs
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var jsYaml = {};
var loader = {};
var common = {};
var hasRequiredCommon;
function requireCommon() {
  if (hasRequiredCommon) return common;
  hasRequiredCommon = 1;
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence)) return sequence;
    else if (isNothing(sequence)) return [];
    return [sequence];
  }
  function extend(target, source) {
    if (source) {
      const sourceKeys = Object.keys(source);
      for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
        const key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    let result = "";
    for (let cycle = 0; cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  common.isNothing = isNothing;
  common.isObject = isObject;
  common.toArray = toArray;
  common.repeat = repeat;
  common.isNegativeZero = isNegativeZero;
  common.extend = extend;
  return common;
}
var exception;
var hasRequiredException;
function requireException() {
  if (hasRequiredException) return exception;
  hasRequiredException = 1;
  function formatError(exception2, compact) {
    let where = "";
    const message = exception2.reason || "(unknown reason)";
    if (!exception2.mark) return message;
    if (exception2.mark.name) {
      where += 'in "' + exception2.mark.name + '" ';
    }
    where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
    if (!compact && exception2.mark.snippet) {
      where += "\n\n" + exception2.mark.snippet;
    }
    return message + " " + where;
  }
  function YAMLException2(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException2.prototype = Object.create(Error.prototype);
  YAMLException2.prototype.constructor = YAMLException2;
  YAMLException2.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  exception = YAMLException2;
  return exception;
}
var snippet;
var hasRequiredSnippet;
function requireSnippet() {
  if (hasRequiredSnippet) return snippet;
  hasRequiredSnippet = 1;
  const common2 = requireCommon();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = "";
    let tail = "";
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
      pos: position - lineStart + head.length
      // relative position
    };
  }
  function padStart(string, max) {
    return common2.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer) return null;
    if (!options.maxLength) options.maxLength = 79;
    if (typeof options.indent !== "number") options.indent = 1;
    if (typeof options.linesBefore !== "number") options.linesBefore = 3;
    if (typeof options.linesAfter !== "number") options.linesAfter = 2;
    const re = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) {
        foundLineNo = lineStarts.length - 2;
      }
    }
    if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
    let result = "";
    const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (let i = 1; i <= options.linesBefore; i++) {
      if (foundLineNo - i < 0) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo - i],
        lineEnds[foundLineNo - i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
        maxLineLength
      );
      result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
    }
    const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
    result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
    for (let i = 1; i <= options.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo + i],
        lineEnds[foundLineNo + i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
        maxLineLength
      );
      result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
    }
    return result.replace(/\n$/, "");
  }
  snippet = makeSnippet;
  return snippet;
}
var type;
var hasRequiredType;
function requireType() {
  if (hasRequiredType) return type;
  hasRequiredType = 1;
  const YAMLException2 = requireException();
  const TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  const YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map2) {
    const result = {};
    if (map2 !== null) {
      Object.keys(map2).forEach(function(style) {
        map2[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type2(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  type = Type2;
  return type;
}
var schema;
var hasRequiredSchema;
function requireSchema() {
  if (hasRequiredSchema) return schema;
  hasRequiredSchema = 1;
  const YAMLException2 = requireException();
  const Type2 = requireType();
  function compileList(schema2, name) {
    const result = [];
    schema2[name].forEach(function(currentType) {
      let newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
          newIndex = previousIndex;
        }
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    const result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    };
    function collectType(type2) {
      if (type2.multi) {
        result.multi[type2.kind].push(type2);
        result.multi["fallback"].push(type2);
      } else {
        result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
      }
    }
    for (let index = 0, length = arguments.length; index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema2(definition) {
    return this.extend(definition);
  }
  Schema2.prototype.extend = function extend(definition) {
    let implicit = [];
    let explicit = [];
    if (definition instanceof Type2) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit) implicit = implicit.concat(definition.implicit);
      if (definition.explicit) explicit = explicit.concat(definition.explicit);
    } else {
      throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type2.loadKind && type2.loadKind !== "scalar") {
        throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type2.multi) {
        throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    const result = Object.create(Schema2.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  schema = Schema2;
  return schema;
}
var str;
var hasRequiredStr;
function requireStr() {
  if (hasRequiredStr) return str;
  hasRequiredStr = 1;
  const Type2 = requireType();
  str = new Type2("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
  return str;
}
var seq;
var hasRequiredSeq;
function requireSeq() {
  if (hasRequiredSeq) return seq;
  hasRequiredSeq = 1;
  const Type2 = requireType();
  seq = new Type2("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
  return seq;
}
var map;
var hasRequiredMap;
function requireMap() {
  if (hasRequiredMap) return map;
  hasRequiredMap = 1;
  const Type2 = requireType();
  map = new Type2("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
  return map;
}
var failsafe;
var hasRequiredFailsafe;
function requireFailsafe() {
  if (hasRequiredFailsafe) return failsafe;
  hasRequiredFailsafe = 1;
  const Schema2 = requireSchema();
  failsafe = new Schema2({
    explicit: [
      requireStr(),
      requireSeq(),
      requireMap()
    ]
  });
  return failsafe;
}
var _null;
var hasRequired_null;
function require_null() {
  if (hasRequired_null) return _null;
  hasRequired_null = 1;
  const Type2 = requireType();
  function resolveYamlNull(data) {
    if (data === null) return true;
    const max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  _null = new Type2("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
  return _null;
}
var bool;
var hasRequiredBool;
function requireBool() {
  if (hasRequiredBool) return bool;
  hasRequiredBool = 1;
  const Type2 = requireType();
  function resolveYamlBoolean(data) {
    if (data === null) return false;
    const max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  bool = new Type2("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  return bool;
}
var int;
var hasRequiredInt;
function requireInt() {
  if (hasRequiredInt) return int;
  hasRequiredInt = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  function isHexCode(c) {
    return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
  }
  function isOctCode(c) {
    return c >= 48 && c <= 55;
  }
  function isDecCode(c) {
    return c >= 48 && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null) return false;
    const max = data.length;
    let index = 0;
    let hasDigits = false;
    if (!max) return false;
    let ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max) return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch !== "0" && ch !== "1") return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "x") {
        index++;
        for (; index < max; index++) {
          if (!isHexCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "o") {
        index++;
        for (; index < max; index++) {
          if (!isOctCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
    }
    for (; index < max; index++) {
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits) return false;
    return isFinite(parseYamlInteger(data));
  }
  function parseYamlInteger(data) {
    let value = data;
    let sign = 1;
    let ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-") sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0") return 0;
    if (ch === "0") {
      if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function constructYamlInteger(data) {
    return parseYamlInteger(data);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common2.isNegativeZero(object));
  }
  int = new Type2("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  return int;
}
var float;
var hasRequiredFloat;
function requireFloat() {
  if (hasRequiredFloat) return float;
  hasRequiredFloat = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  const YAML_FLOAT_PATTERN = new RegExp(
    // 2.5e4, 2.5 and integers
    "^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  const YAML_FLOAT_SPECIAL_PATTERN = new RegExp(
    "^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  function resolveYamlFloat(data) {
    if (data === null) return false;
    if (!YAML_FLOAT_PATTERN.test(data)) {
      return false;
    }
    if (isFinite(parseFloat(data, 10))) {
      return true;
    }
    return YAML_FLOAT_SPECIAL_PATTERN.test(data);
  }
  function constructYamlFloat(data) {
    let value = data.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    }
    return sign * parseFloat(value, 10);
  }
  const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common2.isNegativeZero(object)) {
      return "-0.0";
    }
    const res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
  }
  float = new Type2("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  return float;
}
var json;
var hasRequiredJson;
function requireJson() {
  if (hasRequiredJson) return json;
  hasRequiredJson = 1;
  json = requireFailsafe().extend({
    implicit: [
      require_null(),
      requireBool(),
      requireInt(),
      requireFloat()
    ]
  });
  return json;
}
var core;
var hasRequiredCore;
function requireCore() {
  if (hasRequiredCore) return core;
  hasRequiredCore = 1;
  core = requireJson();
  return core;
}
var timestamp;
var hasRequiredTimestamp;
function requireTimestamp() {
  if (hasRequiredTimestamp) return timestamp;
  hasRequiredTimestamp = 1;
  const Type2 = requireType();
  const YAML_DATE_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
  );
  const YAML_TIMESTAMP_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
  );
  function resolveYamlTimestamp(data) {
    if (data === null) return false;
    if (YAML_DATE_REGEXP.exec(data) !== null) return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    let fraction = 0;
    let delta = null;
    let match = YAML_DATE_REGEXP.exec(data);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null) throw new Error("Date resolve error");
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      const tzHour = +match[10];
      const tzMinute = +(match[11] || 0);
      delta = (tzHour * 60 + tzMinute) * 6e4;
      if (match[9] === "-") delta = -delta;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta) date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  timestamp = new Type2("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  return timestamp;
}
var merge;
var hasRequiredMerge;
function requireMerge() {
  if (hasRequiredMerge) return merge;
  hasRequiredMerge = 1;
  const Type2 = requireType();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  merge = new Type2("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  return merge;
}
var binary;
var hasRequiredBinary;
function requireBinary() {
  if (hasRequiredBinary) return binary;
  hasRequiredBinary = 1;
  const Type2 = requireType();
  const BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
  function resolveYamlBinary(data) {
    if (data === null) return false;
    let bitlen = 0;
    const max = data.length;
    const map2 = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      const code = map2.indexOf(data.charAt(idx));
      if (code > 64) continue;
      if (code < 0) return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    const input = data.replace(/[\r\n=]/g, "");
    const max = input.length;
    const map2 = BASE64_MAP;
    let bits = 0;
    const result = [];
    for (let idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map2.indexOf(input.charAt(idx));
    }
    const tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    let result = "";
    let bits = 0;
    const max = object.length;
    const map2 = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    const tail = max % 3;
    if (tail === 0) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    } else if (tail === 2) {
      result += map2[bits >> 10 & 63];
      result += map2[bits >> 4 & 63];
      result += map2[bits << 2 & 63];
      result += map2[64];
    } else if (tail === 1) {
      result += map2[bits >> 2 & 63];
      result += map2[bits << 4 & 63];
      result += map2[64];
      result += map2[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  binary = new Type2("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  return binary;
}
var omap;
var hasRequiredOmap;
function requireOmap() {
  if (hasRequiredOmap) return omap;
  hasRequiredOmap = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null) return true;
    const objectKeys = {};
    const object = data;
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      let pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]") return false;
      let pairKey;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey) pairHasKey = true;
          else return false;
        }
      }
      if (!pairHasKey) return false;
      if (_hasOwnProperty.call(objectKeys, pairKey)) return false;
      Object.defineProperty(objectKeys, pairKey, { value: true });
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  omap = new Type2("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  return omap;
}
var pairs;
var hasRequiredPairs;
function requirePairs() {
  if (hasRequiredPairs) return pairs;
  hasRequiredPairs = 1;
  const Type2 = requireType();
  const _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null) return true;
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      if (_toString.call(pair) !== "[object Object]") return false;
      const keys = Object.keys(pair);
      if (keys.length !== 1) return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null) return [];
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      const keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  pairs = new Type2("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  return pairs;
}
var set;
var hasRequiredSet;
function requireSet() {
  if (hasRequiredSet) return set;
  hasRequiredSet = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null) return true;
    const object = data;
    for (const key in object) {
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null) return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  set = new Type2("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  return set;
}
var _default;
var hasRequired_default;
function require_default() {
  if (hasRequired_default) return _default;
  hasRequired_default = 1;
  _default = requireCore().extend({
    implicit: [
      requireTimestamp(),
      requireMerge()
    ],
    explicit: [
      requireBinary(),
      requireOmap(),
      requirePairs(),
      requireSet()
    ]
  });
  return _default;
}
var hasRequiredLoader;
function requireLoader() {
  if (hasRequiredLoader) return loader;
  hasRequiredLoader = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const makeSnippet = requireSnippet();
  const DEFAULT_SCHEMA2 = require_default();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CONTEXT_FLOW_IN = 1;
  const CONTEXT_FLOW_OUT = 2;
  const CONTEXT_BLOCK_IN = 3;
  const CONTEXT_BLOCK_OUT = 4;
  const CHOMPING_CLIP = 1;
  const CHOMPING_STRIP = 2;
  const CHOMPING_KEEP = 3;
  const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isEol(c) {
    return c === 10 || c === 13;
  }
  function isWhiteSpace(c) {
    return c === 9 || c === 32;
  }
  function isWsOrEol(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function isFlowIndicator(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    if (c >= 48 && c <= 57) {
      return c - 48;
    }
    const lc = c | 32;
    if (lc >= 97 && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) {
      return 2;
    }
    if (c === 117) {
      return 4;
    }
    if (c === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c) {
    if (c >= 48 && c <= 57) {
      return c - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c) {
    switch (c) {
      case 48:
        return "\0";
      case 97:
        return "\x07";
      case 98:
        return "\b";
      case 116:
        return "	";
      case 9:
        return "	";
      case 110:
        return "\n";
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 114:
        return "\r";
      case 101:
        return "\x1B";
      case 32:
        return " ";
      case 34:
        return '"';
      case 47:
        return "/";
      case 92:
        return "\\";
      case 78:
        return "\x85";
      case 95:
        return "\xA0";
      case 76:
        return "\u2028";
      case 80:
        return "\u2029";
      default:
        return "";
    }
  }
  function charFromCodepoint(c) {
    if (c <= 65535) {
      return String.fromCharCode(c);
    }
    return String.fromCharCode(
      (c - 65536 >> 10) + 55296,
      (c - 65536 & 1023) + 56320
    );
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
    } else {
      object[key] = value;
    }
  }
  const simpleEscapeCheck = new Array(256);
  const simpleEscapeMap = new Array(256);
  for (let i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
    this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.depth = 0;
    this.totalMergeKeys = 0;
    this.firstTabInLine = -1;
    this.documents = [];
    this.anchorMapTransactions = [];
  }
  function generateError(state, message) {
    const mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      // omit trailing \0
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException2(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  function storeAnchor(state, name, value) {
    const transactions = state.anchorMapTransactions;
    if (transactions.length !== 0) {
      const transaction = transactions[transactions.length - 1];
      if (!_hasOwnProperty.call(transaction, name)) {
        transaction[name] = {
          existed: _hasOwnProperty.call(state.anchorMap, name),
          value: state.anchorMap[name]
        };
      }
    }
    state.anchorMap[name] = value;
  }
  function beginAnchorTransaction(state) {
    state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
  }
  function commitAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const transactions = state.anchorMapTransactions;
    if (transactions.length === 0) return;
    const parent = transactions[transactions.length - 1];
    const names = Object.keys(transaction);
    for (let index = 0, length = names.length; index < length; index += 1) {
      const name = names[index];
      if (!_hasOwnProperty.call(parent, name)) {
        parent[name] = transaction[name];
      }
    }
  }
  function rollbackAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const names = Object.keys(transaction);
    for (let index = names.length - 1; index >= 0; index -= 1) {
      const entry = transaction[names[index]];
      if (entry.existed) {
        state.anchorMap[names[index]] = entry.value;
      } else {
        delete state.anchorMap[names[index]];
      }
    }
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      tag: state.tag,
      anchor: state.anchor,
      kind: state.kind,
      result: state.result
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
  }
  const directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      let prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      const handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    if (start < end) {
      const _result = state.input.slice(start, end);
      if (checkJson) {
        for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
          const _character = _result.charCodeAt(_position);
          if (!(_character === 9 || _character >= 32 && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function chargeMergeWork(state) {
    state.totalMergeKeys++;
    if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) {
      throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    if (!common2.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    chargeMergeWork(state);
    const sourceKeys = Object.keys(source);
    for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
      const key = sourceKeys[index];
      chargeMergeWork(state);
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        if (valueNode.length > 100) {
          throwError(state, "abnormal merge sequence size");
        }
        for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) {
          state.firstTabInLine = state.position;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (isEol(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    let _position = state.position;
    let ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || isWsOrEol(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common2.repeat("\n", count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    let captureStart;
    let captureEnd;
    let hasPendingContent;
    let _line;
    let _lineStart;
    let _lineIndent;
    const _kind = state.kind;
    const _result = state.result;
    let ch = state.input.charCodeAt(state.position);
    if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
          break;
        }
      } else if (ch === 35) {
        const preceding = state.input.charCodeAt(state.position - 1);
        if (isWsOrEol(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) {
        break;
      } else if (isEol(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!isWhiteSpace(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (isEol(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          let hexLength = tmp;
          let hexResult = 0;
          for (; hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    let readNext = true;
    let _line;
    let _lineStart;
    let _pos;
    const _tag = state.tag;
    let _result;
    const _anchor = state.anchor;
    let terminator;
    let isPair;
    let isExplicitPair;
    let isMapping;
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyNode;
    let keyTag;
    let valueNode;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      } else if (ch === 44) {
        throwError(state, "expected the node content, but found ','");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    let folding;
    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (isWhiteSpace(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (isWhiteSpace(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!isEol(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (isEol(ch)) {
        emptyLines++;
        continue;
      }
      if (!detectedIndent && textIndent === 0) {
        throwError(state, "missing indentation for block scalar");
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += "\n";
          }
        }
        break;
      }
      if (folding) {
        if (isWhiteSpace(ch)) {
          atMoreIndented = true;
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common2.repeat("\n", emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common2.repeat("\n", emptyLines);
        }
      } else {
        state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      const captureStart = state.position;
      while (!isEol(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = [];
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) {
        break;
      }
      const following = state.input.charCodeAt(state.position + 1);
      if (!isWsOrEol(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      const _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    let allowCompact;
    let _keyLine;
    let _keyLineStart;
    let _keyPos;
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = {};
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyTag = null;
    let keyNode = null;
    let valueNode = null;
    let atExplicitKey = false;
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const following = state.input.charCodeAt(state.position + 1);
      const _line = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          break;
        }
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEol(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle;
    let tagName;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 33) return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    let _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !isWsOrEol(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 38) return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 42) return false;
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    const alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
    const fallbackState = snapshotState(state);
    beginAnchorTransaction(state);
    restoreState(state, propertyStart);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
      commitAnchorTransaction(state);
      return true;
    }
    rollbackAnchorTransaction(state);
    restoreState(state, fallbackState);
    return false;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    let allowBlockScalars;
    let allowBlockCollections;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    let type2;
    let flowIndent;
    let blockIndent;
    if (state.depth >= state.maxDepth) {
      throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
    }
    state.depth += 1;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (true) {
        const ch = state.input.charCodeAt(state.position);
        const propertyState = snapshotState(state);
        if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) {
          break;
        }
        if (!readTagProperty(state) && !readAnchorProperty(state)) {
          break;
        }
        if (propertyStart === null) {
          propertyStart = propertyState;
        }
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          const ch = state.input.charCodeAt(state.position);
          if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(
            state,
            propertyStart,
            propertyStart.position - propertyStart.lineStart,
            flowIndent
          )) {
            hasContent = true;
          } else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag === null) {
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, state.result);
      }
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") {
        throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      }
      for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
        type2 = state.implicitTypes[typeIndex];
        if (type2.resolve(state.result)) {
          state.result = type2.construct(state.result);
          state.tag = type2.tag;
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type2 = state.typeMap[state.kind || "fallback"][state.tag];
      } else {
        type2 = null;
        const typeList = state.typeMap.multi[state.kind || "fallback"];
        for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type2 = typeList[typeIndex];
            break;
          }
        }
      }
      if (!type2) {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
      if (state.result !== null && type2.kind !== state.kind) {
        throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
      }
      if (!type2.resolve(state.result, state.tag)) {
        throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      } else {
        state.result = type2.construct(state.result, state.tag);
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    state.depth -= 1;
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    const documentStart = state.position;
    let hasDirectives = false;
    let ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      let _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      const directiveName = state.input.slice(_position, state.position);
      const directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (isWhiteSpace(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !isEol(ch));
          break;
        }
        if (isEol(ch)) break;
        _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0) readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += "\n";
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    const state = new State(input, options);
    const nullpos = input.indexOf("\0");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\0";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll2(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    const documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (let index = 0, length = documents.length; index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load2(input, options) {
    const documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return void 0;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException2("expected a single document in the stream, but found more");
  }
  loader.loadAll = loadAll2;
  loader.load = load2;
  return loader;
}
var dumper = {};
var hasRequiredDumper;
function requireDumper() {
  if (hasRequiredDumper) return dumper;
  hasRequiredDumper = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const DEFAULT_SCHEMA2 = require_default();
  const _toString = Object.prototype.toString;
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CHAR_BOM = 65279;
  const CHAR_TAB = 9;
  const CHAR_LINE_FEED = 10;
  const CHAR_CARRIAGE_RETURN = 13;
  const CHAR_SPACE = 32;
  const CHAR_EXCLAMATION = 33;
  const CHAR_DOUBLE_QUOTE = 34;
  const CHAR_SHARP = 35;
  const CHAR_PERCENT = 37;
  const CHAR_AMPERSAND = 38;
  const CHAR_SINGLE_QUOTE = 39;
  const CHAR_ASTERISK = 42;
  const CHAR_COMMA = 44;
  const CHAR_MINUS = 45;
  const CHAR_COLON = 58;
  const CHAR_EQUALS = 61;
  const CHAR_GREATER_THAN = 62;
  const CHAR_QUESTION = 63;
  const CHAR_COMMERCIAL_AT = 64;
  const CHAR_LEFT_SQUARE_BRACKET = 91;
  const CHAR_RIGHT_SQUARE_BRACKET = 93;
  const CHAR_GRAVE_ACCENT = 96;
  const CHAR_LEFT_CURLY_BRACKET = 123;
  const CHAR_VERTICAL_LINE = 124;
  const CHAR_RIGHT_CURLY_BRACKET = 125;
  const ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  const DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema2, map2) {
    if (map2 === null) return {};
    const result = {};
    const keys = Object.keys(map2);
    for (let index = 0, length = keys.length; index < length; index += 1) {
      let tag = keys[index];
      let style = String(map2[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      const type2 = schema2.compiledTypeMap["fallback"][tag];
      if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
        style = type2.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    let handle;
    let length;
    const string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common2.repeat("0", length - string.length) + string;
  }
  const QUOTING_TYPE_SINGLE = 1;
  const QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    const ind = common2.repeat(" ", spaces);
    let position = 0;
    let result = "";
    const length = string.length;
    while (position < length) {
      let line;
      const next = string.indexOf("\n", position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== "\n") result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return "\n" + common2.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str2) {
    for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) {
      const type2 = state.implicitTypes[index];
      if (type2.resolve(str2)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && // - b-char
    c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev, inblock) {
    const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (
      // ns-plain-safe
      (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && // - c-flow-indicator
      c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && // ns-plain-char
      c !== CHAR_SHARP && // false on '#'
      !(prev === CHAR_COLON && !cIsNsChar) || // false on ': '
      isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || // change to true on '[^ ]#'
      prev === CHAR_COLON && cIsNsChar
    );
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
    c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && // | “%” | “@” | “`”)
    c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    const first = string.charCodeAt(pos);
    let second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) {
        return (first - 55296) * 1024 + second - 56320 + 65536;
      }
    }
    return first;
  }
  function needIndentIndicator(string) {
    const leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  const STYLE_PLAIN = 1;
  const STYLE_SINGLE = 2;
  const STYLE_LITERAL = 3;
  const STYLE_FOLDED = 4;
  const STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    let i;
    let char = 0;
    let prevChar = null;
    let hasLineBreak = false;
    let hasFoldableLine = false;
    const shouldTrackWidth = lineWidth !== -1;
    let previousLineBreak = -1;
    let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    } else {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
            i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) {
        return STYLE_PLAIN;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    if (!forceQuotes) {
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = (function() {
      if (string.length === 0) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      }
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
        }
      }
      const indent = state.indent * Math.max(1, level);
      const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      const singleLineOnly = iskey || // No block styles in flow mode.
      state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(
        string,
        singleLineOnly,
        state.indent,
        lineWidth,
        testAmbiguity,
        state.quotingType,
        state.forceQuotes && !iskey,
        inblock
      )) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string) + '"';
        default:
          throw new YAMLException2("impossible error: invalid scalar style");
      }
    })();
  }
  function blockHeader(string, indentPerLevel) {
    const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    const clip = string[string.length - 1] === "\n";
    const keep = clip && (string[string.length - 2] === "\n" || string === "\n");
    const chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + "\n";
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    const lineRe = /(\n+)([^\n]*)/g;
    let result = (function() {
      let nextLF = string.indexOf("\n");
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    })();
    let prevMoreIndented = string[0] === "\n" || string[0] === " ";
    let moreIndented;
    let match;
    while (match = lineRe.exec(string)) {
      const prefix = match[1];
      const line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ") return line;
    const breakRe = / [^ ]/g;
    let match;
    let start = 0;
    let end;
    let curr = 0;
    let next = 0;
    let result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += "\n" + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += "\n";
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    let result = "";
    let char = 0;
    for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      const escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536) result += string[i + 1];
      } else {
        result += escapeSeq || encodeHex(char);
      }
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (_result !== "") pairBuffer += ", ";
      if (state.condenseFlow) pairBuffer += '"';
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024) pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException2("sortKeys must be a boolean or a function");
    }
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (!compact || _result !== "") {
        pairBuffer += generateNextLine(state, level);
      }
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    const typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (let index = 0, length = typeList.length; index < length; index += 1) {
      const type2 = typeList[index];
      if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
        if (explicit) {
          if (type2.multi && type2.representName) {
            state.tag = type2.representName(object);
          } else {
            state.tag = type2.tag;
          }
        } else {
          state.tag = "?";
        }
        if (type2.represent) {
          const style = state.styleMap[type2.tag] || type2.defaultStyle;
          let _result;
          if (_toString.call(type2.represent) === "[object Function]") {
            _result = type2.represent(object, style);
          } else if (_hasOwnProperty.call(type2.represent, style)) {
            _result = type2.represent[style](object, style);
          } else {
            throw new YAMLException2("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    const type2 = _toString.call(state.dump);
    const inblock = block;
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
    let duplicateIndex;
    let duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type2 === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object Array]") {
        if (block && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0) {
            writeBlockSequence(state, level - 1, state.dump, compact);
          } else {
            writeBlockSequence(state, level, state.dump, compact);
          }
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey, inblock);
        }
      } else if (type2 === "[object Undefined]") {
        return false;
      } else {
        if (state.skipInvalid) return false;
        throw new YAMLException2("unacceptable kind of an object to dump " + type2);
      }
      if (state.tag !== null && state.tag !== "?") {
        let tagStr = encodeURI(
          state.tag[0] === "!" ? state.tag.slice(1) : state.tag
        ).replace(/!/g, "%21");
        if (state.tag[0] === "!") {
          tagStr = "!" + tagStr;
        } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
          tagStr = "!!" + tagStr.slice(18);
        } else {
          tagStr = "!<" + tagStr + ">";
        }
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    const objects = [];
    const duplicatesIndexes = [];
    inspectNode(object, objects, duplicatesIndexes);
    const length = duplicatesIndexes.length;
    for (let index = 0; index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    if (object !== null && typeof object === "object") {
      const index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (let i = 0, length = object.length; i < length; i += 1) {
            inspectNode(object[i], objects, duplicatesIndexes);
          }
        } else {
          const objectKeyList = Object.keys(object);
          for (let i = 0, length = objectKeyList.length; i < length; i += 1) {
            inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump2(input, options) {
    options = options || {};
    const state = new State(options);
    if (!state.noRefs) getDuplicateReferences(input, state);
    let value = input;
    if (state.replacer) {
      value = state.replacer.call({ "": value }, "", value);
    }
    if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
    return "";
  }
  dumper.dump = dump2;
  return dumper;
}
var hasRequiredJsYaml;
function requireJsYaml() {
  if (hasRequiredJsYaml) return jsYaml;
  hasRequiredJsYaml = 1;
  const loader2 = requireLoader();
  const dumper2 = requireDumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  jsYaml.Type = requireType();
  jsYaml.Schema = requireSchema();
  jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
  jsYaml.JSON_SCHEMA = requireJson();
  jsYaml.CORE_SCHEMA = requireCore();
  jsYaml.DEFAULT_SCHEMA = require_default();
  jsYaml.load = loader2.load;
  jsYaml.loadAll = loader2.loadAll;
  jsYaml.dump = dumper2.dump;
  jsYaml.YAMLException = requireException();
  jsYaml.types = {
    binary: requireBinary(),
    float: requireFloat(),
    map: requireMap(),
    null: require_null(),
    pairs: requirePairs(),
    set: requireSet(),
    timestamp: requireTimestamp(),
    bool: requireBool(),
    int: requireInt(),
    merge: requireMerge(),
    omap: requireOmap(),
    seq: requireSeq(),
    str: requireStr()
  };
  jsYaml.safeLoad = renamed("safeLoad", "load");
  jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
  jsYaml.safeDump = renamed("safeDump", "dump");
  return jsYaml;
}
var jsYamlExports = requireJsYaml();
var yaml = /* @__PURE__ */ getDefaultExportFromCjs(jsYamlExports);
var {
  Type,
  Schema,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  load,
  loadAll,
  dump,
  YAMLException,
  types,
  safeLoad,
  safeLoadAll,
  safeDump
} = yaml;

// packages/schema/src/parse.ts
function parseYaml(source) {
  try {
    return { ok: true, value: load(source) };
  } catch (error) {
    const err = error;
    const mark = err.mark;
    return {
      ok: false,
      diagnostics: [
        {
          code: "YAML_SYNTAX",
          path: mark ? `yaml:${mark.line + 1}:${mark.column + 1}` : "yaml",
          message: `failed to parse YAML: ${err.reason ?? err.message ?? "unknown error"}`
        }
      ]
    };
  }
}

// packages/schema/src/normalize.ts
function normalizeSpec(ast) {
  const groups = (ast.groups ?? []).map((group) => ({
    id: group.id,
    title: group.title,
    variant: group.variant ?? "dashed",
    parent: group.parent
  }));
  const nodes = ast.nodes.map((node) => ({
    id: node.id,
    title: node.title,
    group: node.group,
    desc: node.desc,
    variant: node.variant ?? "default",
    items: node.items ?? []
  }));
  const edges = ast.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    label: edge.label,
    style: edge.style ?? "solid"
  }));
  const meta = ast.meta ?? {};
  const maxColumns = ast.layout?.max_columns ?? "auto";
  const direction = ast.layout?.direction ?? "TB";
  const innerDirection = ast.layout?.inner_direction ?? "auto";
  return {
    version: ast.version ?? "1.0",
    meta,
    layout: { maxColumns, direction, innerDirection },
    groups,
    nodes,
    edges
  };
}

// packages/layout/src/layering.ts
var ROOT_UNIT_KEY = "__dsh_root_unit__";
function groupLevel(groupId, groups) {
  let level = 0;
  let cursor = groups.find((group) => group.id === groupId)?.parent;
  while (cursor !== void 0) {
    level += 1;
    cursor = groups.find((group) => group.id === cursor)?.parent;
  }
  return level;
}
function resolveUnitDirections(spec, layerings) {
  const flip = (direction) => direction === "TB" ? "LR" : "TB";
  const pinned = spec.layout.innerDirection;
  const base = spec.layout.direction;
  const result = /* @__PURE__ */ new Map();
  result.set(ROOT_UNIT_KEY, base);
  const ordered = [...spec.groups].sort(
    (a, b) => groupLevel(a.id, spec.groups) - groupLevel(b.id, spec.groups)
  );
  for (const group of ordered) {
    const parentDirection = result.get(group.parent ?? ROOT_UNIT_KEY) ?? base;
    const hasEdges = layerings.get(group.id)?.hasEdges ?? false;
    if (pinned !== "auto") {
      result.set(group.id, pinned);
    } else if (hasEdges) {
      result.set(group.id, flip(parentDirection));
    } else {
      result.set(group.id, parentDirection);
    }
  }
  return result;
}
function resolveEdgeFrames(spec, unitDirections) {
  const unitOfNode = new Map(
    spec.nodes.map((node) => [node.id, node.group ?? ROOT_UNIT_KEY])
  );
  const parentOf = new Map(spec.groups.map((group) => [group.id, group.parent]));
  const chainOf = (unitKey) => {
    const chain = [unitKey];
    let cursor = parentOf.get(unitKey);
    while (cursor !== void 0 && !chain.includes(cursor)) {
      chain.push(cursor);
      cursor = parentOf.get(cursor);
    }
    chain.push(ROOT_UNIT_KEY);
    return chain;
  };
  return spec.edges.map((edge) => {
    const from = unitOfNode.get(edge.from) ?? ROOT_UNIT_KEY;
    const to = unitOfNode.get(edge.to) ?? ROOT_UNIT_KEY;
    if (from === to) {
      return unitDirections.get(from) ?? "TB";
    }
    const ancestors = new Set(chainOf(from));
    const lca = chainOf(to).find((key) => ancestors.has(key)) ?? ROOT_UNIT_KEY;
    return unitDirections.get(lca) ?? "TB";
  });
}
function computeUnitLayerings(spec) {
  const descendantCache = /* @__PURE__ */ new Map();
  const descendantsOf = (groupId, depth = 0, visiting = /* @__PURE__ */ new Set()) => {
    const cached = descendantCache.get(groupId);
    if (cached !== void 0) {
      return cached;
    }
    const result2 = /* @__PURE__ */ new Set();
    if (depth <= MAX_GROUP_LEVELS && !visiting.has(groupId)) {
      visiting.add(groupId);
      for (const node of spec.nodes) {
        if (node.group === groupId) {
          result2.add(node.id);
        }
      }
      for (const sub of spec.groups.filter((group) => group.parent === groupId)) {
        for (const id of descendantsOf(sub.id, depth + 1, visiting)) {
          result2.add(id);
        }
      }
    }
    descendantCache.set(groupId, result2);
    return result2;
  };
  const subtreeOfItem = (itemId, isGroup) => isGroup ? descendantsOf(itemId) : /* @__PURE__ */ new Set([itemId]);
  const result = /* @__PURE__ */ new Map();
  const layerUnit = (unitId) => {
    const key = unitId ?? ROOT_UNIT_KEY;
    const subGroups = spec.groups.filter((group) => group.parent === unitId);
    const memberNodes = spec.nodes.filter((node) => node.group === unitId);
    const items = [
      ...subGroups.map((group) => ({ id: group.id, isGroup: true })),
      ...memberNodes.map((node) => ({ id: node.id, isGroup: false }))
    ];
    const itemIds = items.map((item) => item.id);
    const declIndex = new Map(itemIds.map((id, index) => [id, index]));
    if (items.length === 0) {
      result.set(key, {
        layerOf: /* @__PURE__ */ new Map(),
        orderOf: /* @__PURE__ */ new Map(),
        ribOf: /* @__PURE__ */ new Map(),
        hasEdges: false
      });
      return;
    }
    const subtree = new Map(items.map((item) => [item.id, subtreeOfItem(item.id, item.isGroup)]));
    const itemOfNode = /* @__PURE__ */ new Map();
    for (const item of items) {
      for (const nodeId of subtree.get(item.id)) {
        itemOfNode.set(nodeId, item.id);
      }
    }
    const edges = [];
    const seen = /* @__PURE__ */ new Set();
    for (const edge of spec.edges) {
      const from = itemOfNode.get(edge.from);
      const to = itemOfNode.get(edge.to);
      if (from === void 0 || to === void 0 || from === to) {
        continue;
      }
      const edgeKey = `${from}\0${to}`;
      if (seen.has(edgeKey)) {
        continue;
      }
      seen.add(edgeKey);
      edges.push([from, to]);
    }
    const dag = breakCycles(itemIds, edges, declIndex);
    const folded = collapseInlineRibs(itemIds, dag, longestPathLayers(itemIds, dag));
    const layers = compactRanks(itemIds, folded.layerOf);
    const orderOf = barycenterOrder(itemIds, dag, layers, folded.ribOf, declIndex);
    result.set(key, {
      layerOf: layers,
      orderOf,
      ribOf: folded.ribOf,
      hasEdges: edges.length > 0
    });
    for (const sub of subGroups) {
      layerUnit(sub.id);
    }
  };
  layerUnit(void 0);
  return result;
}
function breakCycles(itemIds, edges, declIndex) {
  const outgoing = new Map(itemIds.map((id) => [id, []]));
  const incoming = new Map(itemIds.map((id) => [id, []]));
  for (const [from, to] of edges) {
    outgoing.get(from)?.push(to);
    incoming.get(to)?.push(from);
  }
  const starts = [...itemIds].sort((a, b) => {
    const aIsSource = (incoming.get(a)?.length ?? 0) === 0 ? 0 : 1;
    const bIsSource = (incoming.get(b)?.length ?? 0) === 0 ? 0 : 1;
    if (aIsSource !== bIsSource) {
      return aIsSource - bIsSource;
    }
    const aNet = (outgoing.get(a)?.length ?? 0) - (incoming.get(a)?.length ?? 0);
    const bNet = (outgoing.get(b)?.length ?? 0) - (incoming.get(b)?.length ?? 0);
    if (aNet !== bNet) {
      return bNet - aNet;
    }
    return (declIndex.get(a) ?? 0) - (declIndex.get(b) ?? 0);
  });
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(itemIds.map((id) => [id, WHITE]));
  const dag = [];
  const added = /* @__PURE__ */ new Set();
  const visit = (id) => {
    color.set(id, GRAY);
    for (const next of outgoing.get(id) ?? []) {
      if (color.get(next) === GRAY) {
        continue;
      }
      const key = `${id}\0${next}`;
      if (!added.has(key)) {
        added.add(key);
        dag.push([id, next]);
      }
      if (color.get(next) === WHITE) {
        visit(next);
      }
    }
    color.set(id, BLACK);
  };
  for (const id of starts) {
    if (color.get(id) === WHITE) {
      visit(id);
    }
  }
  return dag;
}
function longestPathLayers(itemIds, dag) {
  return relaxLayers(itemIds, dag, /* @__PURE__ */ new Set());
}
function relaxLayers(itemIds, dag, folded) {
  const layer = new Map(itemIds.map((id) => [id, 0]));
  const spine = dag.filter(([, to]) => !folded.has(to));
  for (let round = 0; round <= itemIds.length; round += 1) {
    let changed = false;
    for (const [from, to] of spine) {
      const next = (layer.get(from) ?? 0) + 1;
      if ((layer.get(to) ?? 0) < next) {
        layer.set(to, next);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return layer;
}
function collapseInlineRibs(itemIds, dag, initial) {
  const outgoing = new Map(itemIds.map((id) => [id, []]));
  const incoming = new Map(itemIds.map((id) => [id, []]));
  for (const [from, to] of dag) {
    outgoing.get(from)?.push(to);
    incoming.get(to)?.push(from);
  }
  const traceChain = (startId) => {
    const chain = [];
    let cursor = startId;
    while (cursor !== void 0) {
      if ((incoming.get(cursor)?.length ?? 0) !== 1) {
        return null;
      }
      const outs = outgoing.get(cursor) ?? [];
      if (outs.length > 1) {
        return null;
      }
      chain.push(cursor);
      if (chain.length > MAX_RIB_LENGTH) {
        return null;
      }
      if (outs.length === 0) {
        return chain;
      }
      cursor = outs[0];
    }
    return null;
  };
  const candidates = [];
  const hasFork = itemIds.some((id) => (outgoing.get(id)?.length ?? 0) >= 2);
  if (hasFork) {
    for (const id of itemIds) {
      for (const target of outgoing.get(id) ?? []) {
        const chain = traceChain(target);
        if (chain !== null) {
          candidates.push({ anchorId: id, chain });
        }
      }
    }
  }
  const ribOf = /* @__PURE__ */ new Map();
  const foldedAnchor = /* @__PURE__ */ new Map();
  let layerOf = new Map(initial);
  const profile = (layers) => {
    const counts = /* @__PURE__ */ new Map();
    for (const id of itemIds) {
      const rank = layers.get(id) ?? 0;
      counts.set(rank, (counts.get(rank) ?? 0) + 1);
    }
    return { ranks: counts.size, maxRow: Math.max(0, ...counts.values()) };
  };
  for (const candidate of candidates) {
    if (foldedAnchor.has(candidate.anchorId)) {
      continue;
    }
    if (candidate.chain.some((id) => foldedAnchor.has(id))) {
      continue;
    }
    candidate.chain.forEach((id, index) => {
      ribOf.set(id, { anchorId: candidate.anchorId, offset: index + 1 });
      foldedAnchor.set(id, candidate.anchorId);
    });
    const layers = relaxLayers(itemIds, dag, new Set(foldedAnchor.keys()));
    for (const [ribId, anchorId] of foldedAnchor) {
      layers.set(ribId, layers.get(anchorId) ?? 0);
    }
    const { ranks, maxRow } = profile(layers);
    if (ranks >= maxRow) {
      layerOf = layers;
    } else {
      for (const id of candidate.chain) {
        ribOf.delete(id);
        foldedAnchor.delete(id);
      }
    }
  }
  return { ribOf, layerOf };
}
function compactRanks(itemIds, layerOf) {
  const occupied = [...new Set(itemIds.map((id) => layerOf.get(id) ?? 0))].sort((a, b) => a - b);
  const remap = new Map(occupied.map((rank, index) => [rank, index]));
  return new Map(itemIds.map((id) => [id, remap.get(layerOf.get(id) ?? 0) ?? 0]));
}
function barycenterOrder(itemIds, dag, layerOf, ribOf, declIndex) {
  const incoming = new Map(itemIds.map((id) => [id, []]));
  for (const [from, to] of dag) {
    incoming.get(to)?.push(from);
  }
  const clusterOf = (id) => ribOf.get(id)?.anchorId ?? id;
  const clustersByRank = /* @__PURE__ */ new Map();
  for (const id of itemIds) {
    if (ribOf.has(id)) {
      continue;
    }
    const rank = layerOf.get(id) ?? 0;
    const list = clustersByRank.get(rank) ?? [];
    list.push(id);
    clustersByRank.set(rank, list);
  }
  const clusterIndex = /* @__PURE__ */ new Map();
  const ranks = [...clustersByRank.keys()].sort((a, b) => a - b);
  for (const rank of ranks) {
    const clusters = clustersByRank.get(rank);
    const weightOf = (clusterId) => {
      const preds = (incoming.get(clusterId) ?? []).map(clusterOf).filter((id) => id !== clusterId && (layerOf.get(id) ?? 0) < rank);
      if (preds.length === 0) {
        return declIndex.get(clusterId) ?? 0;
      }
      return preds.reduce((sum, id) => sum + (clusterIndex.get(id) ?? 0), 0) / preds.length;
    };
    clusters.sort((a, b) => weightOf(a) - weightOf(b) || (declIndex.get(a) ?? 0) - (declIndex.get(b) ?? 0));
    clusters.forEach((id, index) => clusterIndex.set(id, index));
  }
  const orderOf = /* @__PURE__ */ new Map();
  for (const id of itemIds) {
    orderOf.set(id, clusterIndex.get(clusterOf(id)) ?? 0);
  }
  return orderOf;
}

// packages/layout/src/placement.ts
var closedSides = () => ({
  mainStart: false,
  mainEnd: false,
  crossStart: false,
  crossEnd: false
});
var EMPTY_LAYERING = {
  layerOf: /* @__PURE__ */ new Map(),
  orderOf: /* @__PURE__ */ new Map(),
  ribOf: /* @__PURE__ */ new Map(),
  hasEdges: false
};
var mainExtent = (item, direction) => direction === "TB" ? item.physHeight : item.physWidth;
var crossExtent = (item, direction) => direction === "TB" ? item.physWidth : item.physHeight;
var transposeRect = (rect) => ({
  x: rect.y,
  y: rect.x,
  width: rect.height,
  height: rect.width
});
function assignRanks(items, layering, ctx) {
  if (layering.hasEdges) {
    for (const item of items) {
      const rib = layering.ribOf.get(item.id) ?? null;
      item.rank = layering.layerOf.get(item.id) ?? 0;
      item.order = layering.orderOf.get(item.id) ?? 0;
      item.rib = rib;
      item.clusterId = rib?.anchorId ?? item.id;
    }
    return;
  }
  const columns = typeof ctx.maxColumns === "number" ? ctx.maxColumns : Math.max(1, Math.ceil(Math.sqrt(items.length)));
  items.forEach((item, index) => {
    item.rank = Math.floor(index / columns);
    item.order = index % columns;
    item.rib = null;
    item.clusterId = item.id;
  });
}
function buildUnit(unitKey, group, ctx) {
  const key = unitKey ?? ROOT_UNIT_KEY;
  const layerings = ctx.layerings.get(key) ?? EMPTY_LAYERING;
  const unitDirection = ctx.unitDirections.get(key) ?? "TB";
  const children = [];
  let declIndex = 0;
  for (const sub of ctx.spec.groups.filter((item) => item.parent === unitKey)) {
    const child = buildUnit(sub.id, sub, ctx);
    child.declIndex = declIndex;
    children.push(child);
    declIndex += 1;
  }
  for (const node of ctx.spec.nodes.filter((item) => item.group === unitKey)) {
    const size = measureNodeSize(node);
    children.push({
      id: node.id,
      kind: "node",
      declIndex,
      rank: 0,
      order: 0,
      clusterId: node.id,
      rib: null,
      unitDirection,
      open: closedSides(),
      physWidth: size.width,
      physHeight: size.height,
      mainAbs: 0,
      crossAbs: 0,
      children: [],
      node
    });
    declIndex += 1;
  }
  assignRanks(children, layerings, ctx);
  const unit = {
    id: key,
    kind: "group",
    declIndex,
    rank: 0,
    order: 0,
    clusterId: key,
    rib: null,
    unitDirection,
    open: closedSides(),
    physWidth: 0,
    physHeight: 0,
    mainAbs: 0,
    crossAbs: 0,
    children,
    group
  };
  unit.plan = planUnit(unit, ctx);
  return unit;
}
function planUnit(unit, ctx) {
  const direction = unit.unitDirection;
  const byRank = /* @__PURE__ */ new Map();
  for (const child of unit.children) {
    const list = byRank.get(child.rank) ?? [];
    list.push(child);
    byRank.set(child.rank, list);
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  const rows = ranks.map((rank) => {
    const items = byRank.get(rank);
    const anchors = items.filter((item) => item.rib === null).sort((a, b) => a.order - b.order || a.declIndex - b.declIndex);
    const row = [];
    for (const anchor of anchors) {
      row.push(anchor);
      for (const rib of items.filter((item) => item.rib !== null && item.clusterId === anchor.id).sort((a, b) => (a.rib?.offset ?? 0) - (b.rib?.offset ?? 0))) {
        row.push(rib);
      }
    }
    return row;
  });
  const clustersPerRow = rows.map((row) => {
    const clusters = [];
    for (let index = 0; index < row.length; ) {
      const anchor = row[index];
      let width = crossExtent(anchor, direction);
      let cursor = index + 1;
      while (cursor < row.length && row[cursor].rib !== null && row[cursor].clusterId === anchor.id) {
        width += crossExtent(row[cursor], direction) + CROSS_GAP;
        cursor += 1;
      }
      clusters.push(width);
      index = cursor;
    }
    return clusters;
  });
  const columnCount = clustersPerRow.reduce((max, row) => Math.max(max, row.length), 0);
  ctx.stats.maxColumns = Math.max(ctx.stats.maxColumns, columnCount);
  if (ranks.length > 0) {
    const firstRank = ranks[0];
    const lastRank = ranks[ranks.length - 1];
    rows.forEach((row, index) => {
      const rank = ranks[index];
      const head = row[0];
      const tail = row[row.length - 1];
      for (const item of row) {
        if (rank === firstRank) {
          item.open.mainStart = true;
        }
        if (rank === lastRank) {
          item.open.mainEnd = true;
        }
      }
      if (head !== void 0) {
        head.open.crossStart = true;
      }
      if (tail !== void 0) {
        tail.open.crossEnd = true;
      }
    });
  }
  const columnWidth = [];
  for (let index = 0; index < columnCount; index += 1) {
    columnWidth.push(clustersPerRow.reduce((max, row) => Math.max(max, row[index] ?? 0), 0));
  }
  const columnX = [];
  let cursorX = 0;
  for (let index = 0; index < columnCount; index += 1) {
    columnX.push(cursorX);
    cursorX += columnWidth[index] + CROSS_GAP;
  }
  const contentCross = columnCount === 0 ? 0 : cursorX - CROSS_GAP;
  const rankMain = /* @__PURE__ */ new Map();
  ranks.forEach((rank, index) => {
    rankMain.set(
      rank,
      rows[index].reduce((max, item) => Math.max(max, mainExtent(item, direction)), 0)
    );
  });
  const box = unit.group !== void 0;
  const rankGap = unit.children.some((child) => child.kind === "group") ? UNIT_GAP : RANK_GAP;
  const padMainStart = box ? direction === "TB" ? UNIT_HEADER_HEIGHT : UNIT_PADDING_X : 0;
  const padMainEnd = box ? direction === "TB" ? UNIT_PADDING_BOTTOM : UNIT_PADDING_X : 0;
  const padCrossStart = box ? direction === "TB" ? UNIT_PADDING_X : UNIT_HEADER_HEIGHT : 0;
  const padCrossEnd = box ? direction === "TB" ? UNIT_PADDING_X : UNIT_PADDING_BOTTOM : 0;
  let contentMain = 0;
  ranks.forEach((rank, index) => {
    if (index > 0) {
      contentMain += rankGap;
    }
    contentMain += rankMain.get(rank);
  });
  const crossTotal = contentCross + padCrossStart + padCrossEnd;
  const mainTotal = contentMain + padMainStart + padMainEnd;
  unit.physWidth = direction === "TB" ? crossTotal : mainTotal;
  unit.physHeight = direction === "TB" ? mainTotal : crossTotal;
  return {
    ranks,
    rows,
    rankMain,
    rankMainStart: /* @__PURE__ */ new Map(),
    columnX,
    columnWidth,
    rankGap,
    padMainStart,
    padMainEnd,
    padCrossStart,
    padCrossEnd,
    contentCross
  };
}
function positionUnit(unit, baseMain, baseCross, ctx) {
  const plan = unit.plan;
  const direction = unit.unitDirection;
  let mainCursor = baseMain + plan.padMainStart;
  plan.ranks.forEach((rank, index) => {
    plan.rankMainStart.set(rank, mainCursor);
    const row = plan.rows[index];
    let clusterIndex = 0;
    for (let cursor = 0; cursor < row.length; ) {
      const anchor = row[cursor];
      const members = [anchor];
      let next = cursor + 1;
      while (next < row.length && row[next].rib !== null && row[next].clusterId === anchor.id) {
        members.push(row[next]);
        next += 1;
      }
      let crossCursor = baseCross + plan.padCrossStart + plan.columnX[clusterIndex];
      for (const member of members) {
        member.mainAbs = mainCursor;
        member.crossAbs = crossCursor;
        crossCursor += crossExtent(member, direction) + CROSS_GAP;
        if (member.kind === "group") {
          const physicalX = direction === "TB" ? member.crossAbs : member.mainAbs;
          const physicalY = direction === "TB" ? member.mainAbs : member.crossAbs;
          const childDirection = member.unitDirection;
          positionUnit(
            member,
            childDirection === "TB" ? physicalY : physicalX,
            childDirection === "TB" ? physicalX : physicalY,
            ctx
          );
        }
      }
      cursor = next;
      clusterIndex += 1;
    }
    mainCursor += plan.rankMain.get(rank) + plan.rankGap;
  });
}
function placeSpec(spec, layerings, unitDirections) {
  const ctx = {
    spec,
    layerings,
    unitDirections,
    maxColumns: spec.layout.maxColumns,
    stats: { maxColumns: 0 }
  };
  const root = buildUnit(void 0, void 0, ctx);
  positionUnit(root, 0, 0, ctx);
  const nodes = [];
  const groups = [];
  const rankBands = [];
  const nodeMeta = /* @__PURE__ */ new Map();
  const absoluteOf = /* @__PURE__ */ new Map();
  const walk = (item, frame2) => {
    const abs = frame2 === "TB" ? { x: item.crossAbs, y: item.mainAbs } : { x: item.mainAbs, y: item.crossAbs };
    const parentKey = item.node?.group ?? item.group?.parent;
    const parent = parentKey !== void 0 ? absoluteOf.get(parentKey) : void 0;
    if (item.kind === "node" && item.node) {
      const node = item.node;
      nodes.push({
        id: node.id,
        title: node.title,
        desc: node.desc,
        variant: node.variant,
        items: node.items,
        groupId: node.group,
        x: abs.x - (parent?.x ?? 0),
        y: abs.y - (parent?.y ?? 0),
        width: item.physWidth,
        height: item.physHeight,
        absX: abs.x,
        absY: abs.y
      });
      nodeMeta.set(node.id, {
        unitKey: node.group ?? ROOT_UNIT_KEY,
        rank: item.rank,
        clusterId: item.clusterId,
        isRib: item.rib !== null,
        unitDirection: item.unitDirection,
        open: item.open
      });
    }
    if (item.kind === "group" && item.group) {
      const group = item.group;
      groups.push({
        id: group.id,
        title: group.title,
        variant: group.variant,
        parentId: group.parent,
        level: groupLevel(group.id, spec.groups),
        x: abs.x - (parent?.x ?? 0),
        y: abs.y - (parent?.y ?? 0),
        width: item.physWidth,
        height: item.physHeight,
        absX: abs.x,
        absY: abs.y
      });
      absoluteOf.set(group.id, abs);
      const plan = item.plan;
      for (const rank of plan.ranks) {
        const local = {
          x: item.crossAbs + plan.padCrossStart,
          y: plan.rankMainStart.get(rank) ?? item.mainAbs,
          width: plan.contentCross,
          height: plan.rankMain.get(rank) ?? 0
        };
        rankBands.push({
          unitKey: group.id,
          rank,
          rect: item.unitDirection === "TB" ? local : transposeRect(local)
        });
      }
    }
    for (const child of item.children) {
      walk(child, item.unitDirection);
    }
  };
  walk(root, root.unitDirection);
  const rootPlan = root.plan;
  for (const rank of rootPlan.ranks) {
    const local = {
      x: rootPlan.padCrossStart,
      y: rootPlan.rankMainStart.get(rank) ?? 0,
      width: rootPlan.contentCross,
      height: rootPlan.rankMain.get(rank) ?? 0
    };
    rankBands.push({
      unitKey: ROOT_UNIT_KEY,
      rank,
      rect: root.unitDirection === "TB" ? local : transposeRect(local)
    });
  }
  const frame = root.unitDirection;
  const contentCross = crossExtent(root, frame);
  const contentMain = mainExtent(root, frame);
  return {
    nodes,
    groups,
    rankBands,
    nodeMeta,
    content: frame === "TB" ? { width: contentCross, height: contentMain } : { width: contentMain, height: contentCross },
    maxColumnsUsed: Math.max(1, ctx.stats.maxColumns)
  };
}

// packages/layout/src/routing.ts
var EPS = 1;
var DETOUR_PAD = 8;
var DETOUR_APPROACH = 16;
var MAX_CORRIDORS = 3;
function anchorOf(rect, side, fraction) {
  switch (side) {
    case "left":
      return { x: rect.x, y: rect.y + rect.height * fraction };
    case "right":
      return { x: rect.x + rect.width, y: rect.y + rect.height * fraction };
    case "top":
      return { x: rect.x + rect.width * fraction, y: rect.y };
    default:
      return { x: rect.x + rect.width * fraction, y: rect.y + rect.height };
  }
}
function simplify(points) {
  const dedup = [];
  for (const point of points) {
    const last = dedup[dedup.length - 1];
    if (last && Math.abs(last.x - point.x) < 0.01 && Math.abs(last.y - point.y) < 0.01) {
      continue;
    }
    dedup.push(point);
  }
  const result = [];
  for (const point of dedup) {
    const a = result[result.length - 2];
    const b = result[result.length - 1];
    if (a && b && a.x === b.x === (b.x === point.x) && a.y === b.y === (b.y === point.y)) {
      result[result.length - 1] = point;
      continue;
    }
    result.push(point);
  }
  return result;
}
function toSegments(points) {
  const segments = [];
  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (Math.abs(from.y - to.y) < 0.01) {
      segments.push({
        axis: "h",
        coord: from.y,
        lo: Math.min(from.x, to.x),
        hi: Math.max(from.x, to.x)
      });
    } else if (Math.abs(from.x - to.x) < 0.01) {
      segments.push({
        axis: "v",
        coord: from.x,
        lo: Math.min(from.y, to.y),
        hi: Math.max(from.y, to.y)
      });
    } else {
      return [];
    }
  }
  return segments;
}
function segmentHitsRect(segment, rect, pad) {
  const x1 = rect.x - pad;
  const y1 = rect.y - pad;
  const x2 = rect.x + rect.width + pad;
  const y2 = rect.y + rect.height + pad;
  if (segment.axis === "h") {
    if (segment.coord < y1 || segment.coord > y2) {
      return false;
    }
    return segment.hi >= x1 && segment.lo <= x2;
  }
  if (segment.coord < x1 || segment.coord > x2) {
    return false;
  }
  return segment.hi >= y1 && segment.lo <= y2;
}
function collides(segments, context) {
  for (const segment of segments) {
    for (const [id, rect] of context.rects) {
      if (context.skipped.has(id)) {
        continue;
      }
      if (segmentHitsRect(segment, rect, COLLISION_PADDING)) {
        return true;
      }
    }
    for (const obstacle of context.obstacles) {
      if (segmentHitsRect(segment, obstacle, 0)) {
        return true;
      }
    }
  }
  return false;
}
function overlapsPlaced(segments, context) {
  for (const segment of segments) {
    for (const raw of context.placed) {
      const other = context.flipPlaced ? flipSegment(raw) : raw;
      if (other.axis !== segment.axis) {
        continue;
      }
      if (Math.abs(other.coord - segment.coord) >= LANE_CLEARANCE) {
        continue;
      }
      if (segment.hi < other.lo - EPS || segment.lo > other.hi + EPS) {
        continue;
      }
      return true;
    }
  }
  return false;
}
function crossesPlaced(segments, context) {
  for (const segment of segments) {
    for (const raw of context.placed) {
      const other = context.flipPlaced ? flipSegment(raw) : raw;
      if (other.axis === segment.axis) {
        continue;
      }
      const horizontal = segment.axis === "h" ? segment : other;
      const vertical = segment.axis === "h" ? other : segment;
      if (horizontal.coord <= vertical.lo + EPS || horizontal.coord >= vertical.hi - EPS) {
        continue;
      }
      if (vertical.coord <= horizontal.lo + EPS || vertical.coord >= horizontal.hi - EPS) {
        continue;
      }
      return true;
    }
  }
  return false;
}
function flipSegment(segment) {
  return { ...segment, axis: segment.axis === "h" ? "v" : "h" };
}
var transposeRect2 = (rect) => ({
  x: rect.y,
  y: rect.x,
  width: rect.height,
  height: rect.width
});
var transposePoint = (point) => ({ x: point.y, y: point.x });
function computeColumnGaps(rects) {
  const intervals = rects.map((rect) => [rect.x, rect.x + rect.width]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [lo, hi] of intervals) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) {
      last[1] = Math.max(last[1], hi);
    } else {
      merged.push([lo, hi]);
    }
  }
  const gaps = [];
  for (let index = 0; index + 1 < merged.length; index += 1) {
    gaps.push((merged[index][1] + merged[index + 1][0]) / 2);
  }
  return gaps;
}
function railXAt(corridorX, offset, context) {
  if (corridorX === context.outerLeftX) {
    return Math.min(corridorX + offset, corridorX);
  }
  if (corridorX === context.outerRightX) {
    return Math.max(corridorX + offset, corridorX);
  }
  return corridorX + offset;
}
function pickCorridors(corridors, target, outerLeftX, outerRightX, limit, outerFirst) {
  const nearest = [...corridors].sort((left, right) => Math.abs(left - target) - Math.abs(right - target)).slice(0, limit);
  if (!outerFirst) {
    return [...nearest, outerLeftX, outerRightX];
  }
  const outer = Math.abs(outerLeftX - target) <= Math.abs(outerRightX - target) ? [outerLeftX, outerRightX] : [outerRightX, outerLeftX];
  return [...outer, ...nearest];
}
function buildCandidates(a, b, lane, isInline, exitFraction, entryFraction, openA, openB, outerFirst, srcCorridors, dstCorridors, context) {
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;
  const bBelow = b.y >= aBottom - EPS;
  const bAbove = bBottom <= a.y + EPS;
  const rowOverlap = Math.min(aBottom, bBottom) - Math.max(a.y, b.y) > EPS;
  const fromBottom = anchorOf(a, "bottom", exitFraction);
  const toTop = anchorOf(b, "top", entryFraction);
  const candidates = [
    // ① 同行肋骨直连
    (offset) => {
      if (!isInline || !rowOverlap || b.x < aRight - EPS) {
        return null;
      }
      const from = anchorOf(a, "right", exitFraction);
      const to = anchorOf(b, "left", entryFraction);
      if (Math.abs(from.y - to.y) < EPS) {
        return [from, to];
      }
      const midX = (aRight + b.x) / 2 + offset;
      return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
    },
    // ② 相邻层正向：下出 → 层间车道 → 上入
    (offset) => {
      if (lane === void 0 || !bBelow) {
        return null;
      }
      const laneY = lane.laneY + offset;
      if (laneY <= aBottom + 2 || laneY >= b.y - 2) {
        return null;
      }
      return [
        fromBottom,
        { x: fromBottom.x, y: laneY },
        { x: toTop.x, y: laneY },
        toTop
      ];
    },
    // ③ 正向：取两点之间中线做水平过渡（无车道信息时的兜底）
    (offset) => {
      if (!bBelow) {
        return null;
      }
      const midY = context.clearY((aBottom + b.y) / 2 + offset);
      return [
        fromBottom,
        { x: fromBottom.x, y: midY },
        { x: toTop.x, y: midY },
        toTop
      ];
    }
  ];
  candidates.push((offset) => {
    if (!bAbove || !openA.mainStart || !openB.mainEnd) {
      return null;
    }
    const from = anchorOf(a, "top", exitFraction);
    const to = anchorOf(b, "bottom", entryFraction);
    const midY = Math.min(context.clearY((bBottom + a.y) / 2 + offset), a.y - 6);
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
  });
  for (const side of ["crossStart", "crossEnd"]) {
    candidates.push((offset) => {
      if (!openA[side] || !openB[side]) {
        return null;
      }
      const left = side === "crossStart";
      const from = anchorOf(a, left ? "left" : "right", exitFraction);
      const to = anchorOf(b, left ? "left" : "right", entryFraction);
      const x = outerFirst ? railXAt(left ? context.outerLeftX : context.outerRightX, offset, context) : left ? Math.min(a.x, b.x) - LANE_STEP - Math.abs(offset) : Math.max(aRight, bRight) + LANE_STEP + Math.abs(offset);
      const route = simplify([from, { x, y: from.y }, { x, y: to.y }, to]);
      if (toSegments(route).length === 0) {
        return null;
      }
      return route;
    });
  }
  for (const side of ["crossStart", "crossEnd"]) {
    if (!openA[side]) {
      continue;
    }
    const portSide = side === "crossStart" ? "left" : "right";
    for (const corridorX of srcCorridors) {
      candidates.push((offset) => {
        if (!bBelow) {
          return null;
        }
        const from = anchorOf(a, portSide, exitFraction);
        const x = railXAt(corridorX, offset, context);
        if (side === "crossStart" ? x > from.x - EPS : x < from.x + EPS) {
          return null;
        }
        const approachY = Math.min(context.clearY(toTop.y - DETOUR_APPROACH - Math.abs(offset)), toTop.y - 6);
        if (approachY <= from.y) {
          return null;
        }
        return simplify([
          from,
          { x, y: from.y },
          { x, y: approachY },
          { x: toTop.x, y: approachY },
          toTop
        ]);
      });
    }
  }
  if (outerFirst) {
    for (const mainSide of ["mainStart", "mainEnd"]) {
      if (!openA[mainSide]) {
        continue;
      }
      const exitSide = mainSide === "mainStart" ? "top" : "bottom";
      for (const crossSide of ["crossStart", "crossEnd"]) {
        if (!openB[crossSide]) {
          continue;
        }
        const enterSide = crossSide === "crossStart" ? "left" : "right";
        candidates.push((offset) => {
          if (!bBelow) {
            return null;
          }
          const from = anchorOf(a, exitSide, exitFraction);
          const to = anchorOf(b, enterSide, entryFraction);
          const railY = mainSide === "mainStart" ? context.topRailY - Math.abs(offset) : context.bottomRailY + Math.abs(offset);
          const x = railXAt(
            crossSide === "crossStart" ? context.outerLeftX : context.outerRightX,
            offset,
            context
          );
          if (mainSide === "mainStart" ? railY > from.y - EPS : railY < from.y + EPS) {
            return null;
          }
          if (crossSide === "crossStart" ? x > to.x - EPS : x < to.x + EPS) {
            return null;
          }
          return simplify([from, { x: from.x, y: railY }, { x, y: railY }, { x, y: to.y }, to]);
        });
      }
    }
  }
  for (const corridorX of srcCorridors) {
    candidates.push((offset) => {
      if (!bBelow) {
        return null;
      }
      const downY = Math.max(aBottom + DETOUR_PAD, context.exitBoxBottom + LANE_CLEARANCE);
      const x = railXAt(corridorX, offset, context);
      const approachY = Math.min(context.clearY(toTop.y - DETOUR_APPROACH - offset), toTop.y - 6);
      if (approachY <= downY) {
        return null;
      }
      return [
        fromBottom,
        { x: fromBottom.x, y: downY },
        { x, y: downY },
        { x, y: approachY },
        { x: toTop.x, y: approachY },
        toTop
      ];
    });
  }
  for (const srcX of srcCorridors) {
    for (const dstX of dstCorridors) {
      candidates.push((offset) => {
        if (bBelow) {
          return null;
        }
        const downY = Math.max(aBottom + DETOUR_PAD, context.exitBoxBottom + LANE_CLEARANCE);
        const railY = context.topRailY - Math.abs(offset);
        const sx = railXAt(srcX, offset, context);
        const dx = railXAt(dstX, offset, context);
        const approachY = Math.min(context.clearY(toTop.y - DETOUR_APPROACH - Math.abs(offset)), toTop.y - 6);
        return [
          fromBottom,
          { x: fromBottom.x, y: downY },
          { x: sx, y: downY },
          { x: sx, y: railY },
          { x: dx, y: railY },
          { x: dx, y: approachY },
          { x: toTop.x, y: approachY },
          toTop
        ];
      });
    }
  }
  return candidates;
}
function openSidesInFrame(meta, frame) {
  if (meta.unitDirection === frame) {
    return meta.open;
  }
  return {
    mainStart: meta.open.crossStart,
    mainEnd: meta.open.crossEnd,
    crossStart: meta.open.mainStart,
    crossEnd: meta.open.mainEnd
  };
}
function routeEdges(spec, placement, edgeFrames) {
  const { nodeMeta, content } = placement;
  const physicalRects = new Map(
    placement.nodes.map((node) => [
      node.id,
      { x: node.absX, y: node.absY, width: node.width, height: node.height }
    ])
  );
  const transposedRects = new Map(
    [...physicalRects].map(([id, rect]) => [id, transposeRect2(rect)])
  );
  const physicalBands = new Map(
    placement.rankBands.map((band) => [`${band.unitKey}\0${band.rank}`, band.rect])
  );
  const transposedBands = new Map(
    [...physicalBands].map(([key, rect]) => [key, transposeRect2(rect)])
  );
  const corridorsOf = /* @__PURE__ */ new Map([
    ["TB", computeColumnGaps([...physicalRects.values()])],
    ["LR", computeColumnGaps([...transposedRects.values()])]
  ]);
  const frameOf = (index) => edgeFrames[index] ?? "TB";
  const rectsOf = (frame) => frame === "TB" ? physicalRects : transposedRects;
  const bandsOf = (frame) => frame === "TB" ? physicalBands : transposedBands;
  const physicalGroupRects = new Map(
    placement.groups.map((group) => [
      group.id,
      { x: group.absX, y: group.absY, width: group.width, height: group.height }
    ])
  );
  const transposedGroupRects = new Map(
    [...physicalGroupRects].map(([id, rect]) => [id, transposeRect2(rect)])
  );
  const groupsOf = (frame) => frame === "TB" ? physicalGroupRects : transposedGroupRects;
  const boxBottomOf = (nodeId, frame) => {
    const unitKey = nodeMeta.get(nodeId)?.unitKey;
    if (unitKey === void 0 || unitKey === ROOT_UNIT_KEY) {
      return Number.NEGATIVE_INFINITY;
    }
    const box = groupsOf(frame).get(unitKey);
    return box === void 0 ? Number.NEGATIVE_INFINITY : box.y + box.height;
  };
  const borderYsOf = (frame) => [...new Set([...groupsOf(frame).values()].flatMap((rect) => [rect.y, rect.y + rect.height]))].sort(
    (left, right) => left - right
  );
  const borderXsOf = (frame) => [...new Set([...groupsOf(frame).values()].flatMap((rect) => [rect.x, rect.x + rect.width]))].sort(
    (left, right) => left - right
  );
  const clearYWith = (borderYs, y) => {
    let lower = Number.NEGATIVE_INFINITY;
    let upper = Number.POSITIVE_INFINITY;
    for (const border of borderYs) {
      if (border <= y && border > lower) {
        lower = border;
      }
      if (border >= y && border < upper) {
        upper = border;
      }
    }
    const low = Number.isFinite(lower) ? lower + LANE_CLEARANCE : Number.NEGATIVE_INFINITY;
    const high = Number.isFinite(upper) ? upper - LANE_CLEARANCE : Number.POSITIVE_INFINITY;
    if (low > high) {
      if (lower === upper) {
        return y + LANE_CLEARANCE;
      }
      return Number.isFinite(lower) && Number.isFinite(upper) ? (lower + upper) / 2 : y;
    }
    return Math.min(Math.max(y, low), high);
  };
  const clearXWith = clearYWith;
  const groupChain = /* @__PURE__ */ new Map();
  {
    const parentOf = new Map(placement.groups.map((group) => [group.id, group.parentId]));
    for (const group of placement.groups) {
      const chain = /* @__PURE__ */ new Set([group.id]);
      let cursor = parentOf.get(group.id);
      while (cursor !== void 0 && !chain.has(cursor)) {
        chain.add(cursor);
        cursor = parentOf.get(cursor);
      }
      groupChain.set(group.id, chain);
    }
  }
  const bandAcross = (frame, nodeId, side) => {
    const meta = nodeMeta.get(nodeId);
    if (meta === void 0) {
      return null;
    }
    const band = bandsOf(frame).get(`${meta.unitKey}\0${meta.rank}`);
    if (band === void 0) {
      return null;
    }
    return side === "top" ? band.y : band.y + band.height;
  };
  const edgeCount = spec.edges.length;
  const isInline = new Array(edgeCount).fill(false);
  const longSpan = new Array(edgeCount).fill(true);
  const laneOf = /* @__PURE__ */ new Map();
  const laneGroups = /* @__PURE__ */ new Map();
  spec.edges.forEach((edge, index) => {
    const frame = frameOf(index);
    const rects = rectsOf(frame);
    const a = rects.get(edge.from);
    const b = rects.get(edge.to);
    const metaA = nodeMeta.get(edge.from);
    const metaB = nodeMeta.get(edge.to);
    if (a === void 0 || b === void 0 || metaA === void 0 || metaB === void 0) {
      return;
    }
    if (metaA.unitKey === metaB.unitKey && metaA.rank === metaB.rank) {
      isInline[index] = true;
      longSpan[index] = false;
      return;
    }
    if (b.y < a.y + a.height - EPS) {
      return;
    }
    const bandBottom = bandAcross(frame, edge.from, "bottom");
    const bandTop = bandAcross(frame, edge.to, "top");
    if (bandBottom === null || bandTop === null) {
      return;
    }
    const gap = bandTop - bandBottom;
    if (gap <= 0 || gap > MAX_LANE_GAP) {
      return;
    }
    longSpan[index] = false;
    const key = `${frame}\0${metaB.unitKey}\0${metaB.rank}`;
    const list = laneGroups.get(key) ?? [];
    list.push(index);
    laneGroups.set(key, list);
  });
  for (const [key, indices] of laneGroups) {
    const frame = key.startsWith("LR") ? "LR" : "TB";
    const rects = rectsOf(frame);
    const centerOf = (index) => {
      const edge = spec.edges[index];
      const a = rects.get(edge.from);
      const b = rects.get(edge.to);
      return Math.min(a.x + a.width / 2, b.x + b.width / 2);
    };
    const sorted = [...indices].sort((left, right) => centerOf(left) - centerOf(right));
    const first = spec.edges[sorted[0]];
    const bandBottom = Math.max(
      bandAcross(frame, first.from, "bottom") ?? 0,
      boxBottomOf(first.from, frame)
    );
    const bandTop = bandAcross(frame, first.to, "top") ?? 0;
    const gap = Math.max(0, bandTop - bandBottom);
    const step = Math.max(LANE_STEP, Math.min(gap / (sorted.length + 1), LANE_STEP * 3));
    const frameBorderYs = borderYsOf(frame);
    sorted.forEach((index, laneIndex) => {
      laneOf.set(index, {
        laneY: clearYWith(frameBorderYs, bandBottom + step * (laneIndex + 1))
      });
    });
  }
  const placed = [];
  const outCount = /* @__PURE__ */ new Map();
  const inCount = /* @__PURE__ */ new Map();
  for (const edge of spec.edges) {
    outCount.set(edge.from, (outCount.get(edge.from) ?? 0) + 1);
    inCount.set(edge.to, (inCount.get(edge.to) ?? 0) + 1);
  }
  const outSeen = /* @__PURE__ */ new Map();
  const inSeen = /* @__PURE__ */ new Map();
  return spec.edges.map((edge, index) => {
    const frame = frameOf(index);
    const flipped = frame === "LR";
    const rects = rectsOf(frame);
    const a = rects.get(edge.from);
    const b = rects.get(edge.to);
    const id = `e_${index}`;
    if (a === void 0 || b === void 0) {
      return { id, from: edge.from, to: edge.to, label: edge.label, style: edge.style, points: [] };
    }
    const outOrdinal = outSeen.get(edge.from) ?? 0;
    outSeen.set(edge.from, outOrdinal + 1);
    const inOrdinal = inSeen.get(edge.to) ?? 0;
    inSeen.set(edge.to, inOrdinal + 1);
    const exitFraction = (outOrdinal + 1) / ((outCount.get(edge.from) ?? 1) + 1);
    const entryFraction = (inOrdinal + 1) / ((inCount.get(edge.to) ?? 1) + 1);
    const frameWidth = flipped ? content.height : content.width;
    const frameHeight = flipped ? content.width : content.height;
    const outerLeftX = -OUTER_CHANNEL_GAP;
    const outerRightX = frameWidth + OUTER_CHANNEL_GAP;
    const outerFirst = longSpan[index];
    const obstacles = [];
    if (outerFirst) {
      const exempt = /* @__PURE__ */ new Set();
      for (const nodeId of [edge.from, edge.to]) {
        const unitKey = nodeMeta.get(nodeId)?.unitKey;
        if (unitKey === void 0 || unitKey === ROOT_UNIT_KEY) {
          continue;
        }
        for (const id2 of groupChain.get(unitKey) ?? []) {
          exempt.add(id2);
        }
      }
      for (const [id2, rect] of groupsOf(frame)) {
        if (!exempt.has(id2)) {
          obstacles.push(rect);
        }
      }
    }
    const borderXs = borderXsOf(frame);
    const corridors = corridorsOf.get(frame).map((x) => clearXWith(borderXs, x));
    const srcCorridors = pickCorridors(
      corridors,
      a.x + a.width / 2,
      outerLeftX,
      outerRightX,
      MAX_CORRIDORS,
      outerFirst
    );
    const dstCorridors = pickCorridors(
      corridors,
      b.x + b.width / 2,
      outerLeftX,
      outerRightX,
      1,
      outerFirst
    );
    const context = {
      rects,
      skipped: /* @__PURE__ */ new Set([edge.from, edge.to]),
      topRailY: -TOP_RAIL_HEIGHT,
      // 底栏杆与顶栏杆取同一净距（OUTER_CHANNEL_GAP 与 TOP_RAIL_HEIGHT 同为 LANE_CLEARANCE）
      bottomRailY: frameHeight + OUTER_CHANNEL_GAP,
      outerLeftX,
      outerRightX,
      placed,
      flipPlaced: flipped,
      obstacles,
      exitBoxBottom: boxBottomOf(edge.from, frame),
      clearY: (y) => clearYWith(borderYsOf(frame), y)
    };
    const candidates = buildCandidates(
      a,
      b,
      laneOf.get(index),
      isInline[index],
      exitFraction,
      entryFraction,
      openSidesInFrame(nodeMeta.get(edge.from), frame),
      openSidesInFrame(nodeMeta.get(edge.to), frame),
      outerFirst,
      srcCorridors,
      dstCorridors,
      context
    );
    const commit = (segments) => {
      placed.push(...segments.map((segment) => flipped ? flipSegment(segment) : segment));
    };
    const acceptors = [
      (segments) => !collides(segments, context) && !overlapsPlaced(segments, context) && !crossesPlaced(segments, context),
      (segments) => !collides(segments, context) && !overlapsPlaced(segments, context),
      (segments) => !collides(segments, context)
    ];
    let chosen = null;
    for (const accept of acceptors) {
      for (const candidate of candidates) {
        for (let step = 0; step < LANE_LIMIT && chosen === null; step += 1) {
          const points = candidate(laneOffset(step));
          if (points === null) {
            break;
          }
          const simplified = simplify(points);
          const segments = toSegments(simplified);
          if (segments.length === 0 || !accept(segments)) {
            continue;
          }
          commit(segments);
          chosen = simplified;
        }
        if (chosen !== null) {
          break;
        }
      }
      if (chosen !== null) {
        break;
      }
    }
    if (chosen === null) {
      const from = anchorOf(a, "bottom", 0.5);
      const to = anchorOf(b, "top", 0.5);
      const midY = (from.y + to.y) / 2;
      const lastResort = candidates[candidates.length - 1]?.(0) ?? [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
      chosen = simplify(lastResort);
      commit(toSegments(chosen));
    }
    return {
      id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      style: edge.style,
      points: flipped ? chosen.map(transposePoint) : chosen
    };
  });
}
function laneOffset(step) {
  if (step === 0) {
    return 0;
  }
  const magnitude = Math.ceil(step / 2) * LANE_STEP;
  return step % 2 === 1 ? magnitude : -magnitude;
}

// packages/layout/src/layout.ts
function shiftNode(node, dx, dy) {
  const free = node.groupId === void 0;
  return {
    ...node,
    x: free ? node.x + dx : node.x,
    y: free ? node.y + dy : node.y,
    absX: node.absX + dx,
    absY: node.absY + dy
  };
}
function shiftGroup(group, dx, dy) {
  const free = group.parentId === void 0;
  return {
    ...group,
    x: free ? group.x + dx : group.x,
    y: free ? group.y + dy : group.y,
    absX: group.absX + dx,
    absY: group.absY + dy
  };
}
function shiftEdge(edge, dx, dy) {
  return { ...edge, points: edge.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
}
async function layoutSpec(spec) {
  const layerings = computeUnitLayerings(spec);
  const unitDirections = resolveUnitDirections(spec, layerings);
  const edgeFrames = resolveEdgeFrames(spec, unitDirections);
  const placement = placeSpec(spec, layerings, unitDirections);
  const edges = routeEdges(spec, placement, edgeFrames);
  const nodes = placement.nodes.map((node) => ({
    id: node.id,
    title: node.title,
    desc: node.desc,
    variant: node.variant,
    items: node.items,
    groupId: node.groupId,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    absX: node.absX,
    absY: node.absY
  }));
  const groups = placement.groups.map((group) => ({
    id: group.id,
    title: group.title,
    variant: group.variant,
    parentId: group.parentId,
    level: group.level,
    x: group.x,
    y: group.y,
    width: group.width,
    height: group.height,
    absX: group.absX,
    absY: group.absY
  }));
  const bounds = {
    minX: 0,
    minY: 0,
    maxX: placement.content.width,
    maxY: placement.content.height
  };
  const include = (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  for (const node of nodes) {
    include(node.absX, node.absY);
    include(node.absX + node.width, node.absY + node.height);
  }
  for (const group of groups) {
    include(group.absX, group.absY);
    include(group.absX + group.width, group.absY + group.height);
  }
  for (const edge of edges) {
    for (const point of edge.points) {
      include(point.x, point.y);
    }
  }
  const dx = -bounds.minX;
  const dy = -bounds.minY;
  return {
    meta: spec.meta,
    nodes: nodes.map((node) => shiftNode(node, dx, dy)),
    groups: groups.map((group) => shiftGroup(group, dx, dy)),
    edges: edges.map((edge) => shiftEdge(edge, dx, dy)),
    bounds: {
      width: Math.ceil(bounds.maxX - bounds.minX),
      height: Math.ceil(bounds.maxY - bounds.minY)
    },
    maxColumns: placement.maxColumnsUsed
  };
}

// packages/drawio/src/html-value.ts
function buildNodeLabel(node) {
  const parts = [`<b>${escapeHtml(node.title)}</b>`];
  if (node.desc) {
    parts.push(
      `<font style="font-size:${DESC_FONT_SIZE}px;text-align:center">${escapeHtml(node.desc)}</font>`
    );
  }
  if (node.items.length > 0) {
    const items = node.items.map((item) => `<font style="font-size:${ITEM_FONT_SIZE}px">${escapeHtml(item)}</font>`).join("<br>");
    parts.push('<hr size="1">');
    parts.push(`<div style="text-align:left">${items}</div>`);
  }
  return parts.join("<br>");
}
function buildGroupLabel(title) {
  return escapeHtml(title);
}
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// packages/drawio/src/serialize.ts
function escapeXmlAttribute(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/\r?\n/g, "&#10;");
}
function formatNumber(value) {
  return String(Math.round(value * 100) / 100);
}

// packages/drawio/src/filename.ts
var ILLEGAL_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;
function toDrawioFileName(title) {
  const sanitized = title.replace(ILLEGAL_CHARS, "_").replace(/\s+/g, " ").replace(/^[.\s]+|[.\s]+$/g, "").trim();
  return `${sanitized.length > 0 ? sanitized : "architecture"}.drawio`;
}

// packages/drawio/src/mxgraph-model.ts
function buildDrawio(input) {
  const { title, spec, layout } = input;
  const pageWidth = Math.ceil(layout.bounds.width + CANVAS_MARGIN * 2);
  const pageHeight = Math.ceil(layout.bounds.height + CANVAS_MARGIN * 2);
  const diagramName = spec.meta.title ?? title;
  const indent = (depth) => "  ".repeat(depth);
  const lines = [];
  lines.push(
    `<mxfile host="dsh-diagram" agent="dsh-diagram/0.1.0" type="device">`,
    `${indent(1)}<diagram id="dsh-diagram-page-1" name="${escapeXmlAttribute(diagramName)}">`,
    `${indent(2)}<mxGraphModel dx="0" dy="0" grid="1" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" math="0" shadow="0" pageWidth="${pageWidth}" pageHeight="${pageHeight}" background="#0f172a">`,
    `${indent(3)}<root>`,
    `${indent(4)}<mxCell id="0"/>`,
    `${indent(4)}<mxCell id="1" parent="0"/>`
  );
  const sortedGroups = [...layout.groups].sort((a, b) => a.level - b.level);
  for (const group of sortedGroups) {
    lines.push(
      `${indent(4)}<mxCell id="${escapeXmlAttribute(group.id)}" value="${escapeXmlAttribute(buildGroupLabel(group.title))}" style="${escapeXmlAttribute(groupStyle(group.variant))}" vertex="1" parent="${escapeXmlAttribute(group.parentId ?? "1")}">`,
      `${indent(5)}<mxGeometry x="${formatNumber(group.x)}" y="${formatNumber(group.y)}" width="${formatNumber(group.width)}" height="${formatNumber(group.height)}" as="geometry"/>`,
      `${indent(4)}</mxCell>`
    );
  }
  for (const node of layout.nodes) {
    lines.push(
      `${indent(4)}<mxCell id="${escapeXmlAttribute(node.id)}" value="${escapeXmlAttribute(buildNodeLabel(node))}" style="${escapeXmlAttribute(nodeStyle(node.variant))}" vertex="1" parent="${escapeXmlAttribute(node.groupId ?? "1")}">`,
      `${indent(5)}<mxGeometry x="${formatNumber(node.x)}" y="${formatNumber(node.y)}" width="${formatNumber(node.width)}" height="${formatNumber(node.height)}" as="geometry"/>`,
      `${indent(4)}</mxCell>`
    );
  }
  for (const edge of layout.edges) {
    lines.push(
      `${indent(4)}<mxCell id="${escapeXmlAttribute(edge.id)}" value="${escapeXmlAttribute(edge.label ?? "")}" style="${escapeXmlAttribute(edgeStyle(edge.style))}" edge="1" parent="1" source="${escapeXmlAttribute(edge.from)}" target="${escapeXmlAttribute(edge.to)}">`
    );
    const waypoints = edge.points.slice(1, -1);
    if (waypoints.length > 0) {
      lines.push(`${indent(5)}<mxGeometry relative="1" as="geometry">`);
      lines.push(`${indent(6)}<Array as="points">`);
      for (const point of waypoints) {
        lines.push(
          `${indent(7)}<mxPoint x="${formatNumber(point.x)}" y="${formatNumber(point.y)}"/>`
        );
      }
      lines.push(`${indent(6)}</Array>`);
      lines.push(`${indent(5)}</mxGeometry>`);
    } else {
      lines.push(`${indent(5)}<mxGeometry relative="1" as="geometry"/>`);
    }
    lines.push(`${indent(4)}</mxCell>`);
  }
  lines.push(
    `${indent(3)}</root>`,
    `${indent(2)}</mxGraphModel>`,
    `${indent(1)}</diagram>`,
    `</mxfile>`,
    ""
  );
  return {
    fileName: toDrawioFileName(title),
    xml: lines.join("\n")
  };
}

// plugin/src/diagram/scene.ts
var SVG_PALETTE = {
  background: "#0f172a",
  edge: "#64748b",
  edgeActive: "#38bdf8",
  edgeLabel: "#cbd5e1",
  edgeLabelBg: "#152238",
  groupTitle: "#94a3b8",
  separator: "#334155"
};
var SCENE_MARGIN = 16;
function wrapText(text, fontSize, maxWidth) {
  if (text.length === 0) return [];
  const lines = [];
  for (const segment of text.split(/\r?\n/)) {
    if (segment.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const char of segment) {
      const candidate = line + char;
      if (line.length > 0 && estimateTextWidth(candidate, fontSize) > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = candidate;
      }
    }
    if (line.length > 0) lines.push(line);
  }
  return lines;
}
function pathOf(points) {
  if (points.length === 0) return "";
  const [head, ...rest] = points;
  return `M ${head.x} ${head.y}` + rest.map((point) => ` L ${point.x} ${point.y}`).join("");
}
function midpointOf(points) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  let remaining = total / 2;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length >= remaining) {
      const t = length === 0 ? 0 : remaining / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= length;
  }
  return points[points.length - 1];
}
function baselineOf(lineTop, lineHeight) {
  return lineTop + lineHeight * 0.72;
}
function buildScene(layout, spec) {
  const knownNodes = new Set(spec.nodes.map((node) => node.id));
  const groups = layout.groups.map((group) => {
    const theme = GROUP_THEME[group.variant];
    return {
      id: group.id,
      title: group.title,
      rect: {
        x: group.absX,
        y: group.absY,
        width: group.width,
        height: group.height,
        fill: theme.fillColor === "none" ? "none" : theme.fillColor,
        stroke: theme.strokeColor,
        dash: theme.dashed === "1" ? "6 5" : void 0,
        rx: 8
      },
      titleText: {
        x: group.absX + 10,
        y: group.absY + 17,
        text: group.title,
        size: 12,
        fill: SVG_PALETTE.groupTitle,
        anchor: "start"
      }
    };
  });
  const nodes = layout.nodes.map((node) => {
    const theme = NODE_THEME[node.variant];
    const texts = [];
    let cursor = node.absY + NODE_PADDING_VERTICAL / 2;
    const centerX = node.absX + node.width / 2;
    const leftX = node.absX + 10;
    for (const line of wrapText(node.title, TITLE_FONT_SIZE, NODE_TEXT_MAX_WIDTH)) {
      texts.push({
        x: centerX,
        y: baselineOf(cursor, TITLE_LINE_HEIGHT),
        text: line,
        size: TITLE_FONT_SIZE,
        fill: theme.fontColor,
        anchor: "middle",
        weight: 700
      });
      cursor += TITLE_LINE_HEIGHT;
    }
    if (node.desc !== void 0) {
      for (const line of wrapText(node.desc, DESC_FONT_SIZE, NODE_TEXT_MAX_WIDTH)) {
        texts.push({
          x: centerX,
          y: baselineOf(cursor, DESC_LINE_HEIGHT),
          text: line,
          size: DESC_FONT_SIZE,
          fill: theme.fontColor,
          anchor: "middle",
          opacity: 0.78
        });
        cursor += DESC_LINE_HEIGHT;
      }
    }
    let separator;
    if (node.items.length > 0) {
      const mid = cursor + ITEM_SEPARATOR_HEIGHT / 2;
      separator = { x1: leftX, y1: mid, x2: node.absX + node.width - 10, y2: mid };
      cursor += ITEM_SEPARATOR_HEIGHT;
      for (const item of node.items) {
        for (const line of wrapText(item, ITEM_FONT_SIZE, NODE_TEXT_MAX_WIDTH)) {
          texts.push({
            x: leftX,
            y: baselineOf(cursor, ITEM_LINE_HEIGHT),
            text: line,
            size: ITEM_FONT_SIZE,
            fill: theme.fontColor,
            anchor: "start",
            opacity: 0.85
          });
          cursor += ITEM_LINE_HEIGHT;
        }
      }
    }
    return {
      id: node.id,
      title: node.title,
      rect: {
        x: node.absX,
        y: node.absY,
        width: node.width,
        height: node.height,
        fill: theme.fillColor,
        stroke: theme.strokeColor,
        rx: 8
      },
      texts,
      separator
    };
  });
  const edges = layout.edges.filter((edge) => knownNodes.has(edge.from) && knownNodes.has(edge.to) && edge.points.length > 1).map((edge) => {
    const label = edge.label;
    const mid = midpointOf(edge.points);
    const width = label === void 0 ? 0 : Math.round(estimateTextWidth(label, 12)) + 12;
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      path: pathOf(edge.points),
      both: edge.style === "bidirectional",
      dash: edge.style === "dashed" ? "8 4" : void 0,
      label: label === void 0 ? void 0 : { x: mid.x, y: mid.y + 4, text: label, width, height: 16 }
    };
  });
  return {
    viewBox: {
      x: -SCENE_MARGIN,
      y: -SCENE_MARGIN,
      width: Math.max(1, Math.ceil(layout.bounds.width) + SCENE_MARGIN * 2),
      height: Math.max(1, Math.ceil(layout.bounds.height) + SCENE_MARGIN * 2)
    },
    background: SVG_PALETTE.background,
    groups,
    nodes,
    edges
  };
}

// plugin/src/diagram/DiagramCanvas.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var MIN_ZOOM = 0.1;
var MAX_ZOOM = 4;
var MIN_VIEWPORT_HEIGHT = 160;
var MAX_VIEWPORT_HEIGHT = 440;
var PREVIEW_VIEWPORT_HEIGHT = 240;
var FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
var styles = {
  shell: {
    position: "relative",
    borderRadius: "10px",
    border: "1px solid var(--dsw-alias-border-l1)",
    background: SVG_PALETTE.background,
    overflow: "hidden"
  },
  canvas: {
    display: "block",
    width: "100%",
    cursor: "grab",
    touchAction: "none"
  },
  toolbar: {
    position: "absolute",
    top: "8px",
    right: "8px",
    display: "flex",
    gap: "4px",
    alignItems: "center",
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "3px"
  },
  button: {
    border: "1px solid transparent",
    background: "transparent",
    color: SVG_PALETTE.edgeLabel,
    fontSize: "12px",
    lineHeight: 1.4,
    padding: "2px 7px",
    borderRadius: "6px",
    cursor: "pointer",
    whiteSpace: "nowrap"
  },
  hint: {
    position: "absolute",
    left: "8px",
    bottom: "6px",
    fontSize: "11px",
    color: "var(--dsw-alias-label-secondary)",
    opacity: 0.75,
    pointerEvents: "none"
  }
};
function clampZoom(k) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
}
function DiagramCanvas({ scene, fileName, onDownload, labels, idPrefix, variant = "card" }) {
  const hostRef = (0, import_react.useRef)(null);
  const [hostWidth, setHostWidth] = (0, import_react.useState)(0);
  const [view, setView] = (0, import_react.useState)({ k: 1, x: 0, y: 0 });
  const [hovered, setHovered] = (0, import_react.useState)(null);
  const userAdjusted = (0, import_react.useRef)(false);
  const dragging = (0, import_react.useRef)(null);
  const contentW = Math.max(1, scene.viewBox.width);
  const contentH = Math.max(1, scene.viewBox.height);
  const vx = scene.viewBox.x;
  const vy = scene.viewBox.y;
  const fitWidthScale = hostWidth > 0 ? Math.min(1, hostWidth / contentW) : 1;
  const maxViewportHeight = variant === "preview" ? PREVIEW_VIEWPORT_HEIGHT : MAX_VIEWPORT_HEIGHT;
  const viewportHeight = Math.max(
    MIN_VIEWPORT_HEIGHT,
    Math.min(maxViewportHeight, Math.round(contentH * fitWidthScale))
  );
  (0, import_react.useEffect)(() => {
    const host = hostRef.current;
    if (host === null) return;
    const measure = () => setHostWidth(host.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);
  (0, import_react.useEffect)(() => {
    userAdjusted.current = false;
  }, [scene]);
  (0, import_react.useEffect)(() => {
    if (hostWidth <= 0 || userAdjusted.current) return;
    setView(fitWidth());
  }, [hostWidth, scene, viewportHeight]);
  function fitWidth() {
    const k = hostWidth > 0 ? Math.min(1, hostWidth / contentW) : 1;
    return { k, x: (hostWidth - contentW * k) / 2 - k * vx, y: -k * vy };
  }
  function fitAll() {
    const k = clampZoom(Math.min(hostWidth / contentW, viewportHeight / contentH, 1));
    return {
      k,
      x: (hostWidth - contentW * k) / 2 - k * vx,
      y: (viewportHeight - contentH * k) / 2 - k * vy
    };
  }
  function zoomAt(pointX, pointY, factor) {
    setView((current) => {
      const k = clampZoom(current.k * factor);
      if (k === current.k) return current;
      const cx = (pointX - current.x) / current.k;
      const cy = (pointY - current.y) / current.k;
      return { k, x: pointX - cx * k, y: pointY - cy * k };
    });
  }
  (0, import_react.useEffect)(() => {
    const host = hostRef.current;
    if (host === null) return;
    const onWheel = (event) => {
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      event.preventDefault();
      userAdjusted.current = true;
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, Math.exp(-event.deltaY * 15e-4));
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, []);
  function onPointerDown(event) {
    if (event.button !== 0) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    dragging.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y
    };
  }
  function onPointerMove(event) {
    const drag = dragging.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    userAdjusted.current = true;
    setView((current) => ({
      ...current,
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY)
    }));
  }
  function onPointerUp(event) {
    const drag = dragging.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }
  function onDoubleClick(event) {
    void event;
    userAdjusted.current = true;
    setView(fitAll());
  }
  const hoverActive = hovered !== null;
  const arrowEnd = `${idPrefix}-arrow-end`;
  const arrowStart = `${idPrefix}-arrow-start`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { ref: hostRef, style: styles.shell, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: { ...styles.canvas, height: `${viewportHeight}px`, cursor: dragging.current === null ? "grab" : "grabbing" },
        role: "img",
        "aria-label": scene.groups.map((group) => group.title).join(" / "),
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        onDoubleClick,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "svg",
          {
            width: hostWidth > 0 ? hostWidth : "100%",
            height: viewportHeight,
            viewBox: `0 0 ${hostWidth > 0 ? hostWidth : 800} ${viewportHeight}`,
            style: { display: "block", userSelect: "none" },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("marker", { id: arrowEnd, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: SVG_PALETTE.edge }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("marker", { id: arrowStart, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: SVG_PALETTE.edge }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("marker", { id: `${arrowEnd}-active`, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: SVG_PALETTE.edgeActive }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("marker", { id: `${arrowStart}-active`, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: SVG_PALETTE.edgeActive }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: -4e3, y: -4e3, width: 8e3, height: 8e3, fill: scene.background }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { transform: `translate(${view.x} ${view.y}) scale(${view.k})`, fontFamily: FONT_STACK, children: [
                scene.groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "rect",
                    {
                      x: group.rect.x,
                      y: group.rect.y,
                      width: group.rect.width,
                      height: group.rect.height,
                      rx: group.rect.rx,
                      fill: group.rect.fill,
                      stroke: group.rect.stroke,
                      strokeWidth: 1,
                      strokeDasharray: group.rect.dash
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "text",
                    {
                      x: group.titleText.x,
                      y: group.titleText.y,
                      fontSize: group.titleText.size,
                      fill: group.titleText.fill,
                      textAnchor: group.titleText.anchor,
                      children: group.titleText.text
                    }
                  )
                ] }, group.id)),
                scene.edges.map((edge) => {
                  const active = hoverActive && (edge.from === hovered || edge.to === hovered);
                  const dimmed = hoverActive && !active;
                  const stroke = active ? SVG_PALETTE.edgeActive : SVG_PALETTE.edge;
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { opacity: dimmed ? 0.22 : 1, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "path",
                      {
                        d: edge.path,
                        fill: "none",
                        stroke,
                        strokeWidth: active ? 2.4 : 1.4,
                        strokeDasharray: edge.dash,
                        markerEnd: `url(#${active ? `${arrowEnd}-active` : arrowEnd})`,
                        markerStart: edge.both ? `url(#${active ? `${arrowStart}-active` : arrowStart})` : void 0
                      }
                    ),
                    edge.label !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "rect",
                        {
                          x: edge.label.x - edge.label.width / 2,
                          y: edge.label.y - edge.label.height / 2 - 3,
                          width: edge.label.width,
                          height: edge.label.height,
                          rx: 4,
                          fill: SVG_PALETTE.edgeLabelBg
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "text",
                        {
                          x: edge.label.x,
                          y: edge.label.y + 1,
                          fontSize: 11,
                          fill: active ? SVG_PALETTE.edgeActive : SVG_PALETTE.edgeLabel,
                          textAnchor: "middle",
                          children: edge.label.text
                        }
                      )
                    ] })
                  ] }, edge.id);
                }),
                scene.nodes.map((node) => {
                  const isHovered = node.id === hovered;
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                    "g",
                    {
                      onMouseEnter: () => setHovered(node.id),
                      onMouseLeave: () => setHovered((current) => current === node.id ? null : current),
                      style: { cursor: "pointer" },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "rect",
                          {
                            x: node.rect.x,
                            y: node.rect.y,
                            width: node.rect.width,
                            height: node.rect.height,
                            rx: node.rect.rx,
                            fill: node.rect.fill,
                            stroke: isHovered ? SVG_PALETTE.edgeActive : node.rect.stroke,
                            strokeWidth: isHovered ? 2 : 1
                          }
                        ),
                        node.separator !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "line",
                          {
                            x1: node.separator.x1,
                            y1: node.separator.y1,
                            x2: node.separator.x2,
                            y2: node.separator.y2,
                            stroke: SVG_PALETTE.separator,
                            strokeWidth: 1
                          }
                        ),
                        node.texts.map((text, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "text",
                          {
                            x: text.x,
                            y: text.y,
                            fontSize: text.size,
                            fill: text.fill,
                            textAnchor: text.anchor,
                            fontWeight: text.weight,
                            opacity: text.opacity,
                            pointerEvents: "none",
                            children: text.text
                          },
                          `${node.id}-t${index}`
                        ))
                      ]
                    },
                    node.id
                  );
                })
              ] })
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.toolbar, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: styles.button, title: labels.zoomOut, onClick: () => {
        userAdjusted.current = true;
        zoomAt(hostWidth / 2, viewportHeight / 2, 1 / 1.25);
      }, children: "\u2212" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: styles.button, title: labels.zoomIn, onClick: () => {
        userAdjusted.current = true;
        zoomAt(hostWidth / 2, viewportHeight / 2, 1.25);
      }, children: "+" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: styles.button, onClick: () => {
        userAdjusted.current = true;
        setView(fitWidth());
      }, children: labels.fitWidth }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: styles.button, onClick: () => {
        userAdjusted.current = true;
        setView(fitAll());
      }, children: labels.fitAll }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: styles.button, title: fileName, onClick: onDownload, children: labels.download })
    ] }),
    variant === "card" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.hint, children: "\u6EDA\u8F6E\u7F29\u653E \xB7 \u62D6\u52A8\u5E73\u79FB \xB7 \u60AC\u505C\u8282\u70B9\u9AD8\u4EAE\u8FDE\u7EBF" })
  ] });
}

// plugin/src/diagram/model.ts
var import_react2 = require("react");
function asArchSpec(value) {
  if (typeof value !== "object" || value === null) throw new Error("YAML \u9876\u5C42\u4E0D\u662F\u5BF9\u8C61");
  const candidate = value;
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    throw new Error("\u7F3A\u5C11 nodes / edges \u6570\u7EC4");
  }
  return value;
}
async function buildDiagramModel(yamlSpec, title) {
  const parsed = parseYaml(yamlSpec);
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message ?? "YAML \u89E3\u6790\u5931\u8D25");
  const spec = normalizeSpec(asArchSpec(parsed.value));
  const layout = await layoutSpec(spec);
  const scene = buildScene(layout, spec);
  return { scene, spec, layout, title: title !== "" ? title : spec.meta.title ?? "" };
}
function downloadDrawio(model) {
  const artifact = buildDrawio({
    title: model.title === "" ? "diagram" : model.title,
    spec: model.spec,
    layout: model.layout
  });
  const blob = new Blob([artifact.xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.fileName;
  anchor.rel = "noopener";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
  return artifact.fileName;
}
function useDiagramModel(yamlSpec, title) {
  const [model, setModel] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)(null);
  (0, import_react2.useEffect)(() => {
    if (yamlSpec === "") {
      setModel(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const next = await buildDiagramModel(yamlSpec, title);
        if (!cancelled) setModel(next);
      } catch (cause) {
        if (cancelled) return;
        setModel(null);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [yamlSpec, title]);
  return { model, error };
}

// plugin/src/diagram/TurnPreview.tsx
var import_react3 = require("react");

// plugin/src/diagram/turn-diagrams.ts
var DIAGRAM_TURN_KIND = "dshDiagramTurn";
var DIAGRAM_TURN_DATA_KEY = "dshDiagramTurn";
var TRACKED_TOOLS = ["render_architecture", "yaml_to_drawio"];
function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function parseArguments(raw) {
  if (typeof raw !== "string" || raw === "") return void 0;
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return void 0;
  }
}
var diagramTurnDefinition = {
  kind: DIAGRAM_TURN_KIND,
  match(event) {
    const turn = asRecord(event.data)?.turn;
    if (typeof turn !== "number") return null;
    if (event.type === "turn/start") return { id: String(turn), role: "start" };
    if (event.type === "tool/call" || event.type === "tool/result") return { id: String(turn), role: "update" };
    return null;
  },
  start(_context, match) {
    const turn = asRecord(match.event.data)?.turn;
    return { turn: typeof turn === "number" ? turn : 0, pending: {}, diagrams: [] };
  },
  update(context, match) {
    const state = context.state;
    const data = asRecord(match.event.data);
    if (state === void 0 || data === void 0) {
      return { turn: 0, pending: {}, diagrams: [] };
    }
    if (match.event.type === "tool/call") {
      const callId = typeof data.callId === "string" ? data.callId : void 0;
      const name = typeof data.name === "string" ? data.name : void 0;
      if (callId === void 0 || name === void 0 || !TRACKED_TOOLS.includes(name)) return state;
      const args = parseArguments(data.arguments);
      return {
        ...state,
        pending: {
          ...state.pending,
          [callId]: {
            title: typeof args?.title === "string" ? args.title : "",
            yamlSpec: typeof args?.yaml_spec === "string" ? args.yaml_spec : ""
          }
        }
      };
    }
    if (match.event.type === "tool/result") {
      const callId = asRecord(data.message)?.toolCallId;
      if (typeof callId !== "string") return state;
      const pending = state.pending[callId];
      if (pending === void 0) return state;
      const meta = asRecord(data.meta);
      const yamlSpec = pending.yamlSpec !== "" ? pending.yamlSpec : typeof meta?.yaml_spec === "string" ? meta.yaml_spec : "";
      const rest = { ...state.pending };
      delete rest[callId];
      if (yamlSpec === "") return { ...state, pending: rest };
      const fileName = typeof meta?.file_name === "string" ? meta.file_name.replace(/\.drawio$/i, "") : "";
      return {
        ...state,
        pending: rest,
        diagrams: [...state.diagrams, {
          callId,
          title: pending.title !== "" ? pending.title : fileName,
          yamlSpec
        }]
      };
    }
    return state;
  },
  buildLocationData(context, scope) {
    const state = context.state;
    if (scope !== "turn" || state === void 0 || state.diagrams.length === 0) return null;
    return {
      kind: "turn",
      turn: state.turn,
      key: DIAGRAM_TURN_DATA_KEY,
      value: { diagrams: state.diagrams }
    };
  }
};
function selectTurnDiagrams(owner) {
  const value = asRecord(owner.turn.data.get(DIAGRAM_TURN_DATA_KEY));
  const diagrams = value?.diagrams;
  if (!Array.isArray(diagrams)) return [];
  return diagrams;
}

// plugin/src/diagram/TurnPreview.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var styles2 = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "10px"
  },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "8px 10px",
    border: "1px solid var(--dsw-alias-border-l1)",
    borderRadius: "10px",
    background: "var(--dsw-alias-bg-layer-1)"
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "var(--dsw-alias-label-primary)"
  },
  dot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    flex: "0 0 auto",
    background: "var(--dsw-alias-state-success-primary)"
  },
  name: { fontWeight: 600, flex: "0 0 auto" },
  summary: {
    flex: "1 1 auto",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--dsw-alias-label-secondary)"
  },
  button: {
    flex: "0 0 auto",
    border: "1px solid var(--dsw-alias-border-l1)",
    background: "transparent",
    color: "var(--dsw-alias-label-secondary)",
    cursor: "pointer",
    fontSize: "12px",
    lineHeight: 1.4,
    padding: "1px 7px",
    borderRadius: "6px"
  },
  note: { fontSize: "12px", color: "var(--dsw-alias-state-error-primary)" }
};
function TurnDiagramItem({ diagram, labels }) {
  const { model, error } = useDiagramModel(diagram.yamlSpec, diagram.title);
  const onDownload = (0, import_react3.useCallback)(() => {
    if (model === null) return;
    try {
      downloadDrawio(model);
    } catch (cause) {
      console.error("[dsh-diagram] \u56DE\u5408\u9884\u89C8\u5BFC\u51FA .drawio \u5931\u8D25:", cause);
    }
  }, [model]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.item, "data-dsh-diagram-turn-preview": "", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.dot, "aria-hidden": true }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.name, children: labels.title }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: styles2.summary, children: diagram.title !== "" ? diagram.title : model?.title ?? "" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: styles2.button, onClick: onDownload, children: labels.download })
    ] }),
    model !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      DiagramCanvas,
      {
        scene: model.scene,
        fileName: model.title,
        onDownload,
        labels,
        idPrefix: `dsh-diagram-turn-${diagram.callId}`,
        variant: "preview"
      }
    ),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: styles2.note, children: [
      labels.failed,
      ": ",
      error
    ] })
  ] });
}
function TurnPreview({ turn, labels }) {
  const diagrams = selectTurnDiagrams({ turn });
  if (diagrams.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: styles2.wrap, children: diagrams.map((diagram) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TurnDiagramItem, { diagram, labels }, diagram.callId)) });
}

// plugin/src/client.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var NS = "dsh-diagram";
var TOOL_NAMES = ["render_architecture", "yaml_to_drawio"];
var TURN_PREVIEW_ID = "dsh-diagram-turn-preview";
var zh = {
  title: "\u67B6\u6784\u56FE",
  preparing: "\u6B63\u5728\u8BFB\u53D6\u53C2\u6570\u2026",
  running: "\u6E32\u67D3\u4E2D\u2026",
  done: "\u5DF2\u6E32\u67D3",
  failed: "\u6E32\u67D3\u5931\u8D25",
  detail: "\u8BE6\u60C5",
  hide: "\u6536\u8D77",
  inspect: "\u67E5\u770B\u8F68\u8FF9",
  saved: "\u5DF2\u843D\u76D8\u5230",
  reparseFailed: "\u5361\u7247\u65E0\u6CD5\u91CD\u7B97\u5E03\u5C40\uFF08\u5BBF\u4E3B\u5DF2\u901A\u8FC7\u6821\u9A8C\uFF0C\u8FD9\u662F\u9884\u89C8\u4FA7\u7684\u95EE\u9898\uFF09",
  metaMissing: "\u5361\u7247\u8BFB\u4E0D\u5230 YAML\uFF1A\u6587\u4EF6\u7EA7\u5DE5\u5177\u7684 meta \u6CA1\u9001\u8FBE\uFF08\u7ECF run_code \u5D4C\u5957\u8C03\u7528\u65F6\u4F1A\u8FD9\u6837\uFF09\u3002\u5C55\u5F00\u300C\u8BE6\u60C5\u300D\u53EF\u770B\u5BBF\u4E3B\u8FD4\u56DE\u7684\u6458\u8981\u4E0E\u843D\u76D8\u8DEF\u5F84\u3002",
  turnTitle: "\u672C\u56DE\u5408\u67B6\u6784\u56FE",
  fitWidth: "\u9002\u5E94\u5BBD\u5EA6",
  fitAll: "\u6574\u56FE",
  zoomIn: "\u653E\u5927",
  zoomOut: "\u7F29\u5C0F",
  download: "\u4E0B\u8F7D .drawio",
  unit: "\u8282\u70B9",
  link: "\u8FDE\u7EBF"
};
var en = {
  title: "Architecture diagram",
  preparing: "Reading arguments\u2026",
  running: "Rendering\u2026",
  done: "Rendered",
  failed: "Render failed",
  detail: "Details",
  hide: "Hide",
  inspect: "Inspect",
  saved: "Saved to",
  reparseFailed: "The card could not re-derive the layout (the host validated it; this is a preview-side problem)",
  metaMissing: "The card cannot read the YAML: the file-tool meta did not reach the client (this happens for run_code sub-calls). Expand Details for the host summary and saved path.",
  turnTitle: "Diagrams in this turn",
  fitWidth: "Fit width",
  fitAll: "Whole diagram",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  download: "Download .drawio",
  unit: "nodes",
  link: "edges"
};
var CARD_CSS = `
.dsh-diagram-card { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
.dsh-diagram-row { display: flex; align-items: center; min-height: 24px; border-radius: 6px; }
.dsh-diagram-row[data-expandable="true"] { cursor: pointer; }
.dsh-diagram-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dsh-diagram-leading { display: inline-flex; align-items: center; justify-content: center; width: 16px; flex: 0 0 16px; }
.dsh-diagram-dot { width: 8px; height: 8px; border-radius: 50%; }
.dsh-diagram-title { font-size: 13px; font-weight: 400; color: var(--dsw-alias-label-primary);
  transition: color 100ms ease; white-space: nowrap; }
.dsh-diagram-sep { flex: none; width: 2px; height: 2px; border-radius: 1px; margin: 0 8px;
  background: var(--dsw-alias-label-caption); }
.dsh-diagram-summary { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--dsh-content-font-size-secondary, 13px); line-height: 24px;
  color: var(--dsw-alias-label-tertiary); transition: color 100ms ease; }
.dsh-diagram-status { flex: none; margin-left: 8px; font-size: var(--dsh-content-font-size-secondary, 13px); }
.dsh-diagram-chevron { flex: none; display: inline-flex; margin-left: 8px; color: var(--dsw-alias-label-secondary);
  transition: transform 120ms ease; }
.dsh-diagram-chevron[data-open="true"] { transform: rotate(90deg); }
.dsh-diagram-row:hover .dsh-diagram-summary { color: var(--dsw-alias-label-primary); }
.dsh-diagram-body { font-family: var(--ds-font-family-code, ui-monospace, Menlo, Consolas, monospace);
  font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 8px 10px; margin: 0;
  max-height: 260px; overflow: auto; }
.dsh-diagram-note { font-size: var(--dsh-content-font-size-secondary, 13px); color: var(--dsw-alias-label-tertiary); }
.dsh-diagram-saved { font-family: var(--ds-font-family-code, ui-monospace, Menlo, Consolas, monospace); font-size: 11px;
  color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-diagram-inspect { display: inline-flex; align-self: flex-start; align-items: center; gap: 4px;
  margin: 2px 0 0 4px; padding: 2px 8px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 999px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-secondary);
  font-size: 11px; line-height: 16px; cursor: pointer; opacity: 0; transition: opacity 100ms ease; }
.dsh-diagram-card:hover .dsh-diagram-inspect, .dsh-diagram-inspect:focus-visible { opacity: 1; }
.dsh-diagram-inspect:hover { background: var(--dsw-alias-interactive-bg-hover-solid); color: var(--dsw-alias-label-primary); }
.dsh-diagram-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; }
`;
function asRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function flatten(content) {
  return content.map((block) => block.type === "text" && typeof block.text === "string" ? block.text : JSON.stringify(block)).join("\n");
}
function readSlice(block) {
  const settled = typeof block.kind === "string";
  const argsRaw = settled ? block.call?.argsRaw ?? "" : block.phase === "start" ? block.argsRaw ?? "" : null;
  let title = "";
  let argsYaml = "";
  if (argsRaw !== null && argsRaw !== "") {
    try {
      const parsed = JSON.parse(argsRaw);
      if (typeof parsed.title === "string") title = parsed.title;
      if (typeof parsed.yaml_spec === "string") argsYaml = parsed.yaml_spec;
    } catch {
    }
  }
  const meta = settled ? asRecord2(block.meta) : void 0;
  const yamlSpec = argsYaml !== "" ? argsYaml : typeof meta?.yaml_spec === "string" ? meta.yaml_spec : "";
  const savedPath = typeof meta?.saved_path === "string" ? meta.saved_path : null;
  const result = settled ? flatten(block.content ?? []) : null;
  const isError = settled ? block.isError === true : false;
  const state = !settled ? block.phase === "preparing" ? "preparing" : "running" : isError ? "error" : "ok";
  return { argsRaw, yamlSpec, title, result, savedPath, isError, state };
}
function stateColor(state) {
  if (state === "error") return "var(--dsw-alias-state-error-primary)";
  if (state === "ok") return "var(--dsw-alias-state-success-primary)";
  return "var(--dsw-alias-state-idle-primary)";
}
function useLocalDisclosure() {
  const [expanded, setExpanded] = (0, import_react4.useState)(false);
  return { expanded, toggle: () => setExpanded((value) => !value) };
}
function Chevron({ open }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-diagram-chevron", "data-open": open ? "true" : "false", "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "svg",
    {
      width: "12",
      height: "12",
      viewBox: "0 0 12 12",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4.5 2.5 L8 6 L4.5 9.5" })
    }
  ) });
}
function DiagramCard(props) {
  const { callId, block, t, inspect } = props;
  const slice = readSlice(block);
  const { expanded, toggle } = props.useDisclosure();
  const { model, error: modelError } = useDiagramModel(slice.yamlSpec, slice.title);
  const onDownload = (0, import_react4.useCallback)(() => {
    if (model === null) return;
    try {
      downloadDrawio(model);
    } catch (error) {
      console.error("[dsh-diagram] \u5BFC\u51FA .drawio \u5931\u8D25:", error);
    }
  }, [model]);
  const labels = (0, import_react4.useMemo)(() => ({
    fitWidth: t("fitWidth"),
    fitAll: t("fitAll"),
    zoomIn: t("zoomIn"),
    zoomOut: t("zoomOut"),
    download: t("download")
  }), [t]);
  const statusText = slice.state === "preparing" ? t("preparing") : slice.state === "running" ? t("running") : slice.state === "error" ? t("failed") : t("done");
  const counts = model === null ? "" : `${model.layout.nodes.length} ${t("unit")} \xB7 ${model.layout.edges.length} ${t("link")}`;
  const summary = [counts, slice.title !== "" ? slice.title : model?.title ?? ""].filter((part) => part !== "").join(" \xB7 ");
  const details = slice.result ?? slice.argsRaw ?? "";
  const expandable = details !== "";
  const canRender = model !== null;
  const metaMissing = slice.state !== "preparing" && slice.state !== "error" && slice.yamlSpec === "";
  const open = expanded && expandable;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      className: "dsh-diagram-card",
      "data-dsh-diagram-card": props.toolName ?? "render_architecture",
      "data-state": slice.state,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("style", { children: CARD_CSS }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-diagram-visually-hidden", children: statusText }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "div",
          {
            className: "dsh-diagram-row",
            "data-expandable": expandable ? "true" : "false",
            role: expandable ? "button" : void 0,
            tabIndex: expandable ? 0 : void 0,
            "aria-expanded": expandable ? open : void 0,
            onClick: expandable ? toggle : void 0,
            onKeyDown: expandable ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle();
              }
            } : void 0,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-diagram-leading", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-diagram-dot", style: { background: stateColor(slice.state) }, "aria-hidden": true }) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-diagram-title", children: t("title") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-diagram-sep", "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-diagram-summary", children: summary === "" ? statusText : summary }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-diagram-status", style: { color: stateColor(slice.state) }, children: statusText }),
              expandable && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Chevron, { open })
            ]
          }
        ),
        canRender && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          DiagramCanvas,
          {
            scene: model.scene,
            fileName: model.title,
            onDownload,
            labels,
            idPrefix: `dsh-diagram-${callId ?? "call"}`
          }
        ),
        slice.savedPath !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-diagram-saved", title: slice.savedPath, children: [
          t("saved"),
          " ",
          slice.savedPath
        ] }),
        slice.state === "error" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("pre", { className: "dsh-diagram-body", style: { color: "var(--dsw-alias-state-error-primary)" }, children: slice.result ?? "" }),
        metaMissing && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-diagram-note", children: t("metaMissing") }),
        modelError !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-diagram-note", children: [
          t("reparseFailed"),
          ": ",
          modelError
        ] }),
        slice.state !== "error" && model === null && modelError === null && !metaMissing && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-diagram-note", children: statusText }),
        open && details !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("pre", { className: "dsh-diagram-body", children: details }),
        inspect !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", className: "dsh-diagram-inspect", onClick: inspect, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "svg",
            {
              width: "11",
              height: "11",
              viewBox: "0 0 12 12",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.3",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              "aria-hidden": true,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "6", cy: "6", r: "4.2" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M6 3.4 V6 L7.8 7.2" })
              ]
            }
          ),
          t("inspect")
        ] })
      ]
    }
  );
}
function previewLabels(t) {
  return {
    title: t("turnTitle"),
    download: t("download"),
    fitWidth: t("fitWidth"),
    fitAll: t("fitAll"),
    zoomIn: t("zoomIn"),
    zoomOut: t("zoomOut"),
    failed: t("failed")
  };
}
function registerTurnPreview(ctx, t) {
  const labels = previewLabels(t);
  ctx.inject(["uiConversation"], (scoped) => {
    const uiConversation = scoped.get("uiConversation");
    if (uiConversation?.events === void 0) return;
    try {
      uiConversation.events.register(diagramTurnDefinition);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("already registered")) throw error;
    }
    scoped.slots.inject("conversation.chat.turnTail", () => scoped.slots.register(
      { name: "conversation.chat.turnTail", id: TURN_PREVIEW_ID, order: 50, locale: NS },
      (owner) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TurnPreview, { turn: owner.turn, labels })
    ));
  });
}
var client_default = {
  inject: ["slots", "locale"],
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-diagram: dictionaries");
    const t = ctx.locale.bind(NS);
    ctx.slots.inject("tool.call.toolview", function* () {
      for (const key of TOOL_NAMES) {
        yield ctx.slots.register(
          { name: "tool.call.toolview", key, locale: NS },
          (props) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            DiagramCard,
            {
              callId: props.callId,
              toolName: props.toolName,
              block: props.block,
              useDisclosure: props.useDisclosure ?? useLocalDisclosure,
              inspect: props.inspect,
              t
            }
          )
        );
      }
    });
    registerTurnPreview(ctx, t);
  }
};

    })(module, exports, require);
    return module.exports.default ?? module.exports;
  },
});
