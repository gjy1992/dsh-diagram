import Ajv, { type ErrorObject } from 'ajv';
import { suggestId, type Diagnostic } from './diagnostics';
import { archSpecSchema } from './json-schema';
import { parseYaml } from './parse';
import {
  MAX_GROUP_LEVELS,
  type ArchSpec,
  type EdgeStyle,
  type GroupVariant,
  type MetaSpec,
  type NodeVariant,
  type NormalizedEdge,
  type NormalizedGroup,
  type NormalizedNode,
  type NormalizedSpec,
} from './types';

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

function toDiagnostic(error: ErrorObject): Diagnostic {
  const missing =
    error.keyword === 'required'
      ? (error.params as { missingProperty?: string }).missingProperty
      : undefined;
  const isExtraProperty = error.keyword === 'additionalProperties';
  const extraProperty = isExtraProperty
    ? (error.params as { additionalProperty?: string }).additionalProperty
    : undefined;

  return {
    code: `SCHEMA_${error.keyword.toUpperCase()}`,
    path: toPath(error.instancePath, missing ?? extraProperty),
    message: missing
      ? `missing required property '${missing}'`
      : isExtraProperty
        ? `unknown property '${extraProperty}' is not allowed`
        : (error.message ?? 'invalid value'),
  };
}

/**
 * 解析 + 校验 YAML 规格。
 * 依次执行：结构校验 → 缺省值填充 → ID 唯一性 → 外键引用 → 分组嵌套层级。
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
    return { ok: false, diagnostics };
  }

  const ast = raw as ArchSpec;
  const diagnostics: Diagnostic[] = [];
  const spec = normalize(ast);
  const groupIds = spec.groups.map((group) => group.id);
  const nodeIds = spec.nodes.map((node) => node.id);
  const groupIdSet = new Set(groupIds);

  // ① ID 唯一性（groups / nodes 各自唯一，且两者之间也不得冲突：
  //    draw.io 的 cell id 必须全局唯一）
  reportDuplicates(groupIds, 'groups', diagnostics);
  reportDuplicates(nodeIds, 'nodes', diagnostics);
  for (const node of spec.nodes) {
    if (groupIdSet.has(node.id)) {
      diagnostics.push({
        code: 'ID_CONFLICT',
        path: `nodes[${nodeIds.indexOf(node.id)}].id`,
        message: `node id '${node.id}' conflicts with a group id; ids must be unique across nodes and groups.`,
      });
    }
  }

  // ② 外键引用
  for (const [index, node] of spec.nodes.entries()) {
    if (node.group !== undefined && !groupIdSet.has(node.group)) {
      diagnostics.push({
        code: 'NODE_GROUP_UNKNOWN',
        path: `nodes[${index}].group`,
        message: `group '${node.group}' referenced by node '${node.id}' is not defined in groups list.`,
        hint: suggestId(node.group, groupIds),
      });
    }
  }
  for (const [index, edge] of spec.edges.entries()) {
    if (!nodeIds.includes(edge.from)) {
      diagnostics.push({
        code: 'EDGE_SOURCE_UNKNOWN',
        path: `edges[${index}].from`,
        message: `edge source '${edge.from}' is not defined in nodes list.`,
        hint: suggestId(edge.from, nodeIds),
      });
    }
    if (!nodeIds.includes(edge.to)) {
      diagnostics.push({
        code: 'EDGE_TARGET_UNKNOWN',
        path: `edges[${index}].to`,
        message: `edge target '${edge.to}' is not defined in nodes list.`,
        hint: suggestId(edge.to, nodeIds),
      });
    }
  }

  // ③ 分组嵌套层级：parent 外键 / 自引用 / 成环 / 深度上限
  const groupById = new Map(spec.groups.map((group) => [group.id, group]));
  for (const [index, group] of spec.groups.entries()) {
    const parentId = group.parent;
    if (parentId === undefined) {
      continue;
    }
    if (parentId === group.id) {
      diagnostics.push({
        code: 'GROUP_SELF_PARENT',
        path: `groups[${index}].parent`,
        message: `group '${group.id}' cannot be its own parent.`,
      });
      continue;
    }
    if (!groupIdSet.has(parentId)) {
      diagnostics.push({
        code: 'GROUP_PARENT_UNKNOWN',
        path: `groups[${index}].parent`,
        message: `parent group '${parentId}' referenced by group '${group.id}' is not defined in groups list.`,
        hint: suggestId(parentId, groupIds),
      });
      continue;
    }

    const chain = [group.id];
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
      cursor = groupById.get(cursor)?.parent;
    }

    if (chain.length > MAX_GROUP_LEVELS) {
      diagnostics.push({
        code: 'GROUP_DEPTH_EXCEEDED',
        path: `groups[${index}].parent`,
        message: `group '${group.id}' is nested ${chain.length} levels deep, which exceeds the maximum of ${MAX_GROUP_LEVELS}.`,
      });
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  return { ok: true, spec };
}

function reportDuplicates(ids: string[], collection: string, diagnostics: Diagnostic[]): void {
  const seen = new Set<string>();
  for (const [index, id] of ids.entries()) {
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

/** 结构校验通过后填缺省值，产出规范形态 */
function normalize(ast: ArchSpec): NormalizedSpec {
  const groups: NormalizedGroup[] = (ast.groups ?? []).map((group) => ({
    id: group.id,
    title: group.title,
    variant: (group.variant ?? 'dashed') as GroupVariant,
    parent: group.parent,
  }));

  const nodes: NormalizedNode[] = ast.nodes.map((node) => ({
    id: node.id,
    title: node.title,
    group: node.group,
    desc: node.desc,
    variant: (node.variant ?? 'default') as NodeVariant,
    items: node.items ?? [],
  }));

  const edges: NormalizedEdge[] = ast.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    label: edge.label,
    style: (edge.style ?? 'solid') as EdgeStyle,
  }));

  const meta: MetaSpec = ast.meta ?? {};

  return {
    version: ast.version ?? '1.0',
    meta,
    groups,
    nodes,
    edges,
  };
}