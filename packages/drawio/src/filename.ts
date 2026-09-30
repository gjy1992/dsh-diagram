/**
 * 生成 .drawio 文件名：去掉文件系统非法字符，保留中文。
 */
const ILLEGAL_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

export function toDrawioFileName(title: string): string {
  const sanitized = title
    .replace(ILLEGAL_CHARS, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim();

  return `${sanitized.length > 0 ? sanitized : 'architecture'}.drawio`;
}