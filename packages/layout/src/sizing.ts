import type { NormalizedNode } from '@dsh-diagram/schema';
import { estimateLineCount } from './text-metrics';
import {
  DESC_FONT_SIZE,
  DESC_LINE_HEIGHT,
  ITEM_FONT_SIZE,
  ITEM_LINE_HEIGHT,
  ITEM_SEPARATOR_HEIGHT,
  MIN_NODE_HEIGHT,
  NODE_PADDING_VERTICAL,
  NODE_TEXT_MAX_WIDTH,
  NODE_WIDTH,
  TITLE_FONT_SIZE,
  TITLE_LINE_HEIGHT,
} from './tokens';

export interface NodeSize {
  width: number;
  height: number;
}

/**
 * 节点尺寸预估。
 *
 * 公式来源 PRD §4.1.2（收敛版）：
 *   height = max(48, Padding + TitleLine + (desc ? DescLine : 0) + (items ? 分隔线 : 0) + items.length * ItemLine)
 *
 * 相对 PRD 原文做了两处必要修正（否则 draw.io 渲染时文字溢出卡片，实测确认）：
 *   1. 行高按 draw.io HTML 标签的实际行距取值（标题 24 / 描述 20），而非裸字号；
 *   2. items 区块前补一条 <hr> 分隔线的高度。
 * 同时保留折行补偿：标题 / 描述 / 条目折行时按实际行数累加，避免长文本被裁切。
 */
export function measureNodeSize(node: NormalizedNode): NodeSize {
  const titleLines = estimateLineCount(node.title, TITLE_FONT_SIZE, NODE_TEXT_MAX_WIDTH);
  const descLines = node.desc
    ? estimateLineCount(node.desc, DESC_FONT_SIZE, NODE_TEXT_MAX_WIDTH)
    : 0;
  const itemLines = node.items.reduce(
    (total, item) => total + estimateLineCount(item, ITEM_FONT_SIZE, NODE_TEXT_MAX_WIDTH),
    0,
  );
  const separatorHeight = node.items.length > 0 ? ITEM_SEPARATOR_HEIGHT : 0;

  const contentHeight =
    NODE_PADDING_VERTICAL +
    titleLines * TITLE_LINE_HEIGHT +
    descLines * DESC_LINE_HEIGHT +
    separatorHeight +
    itemLines * ITEM_LINE_HEIGHT;

  return {
    width: NODE_WIDTH,
    height: Math.max(MIN_NODE_HEIGHT, Math.ceil(contentHeight)),
  };
}