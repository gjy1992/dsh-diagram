/** XML 属性值转义 */
export function escapeXmlAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r?\n/g, '&#10;');
}

/** 坐标输出：最多保留两位小数，去掉多余的 .0 */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}