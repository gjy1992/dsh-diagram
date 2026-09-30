import type { LayoutNode } from '@dsh-diagram/layout';
import { DESC_FONT_SIZE, ITEM_FONT_SIZE, TITLE_FONT_SIZE } from '@dsh-diagram/layout';

/**
 * 卡片 HTML value 结构（PRD §4.4.4）：
 *   标题（加粗、居中、14px）
 *   描述（居中、12px，紧随标题下一行）
 *   <hr/>
 *   条目（左对齐、12px）
 */
export function buildNodeLabel(node: LayoutNode): string {
  const parts: string[] = [`<b>${escapeHtml(node.title)}</b>`];

  if (node.desc) {
    parts.push(
      `<font style="font-size:${DESC_FONT_SIZE}px;text-align:center">${escapeHtml(node.desc)}</font>`,
    );
  }

  if (node.items.length > 0) {
    const items = node.items
      .map((item) => `<font style="font-size:${ITEM_FONT_SIZE}px">${escapeHtml(item)}</font>`)
      .join('<br>');
    parts.push('<hr size="1">');
    parts.push(`<div style="text-align:left">${items}</div>`);
  }

  return parts.join('<br>');
}

/** 分组标题：容器已用 align=left / verticalAlign=top，此处只做转义 */
export function buildGroupLabel(title: string): string {
  return escapeHtml(title);
}

export const TITLE_FONT_SIZE_PX = TITLE_FONT_SIZE;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}