import { CANVAS_MARGIN, type LayoutResult } from '@dsh-diagram/layout';
import type { NormalizedSpec } from '@dsh-diagram/schema';
import { toDrawioFileName } from './filename';
import { buildGroupLabel, buildNodeLabel } from './html-value';
import { escapeXmlAttribute, formatNumber } from './serialize';
import { edgeStyle, groupStyle, nodeStyle } from './style-map';

export interface BuildDrawioInput {
  /** 架构图总标题，用于文件名与 diagram 名称 */
  title: string;
  spec: NormalizedSpec;
  layout: LayoutResult;
}

export interface DrawioArtifact {
  fileName: string;
  xml: string;
}

export function buildDrawio(input: BuildDrawioInput): DrawioArtifact {
  const { title, spec, layout } = input;
  const pageWidth = Math.ceil(layout.bounds.width + CANVAS_MARGIN * 2);
  const pageHeight = Math.ceil(layout.bounds.height + CANVAS_MARGIN * 2);
  const diagramName = spec.meta.title ?? title;

  const indent = (depth: number): string => '  '.repeat(depth);
  const lines: string[] = [];

  lines.push(
    `<mxfile host="dsh-diagram" agent="dsh-diagram/0.1.0" type="device">`,
    `${indent(1)}<diagram id="dsh-diagram-page-1" name="${escapeXmlAttribute(diagramName)}">`,
    `${indent(2)}<mxGraphModel dx="0" dy="0" grid="1" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" math="0" shadow="0" pageWidth="${pageWidth}" pageHeight="${pageHeight}" background="#0f172a">`,
    `${indent(3)}<root>`,
    `${indent(4)}<mxCell id="0"/>`,
    `${indent(4)}<mxCell id="1" parent="0"/>`,
  );

  // 分组容器：按层级升序输出，保证父 cell 先于子 cell
  const sortedGroups = [...layout.groups].sort((a, b) => a.level - b.level);
  for (const group of sortedGroups) {
    lines.push(
      `${indent(4)}<mxCell id="${escapeXmlAttribute(group.id)}" value="${escapeXmlAttribute(buildGroupLabel(group.title))}" style="${escapeXmlAttribute(groupStyle(group.variant))}" vertex="1" parent="${escapeXmlAttribute(group.parentId ?? '1')}">`,
      `${indent(5)}<mxGeometry x="${formatNumber(group.x)}" y="${formatNumber(group.y)}" width="${formatNumber(group.width)}" height="${formatNumber(group.height)}" as="geometry"/>`,
      `${indent(4)}</mxCell>`,
    );
  }

  for (const node of layout.nodes) {
    lines.push(
      `${indent(4)}<mxCell id="${escapeXmlAttribute(node.id)}" value="${escapeXmlAttribute(buildNodeLabel(node))}" style="${escapeXmlAttribute(nodeStyle(node.variant))}" vertex="1" parent="${escapeXmlAttribute(node.groupId ?? '1')}">`,
      `${indent(5)}<mxGeometry x="${formatNumber(node.x)}" y="${formatNumber(node.y)}" width="${formatNumber(node.width)}" height="${formatNumber(node.height)}" as="geometry"/>`,
      `${indent(4)}</mxCell>`,
    );
  }

  for (const edge of layout.edges) {
    lines.push(
      `${indent(4)}<mxCell id="${escapeXmlAttribute(edge.id)}" value="${escapeXmlAttribute(edge.label ?? '')}" style="${escapeXmlAttribute(edgeStyle(edge.style))}" edge="1" parent="1" source="${escapeXmlAttribute(edge.from)}" target="${escapeXmlAttribute(edge.to)}">`,
    );

    // mxGraph 的几何点只保存中间拐点，首尾由 source/target 连接点决定
    const waypoints = edge.points.slice(1, -1);
    if (waypoints.length > 0) {
      lines.push(`${indent(5)}<mxGeometry relative="1" as="geometry">`);
      lines.push(`${indent(6)}<Array as="points">`);
      for (const point of waypoints) {
        lines.push(`${indent(7)}<mxPoint x="${formatNumber(point.x)}" y="${formatNumber(point.y)}"/>`);
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
    '',
  );

  return {
    fileName: toDrawioFileName(title),
    xml: lines.join('\n'),
  };
}