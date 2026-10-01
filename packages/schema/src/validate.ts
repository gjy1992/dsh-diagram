import Ajv, { type ErrorObject } from 'ajv';
import { suggestId, type Diagnostic } from './diagnostics';
import { archSpecSchema } from './json-schema';
import { normalizeSpec } from './normalize';
import { parseYaml } from './parse';
import { MAX_GROUP_LEVELS, type ArchSpec, type NormalizedSpec } from './types';

export type ValidationResult =
  | { ok: true; spec: NormalizedSpec }
  | { ok: false; diagnostics: Diagnostic[] };

const ajv = new Ajv({ allErrors: true, strict: false });
const ensureSchemaValid = ajv.compile(archSpecSchema);

/** '/nodes/0/id' -> 'nodes[0].id' */
function toPath(instancePath: string, missingProperty?: string): string {
  const parts = instancePath.split('/').filter((part) => part.length > 0);
  let path = '';
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      path += `[${part}]`;
    } else {
      path += path.length > 0 ? `.${part}` : part;
    }
  }
  if (missingProperty) {
    path += path.length > 0 ? `.${missingProperty}` : missingProperty;
  }
  return path.length > 0 ? path : '(root)';
}

/**
 * Ajv 错误 → 诊断对象。
 *
 * 自愈闭环的质量完全取决于这里的文案：模型只看得到 `path [code] message`，
 * 所以每条必须**自足可行动** —— 枚举列出全部合法值、类型错误点明期望类型，
 * 而不是把 Ajv 的通用措辞（"must be equal to one of the allowed values"）原样透传。
 */
function toDiagnostic(error: ErrorObject): Diagnostic {
  const missing =
    error.keyword === 'required'
      ? (error.params as { missingProperty?: string }).missingProperty
      : undefined;
  const isExtraProperty = error.keyword === 'additionalProperties';
  const extraProperty = isExtraProperty
    ? (error.params as { additionalProperty?: string }).additionalProperty
    : undefined;

  let message: string;
  if (missing !== undefined) {
    message = `missing required property '${missing}'`;
  } else if (isExtraProperty) {
    message = `unknown property '${extraProperty}' is not allowed`;
  } else if (error.keyword === 'enum') {
    const allowed = (error.params as { allowedValues?: unknown[] }).allowedValues ?? [];
    message = `must be one of: ${allowed.map((value) => JSON.stringify(value)).join(' | ')}`;
  } else if (error.keyword === 'type') {
    const expected = (error.params as { type?: string }).type;
    message = expected === undefined ? 'invalid value' : `must be of type ${expected}`;
  } else {
    message = error.message ?? 'invalid value';
  }

  return {
    code: `SCHEMA_${error.keyword.toUpperCase()}`,
    path: toPath(error.instancePath, missing ?? extraProperty),
    message,
  };
}

/** 只接受非空字符串作为 id；其余（缺失、类型错、空串）一律当作"读不出来"。 */
function asId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 引用级检查所需的最小视图：每个条目只保留「能读出来的合法 id」与它在原数组中的下标。
 *
 * 兼容两种来源：Ajv 通过之后的 `NormalizedSpec`（id 全都合法），以及结构校验失败时的
 * 原始 `unknown` 输入（这时一切都要防御式读取）。
 */
interface RefView {
  readonly groupIds: readonly (string | undefined)[];
  readonly groupParents: readonly (string | undefined)[];
  readonly nodeIds: readonly (string | undefined)[];
  readonly nodeGroups: readonly (string | undefined)[];
  readonly edges: readonly {
    readonly index: number;
    readonly from?: string;
    readonly to?: string;
  }[];
}

/** 从任意输入里尽力抽取引用级检查能用的字段，绝不抛异常。 */
function refViewOf(raw: unknown): RefView {
  const root = isRecord(raw) ? raw : {};
  const groups = Array.isArray(root.groups) ? root.groups : [];
  const nodes = Array.isArray(root.nodes) ? root.nodes : [];
  const edges = Array.isArray(root.edges) ? root.edges : [];
  const read = (item: unknown, key: string): string | undefined =>
    isRecord(item) ? asId(item[key]) : undefined;

  return {
    groupIds: groups.map((item) => read(item, 'id')),
    groupParents: groups.map((item) => read(item, 'parent')),
    nodeIds: nodes.map((item) => read(item, 'id')),
    nodeGroups: nodes.map((item) => read(item, 'group')),
    edges: edges.map((item, index) => ({ index, from: read(item, 'from'), to: read(item, 'to') })),
  };
}

/**
 * 引用级检查（ID 唯一性 / 互不冲突、外键存在、分组嵌套的 parent 自引用·成环·深度）。
 *
 * 这是**两条路径共用的唯一实现**：
 * - 结构校验通过时，它对 `NormalizedSpec` 跑一遍，全绿才算 ok；
 * - 结构校验失败时，它对原始输入再跑一遍，让模型**一轮就能拿到两类错误**。
 *   这正是 PRD §4.3 想要的：先修结构、再修引用、再修层级会让模型白白多跑两轮。
 *
 * 防御式契约：读不出合法 id 的条目一律跳过（结构问题已由 Ajv 报过），
 * 因此这条合并路径不引入新的失败模式，也不会重复报同一个问题。
 *
 * @param view - 引用级字段的最小视图，见 {@link refViewOf}。
 * @returns 诊断数组（顺序与历史实现一致：重复 → 冲突 → 外键 → 层级）。
 */
function collectReferenceDiagnostics(view: RefView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const groupIds = view.groupIds.filter((id): id is string => id !== undefined);
  const nodeIds = view.nodeIds.filter((id): id is string => id !== undefined);
  const groupIdSet = new Set(groupIds);
  const nodeIdSet = new Set(nodeIds);

  // ① ID 唯一性（groups / nodes 各自唯一，且两者之间也不得冲突：
  //    draw.io 的 cell id 必须全局唯一）
  reportDuplicates(view.groupIds, 'groups', diagnostics);
  reportDuplicates(view.nodeIds, 'nodes', diagnostics);
  for (const [index, id] of view.nodeIds.entries()) {
    if (id !== undefined && groupIdSet.has(id)) {
      diagnostics.push({
        code: 'ID_CONFLICT',
        path: `nodes[${index}].id`,
        message: `node id '${id}' conflicts with a group id; ids must be unique across nodes and groups.`,
      });
    }
  }

  // ② 外键引用
  for (const [index, group] of view.nodeGroups.entries()) {
    const nodeId = view.nodeIds[index];
    // 节点自己没 id 时不报这条：Ajv 已经在同一位置报过缺 id，再报一次只是噪音。
    if (group === undefined || nodeId === undefined) continue;
    if (!groupIdSet.has(group)) {
      diagnostics.push({
        code: 'NODE_GROUP_UNKNOWN',
        path: `nodes[${index}].group`,
        message: `group '${group}' referenced by node '${nodeId}' is not defined in groups list.`,
        hint: suggestId(group, groupIds),
      });
    }
  }
  for (const edge of view.edges) {
    if (edge.from !== undefined && !nodeIdSet.has(edge.from)) {
      diagnostics.push({
        code: 'EDGE_SOURCE_UNKNOWN',
        path: `edges[${edge.index}].from`,
        message: `edge source '${edge.from}' is not defined in nodes list.`,
        hint: suggestId(edge.from, nodeIds),
      });
    }
    if (edge.to !== undefined && !nodeIdSet.has(edge.to)) {
      diagnostics.push({
        code: 'EDGE_TARGET_UNKNOWN',
        path: `edges[${edge.index}].to`,
        message: `edge target '${edge.to}' is not defined in nodes list.`,
        hint: suggestId(edge.to, nodeIds),
      });
    }
  }

  // ③ 分组嵌套层级：parent 外键 / 自引用 / 成环 / 深度上限
  const parentById = new Map<string, string | undefined>();
  for (const [index, id] of view.groupIds.entries()) {
    if (id !== undefined) parentById.set(id, view.groupParents[index]);
  }
  for (const [index, id] of view.groupIds.entries()) {
    if (id === undefined) continue;
    const parentId = view.groupParents[index];
    if (parentId === undefined) continue;
    if (parentId === id) {
      diagnostics.push({
        code: 'GROUP_SELF_PARENT',
        path: `groups[${index}].parent`,
        message: `group '${id}' cannot be its own parent.`,
      });
      continue;
    }
    if (!groupIdSet.has(parentId)) {
      diagnostics.push({
        code: 'GROUP_PARENT_UNKNOWN',
        path: `groups[${index}].parent`,
        message: `parent group '${parentId}' referenced by group '${id}' is not defined in groups list.`,
        hint: suggestId(parentId, groupIds),
      });
      continue;
    }

    const chain = [id];
    let cursor: string | undefined = parentId;
    while (cursor !== undefined) {
      if (chain.includes(cursor)) {
        diagnostics.push({
          code: 'GROUP_PARENT_CYCLE',
          path: `groups[${index}].parent`,
          message: `group parent chain is circular: ${[...chain, cursor].join(' -> ')}.`,
        });
        break;
      }
      chain.push(cursor);
      cursor = parentById.get(cursor);
    }

    if (chain.length > MAX_GROUP_LEVELS) {
      diagnostics.push({
        code: 'GROUP_DEPTH_EXCEEDED',
        path: `groups[${index}].parent`,
        message: `group '${id}' is nested ${chain.length} levels deep, which exceeds the maximum of ${MAX_GROUP_LEVELS}.`,
      });
    }
  }

  return diagnostics;
}

/**
 * 解析 + 校验 YAML 规格。
 * 依次执行：结构校验 → 缺省值填充 → ID 唯一性 → 外键引用 → 分组嵌套层级。
 *
 * 结构校验失败时**不再短路**：引用级检查会对着原始输入再跑一遍，
 * 于是模型一轮就能拿到「结构 + 引用 + 层级」三类问题（见 collectReferenceDiagnostics）。
 */
export function validateArchSpec(source: string | unknown): ValidationResult {
  let raw: unknown = source;
  if (typeof source === 'string') {
    const parsed = parseYaml(source);
    if (!parsed.ok) {
      return { ok: false, diagnostics: parsed.diagnostics };
    }
    raw = parsed.value;
  }

  if (!ensureSchemaValid(raw)) {
    const diagnostics = (ensureSchemaValid.errors ?? []).map(toDiagnostic);
    diagnostics.push(...collectReferenceDiagnostics(refViewOf(raw)));
    return { ok: false, diagnostics };
  }

  const ast = raw as ArchSpec;
  const spec = normalizeSpec(ast);
  const diagnostics = collectReferenceDiagnostics(refViewOf(spec));
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  return { ok: true, spec };
}

function reportDuplicates(
  ids: readonly (string | undefined)[],
  collection: string,
  diagnostics: Diagnostic[],
): void {
  const seen = new Set<string>();
  for (const [index, id] of ids.entries()) {
    if (id === undefined) continue;
    if (seen.has(id)) {
      diagnostics.push({
        code: 'ID_DUPLICATE',
        path: `${collection}[${index}].id`,
        message: `duplicate id '${id}' found in ${collection}.`,
      });
    }
    seen.add(id);
  }
}
