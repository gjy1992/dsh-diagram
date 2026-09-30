import type { NormalizedSpec } from '@dsh-diagram/schema';
import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs';
import { measureNodeSize } from './sizing';
import {
  ELK_ROOT_ID,
  GROUP_HEADER_HEIGHT,
  GROUP_MIN_HEIGHT,
  GROUP_MIN_WIDTH,
  GROUP_PADDING,
  SPACING_EDGE_EDGE,
  SPACING_EDGE_NODE,
  SPACING_NODE_BETWEEN_LAYERS,
  SPACING_NODE_NODE,
} from './tokens';
import type { LayoutEdge, LayoutGroup, LayoutNode, LayoutPoint, LayoutResult } from './types';

const elk = new ELK();

const edgeId = (index: number): string => `e_${index}`;

function extractPoints(
  edge: ElkExtendedEdge | undefined,
  offset: { dx: number; dy: number },
): LayoutPoint[] {
  const points: LayoutPoint[] = [];
  for (const section of edge?.sections ?? []) {
    points.push({ x: section.startPoint.x + offset.dx, y: section.startPoint.y + offset.dy });
    for (const bend of section.bendPoints ?? []) {
      points.push({ x: bend.x + offset.dx, y: bend.y + offset.dy });
    }
    points.push({ x: section.endPoint.x + offset.dx, y: section.endPoint.y + offset.dy });
  }
  return points;
}

/**
 * ELK 把连线的 section 坐标记在「该连线所属容器」的坐标系里，
 * 而所属容器是两端点所在分组的最近公共祖先（LCA）。
 * 因此跨分组连线是根画布坐标，而同属一个分组的连线是相对该分组的坐标，
 * 这里统一换算回画布绝对坐标。
 */
function resolveLcaOffset(
  chainOf: (nodeId: string) => string[],
  absById: Map<string, { absX: number; absY: number }>,
  fromId: string,
  toId: string,
): { dx: number; dy: number } {
  const fromChain = chainOf(fromId);
  const toChain = chainOf(toId);
  let lcaId: string | undefined;

  for (let index = 0; index < Math.min(fromChain.length, toChain.length); index += 1) {
    if (fromChain[index] !== toChain[index]) {
      break;
    }
    lcaId = fromChain[index];
  }

  if (lcaId === undefined) {
    return { dx: 0, dy: 0 };
  }
  const group = absById.get(lcaId);
  return { dx: group?.absX ?? 0, dy: group?.absY ?? 0 };
}

/**
 * 用 ELK.js 做分层（Sugiyama）布局。
 *
 * 关键点：
 * - 层级：groups 用 parent 单向声明组成树，节点挂在所属分组下；嵌套任意层（已限制 <= 3 层）。
 * - `elk.hierarchyHandling = INCLUDE_CHILDREN` 是硬性要求：默认的 SEPARATE_CHILDREN
 *   会独立布局各分组，导致跨分组边界的连线拿不到折线路径（sections 为空）。
 * - 所有连线声明在根图上，坐标为画布绝对坐标；节点 / 分组坐标为相对父容器，
 *   与 draw.io 嵌套容器的几何语义一致。
 */
export async function layoutSpec(spec: NormalizedSpec): Promise<LayoutResult> {
  const groupById = new Map(spec.groups.map((group) => [group.id, group]));
  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  const groupIds = new Set(groupById.keys());

  const levelCache = new Map<string, number>();
  const levelOf = (groupId: string): number => {
    const cached = levelCache.get(groupId);
    if (cached !== undefined) {
      return cached;
    }
    const parent = groupById.get(groupId)?.parent;
    const level = parent === undefined ? 0 : levelOf(parent) + 1;
    levelCache.set(groupId, level);
    return level;
  };

  const buildNode = (nodeId: string): ElkNode => {
    const node = nodeById.get(nodeId)!;
    const size = measureNodeSize(node);
    return { id: node.id, width: size.width, height: size.height };
  };

  const buildGroup = (groupId: string): ElkNode => {
    const group = groupById.get(groupId)!;
    const children: ElkNode[] = [
      ...spec.nodes.filter((node) => node.group === groupId).map((node) => buildNode(node.id)),
      ...spec.groups.filter((sub) => sub.parent === groupId).map((sub) => buildGroup(sub.id)),
    ];

    return {
      id: group.id,
      children,
      layoutOptions: {
        // 顶部留出组标题的空间
        'elk.padding': `[top=${GROUP_HEADER_HEIGHT},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${GROUP_MIN_WIDTH}, ${GROUP_MIN_HEIGHT})`,
      },
    };
  };

  const rootChildren: ElkNode[] = [
    ...spec.groups.filter((group) => group.parent === undefined).map((group) => buildGroup(group.id)),
    ...spec.nodes.filter((node) => node.group === undefined).map((node) => buildNode(node.id)),
  ];

  const graph: ElkNode = {
    id: ELK_ROOT_ID,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.spacing.nodeNode': String(SPACING_NODE_NODE),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(SPACING_NODE_BETWEEN_LAYERS),
      'elk.layered.spacing.edgeNodeBetweenLayers': String(SPACING_EDGE_NODE),
      'elk.spacing.edgeEdge': String(SPACING_EDGE_EDGE),
      'elk.padding': '[top=0,left=0,bottom=0,right=0]',
    },
    children: rootChildren,
    edges: spec.edges.map((edge, index) => ({
      id: edgeId(index),
      sources: [edge.from],
      targets: [edge.to],
    })),
  };

  const laidOut = await elk.layout(graph);

  const nodes: LayoutNode[] = [];
  const groups: LayoutGroup[] = [];

  const walk = (parent: ElkNode, offsetX: number, offsetY: number): void => {
    for (const child of parent.children ?? []) {
      const x = child.x ?? 0;
      const y = child.y ?? 0;
      const absX = offsetX + x;
      const absY = offsetY + y;
      const width = child.width ?? 0;
      const height = child.height ?? 0;

      if (groupIds.has(child.id)) {
        const group = groupById.get(child.id)!;
        groups.push({
          id: group.id,
          title: group.title,
          variant: group.variant,
          parentId: group.parent,
          level: levelOf(group.id),
          x,
          y,
          width,
          height,
          absX,
          absY,
        });
        walk(child, absX, absY);
      } else {
        const node = nodeById.get(child.id)!;
        nodes.push({
          id: node.id,
          title: node.title,
          desc: node.desc,
          variant: node.variant,
          items: node.items,
          groupId: node.group,
          x,
          y,
          width,
          height,
          absX,
          absY,
        });
      }
    }
  };
  walk(laidOut, 0, 0);

  const laidEdgesById = new Map<string, ElkExtendedEdge>(
    (laidOut.edges ?? []).map((edge) => [edge.id, edge]),
  );

  const containerChainOf = (nodeId: string): string[] => {
    const chain: string[] = [];
    let current = nodeById.get(nodeId)?.group;
    while (current !== undefined) {
      chain.unshift(current);
      current = groupById.get(current)?.parent;
    }
    return chain;
  };
  const groupAbsById = new Map(groups.map((group) => [group.id, group]));

  const edges: LayoutEdge[] = spec.edges.map((edge, index) => {
    const id = edgeId(index);
    const offset = resolveLcaOffset(containerChainOf, groupAbsById, edge.from, edge.to);
    return {
      id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      style: edge.style,
      points: extractPoints(laidEdgesById.get(id), offset),
    };
  });

  let maxX = 0;
  let maxY = 0;
  for (const rect of [...nodes, ...groups]) {
    maxX = Math.max(maxX, rect.absX + rect.width);
    maxY = Math.max(maxY, rect.absY + rect.height);
  }

  return {
    meta: spec.meta,
    nodes,
    groups,
    edges,
    bounds: { width: Math.ceil(maxX), height: Math.ceil(maxY) },
  };
}