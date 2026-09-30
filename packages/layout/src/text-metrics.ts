/** 粗略文本量算：CJK / 全角字符按 1em 计，其余按 0.55em 计 */
const WIDE_CHAR_WIDTH_RATIO = 1;
const NARROW_CHAR_WIDTH_RATIO = 0.55;
const WIDE_CHAR_THRESHOLD = 0x2e80;

function isWideChar(codePoint: number): boolean {
  return codePoint >= WIDE_CHAR_THRESHOLD;
}

/** 估算一行文本的像素宽度 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    width += (isWideChar(codePoint) ? WIDE_CHAR_WIDTH_RATIO : NARROW_CHAR_WIDTH_RATIO) * fontSize;
  }
  return width;
}

/**
 * 估算文本在给定宽度下占用的行数。
 * 显式换行符按硬换行处理；单段内部按估算宽度折行。
 */
export function estimateLineCount(text: string, fontSize: number, maxWidth: number): number {
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