/**
 * 结构化：把「通过结构校验」的原始形态填上全部缺省值，产出布局 / 导出 / 渲染共用的规范形态。
 *
 * 刻意与 `validate.ts` 分开，且**不依赖 Ajv**：浏览器半（插件卡片）需要在没有 JSON Schema
 * 校验器的前提下跑同一条 `parse → normalize → layout → render` 管线，所以这里必须是
 * 纯函数、零重依赖。宿主侧 `validateArchSpec()` 复用它，保证两侧填缺省值的口径不会漂移。
 *
 * 注意：本模块假定 `ast` 已通过结构校验（`nodes` / `edges` 必为数组）。浏览器半调用前
 * 需自行做形状守卫（见 plugin/src/client.tsx 的 `parseSpec`）。
 */
import type {
  ArchSpec,
  EdgeStyle,
  GroupVariant,
  MetaSpec,
  NodeVariant,
  NormalizedEdge,
  NormalizedGroup,
  NormalizedNode,
  NormalizedSpec,
} from './types';

/** 填缺省值：group.variant=dashed / node.variant=default / edge.style=solid / layout 三项 */
export function normalizeSpec(ast: ArchSpec): NormalizedSpec {
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
  const maxColumns = ast.layout?.max_columns ?? 'auto';
  const direction = ast.layout?.direction ?? 'TB';
  const innerDirection = ast.layout?.inner_direction ?? 'auto';

  return {
    version: ast.version ?? '1.0',
    meta,
    layout: { maxColumns, direction, innerDirection },
    groups,
    nodes,
    edges,
  };
}
