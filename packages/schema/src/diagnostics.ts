/**
 * 结构化诊断对象。
 *
 * 设计目标：JSON.stringify 后即为可回传 LLM 的 ToolError 载荷（Phase 2 直接复用）。
 */
export interface Diagnostic {
  /** 机器可判定的错误码，如 EDGE_SOURCE_UNKNOWN */
  code: string;
  /** 出错位置，如 edges[2].from */
  path: string;
  /** 主描述，英文，便于 LLM 理解 */
  message: string;
  /** 可选建议，如 Did you mean 'single_player'? */
  hint?: string;
}

/** 渲染为 PRD §4.3 约定的人类可读文案 */
export function formatDiagnostic(diagnostic: Diagnostic): string {
  const hint = diagnostic.hint ? ` ${diagnostic.hint}` : '';
  return `ValidationError: ${diagnostic.message}${hint}`;
}

/** 计算 Levenshtein 编辑距离 */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);

  for (let i = 1; i < rows; i += 1) {
    const current = [i, ...Array<number>(cols - 1).fill(0)];
    for (let j = 1; j < cols; j += 1) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, substitution);
    }
    previous = current;
  }

  return previous[cols - 1]!;
}

/**
 * 从候选 ID 集合里挑出最可能的那个，生成 did-you-mean 建议。
 * 优先级：忽略大小写的完全一致 > 编辑距离 <= 2 的最近邻。
 */
export function suggestId(unknown: string, candidates: Iterable<string>): string | undefined {
  const pool = [...candidates];
  if (pool.length === 0) {
    return undefined;
  }

  const lower = unknown.toLowerCase();
  const caseInsensitive = pool.find((candidate) => candidate.toLowerCase() === lower);
  if (caseInsensitive && caseInsensitive !== unknown) {
    return `Did you mean '${caseInsensitive}'?`;
  }

  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of pool) {
    const distance = editDistance(unknown, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  if (best !== undefined && bestDistance <= 2) {
    return `Did you mean '${best}'?`;
  }

  return undefined;
}