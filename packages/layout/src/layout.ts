import type { NormalizedSpec } from '@dsh-diagram/schema';
import { computeUnitLayerings, resolveEdgeFrames, resolveUnitDirections } from './layering';
import { placeSpec } from './placement';
import { routeEdges } from './routing';
import type { LayoutEdge, LayoutGroup, LayoutNode, LayoutResult } from './types';

interface Bounds2 {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function shiftNode(node: LayoutNode, dx: number, dy: number): LayoutNode {
  return { ...node, absX: node.absX + dx, absY: node.absY + dy };
}

function shiftGroup(group: LayoutGroup, dx: number, dy: number): LayoutGroup {
  return { ...group, absX: group.absX + dx, absY: group.absY + dy };
}

function shiftEdge(edge: LayoutEdge, dx: number, dy: number): LayoutEdge {
  return { ...edge, points: edge.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
}

/**
 * 布局编排（design.md §3 五步流水线）：
 *   ① 分层 + 破环 + 肋骨折叠 + 层内引力重心排序（`layering.ts`）
 *   ② 单元方向解析：第 0 层用 `layout.direction`，嵌套层逐层 TB↔LR 交替
 *   ③ `(Rank, Order)` 坐标分配，每个单元按自己的方向映射到物理坐标（`placement.ts`）
 *   ④ 逐边定框架 + 三类型通道正交走线（`routing.ts`）
 *   ⑤ 归一化到非负坐标并给出 bounds
 *
 * 方向交替之后全图没有唯一的虚拟轴，因此坐标映射在 placement 内按单元完成、
 * 走线的框架变换在 routing 内按边完成，编排层只负责把它们串起来。
 */
export async function layoutSpec(spec: NormalizedSpec): Promise<LayoutResult> {
  const layerings = computeUnitLayerings(spec);
  const unitDirections = resolveUnitDirections(spec, layerings);
  const edgeFrames = resolveEdgeFrames(spec, unitDirections);
  const placement = placeSpec(spec, layerings, unitDirections);
  const edges = routeEdges(spec, placement, edgeFrames);

  const nodes: LayoutNode[] = placement.nodes.map((node) => ({
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
    absY: node.absY,
  }));

  const groups: LayoutGroup[] = placement.groups.map((group) => ({
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
    absY: group.absY,
  }));

  const bounds: Bounds2 = {
    minX: 0,
    minY: 0,
    maxX: placement.content.width,
    maxY: placement.content.height,
  };

  const include = (x: number, y: number): void => {
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
      height: Math.ceil(bounds.maxY - bounds.minY),
    },
    maxColumns: placement.maxColumnsUsed,
  };
}