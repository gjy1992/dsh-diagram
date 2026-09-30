import type { EdgeStyle, GroupVariant, NodeVariant } from '@dsh-diagram/schema';

export interface NodeTheme {
  fillColor: string;
  strokeColor: string;
  fontColor: string;
}

export interface GroupTheme {
  strokeColor: string;
  fillColor: string;
  dashed: string;
}

/** 节点卡片配色（PRD §4.4.3） */
export const NODE_THEME: Record<NodeVariant, NodeTheme> = {
  default: { fillColor: '#1e293b', strokeColor: '#334155', fontColor: '#e2e8f0' },
  primary: { fillColor: '#0c4a6e', strokeColor: '#38bdf8', fontColor: '#e0f2fe' },
  danger: { fillColor: '#4c1d24', strokeColor: '#f87171', fontColor: '#fee2e2' },
  warning: { fillColor: '#4a3712', strokeColor: '#fbbf24', fontColor: '#fef3c7' },
  muted: { fillColor: '#1e293b', strokeColor: '#334155', fontColor: '#64748b' },
};

/** 分组容器配色（PRD §4.4.3） */
export const GROUP_THEME: Record<GroupVariant, GroupTheme> = {
  dashed: { strokeColor: '#334155', fillColor: 'none', dashed: '1' },
  filled: { strokeColor: '#334155', fillColor: '#111c33', dashed: '0' },
};

/**
 * 连线基础样式。
 * `labelBackgroundColor` 是必需的：draw.io 的连线标签默认是白底，
 * 而深色主题下文字是浅色 #cbd5e1，不设置会导致标签几乎不可读（实测确认）。
 */
export const EDGE_BASE_STYLE =
  'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#64748b;fontColor=#cbd5e1;labelBackgroundColor=#152238;';

export const EDGE_STYLE_SUFFIX: Record<EdgeStyle, string> = {
  solid: 'endArrow=classic;endFill=1;',
  dashed: 'endArrow=classic;endFill=1;dashed=1;dashPattern=8 4;',
  bidirectional: 'startArrow=classic;startFill=1;endArrow=classic;endFill=1;',
};

/** 卡片单元格样式：标题走 <b>，故此处不加粗 */
export function nodeStyle(variant: NodeVariant): string {
  const theme = NODE_THEME[variant];
  return [
    'rounded=1',
    'whiteSpace=wrap',
    'html=1',
    `fillColor=${theme.fillColor}`,
    `strokeColor=${theme.strokeColor}`,
    `fontColor=${theme.fontColor}`,
    'fontSize=14',
    'align=center',
    'verticalAlign=top',
    'spacingTop=6',
  ].join(';') + ';';
}

export function groupStyle(variant: GroupVariant): string {
  const theme = GROUP_THEME[variant];
  return [
    'container=1',
    'collapsible=0',
    'rounded=1',
    `dashed=${theme.dashed}`,
    `strokeColor=${theme.strokeColor}`,
    `fillColor=${theme.fillColor}`,
    'fontColor=#94a3b8',
    'fontSize=12',
    'align=left',
    'verticalAlign=top',
    'spacingLeft=10',
    'spacingTop=5',
  ].join(';') + ';';
}

export function edgeStyle(style: EdgeStyle): string {
  return `${EDGE_BASE_STYLE}${EDGE_STYLE_SUFFIX[style]}`;
}