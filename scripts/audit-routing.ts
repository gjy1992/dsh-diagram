/**
 * 走线质量审计（PRD §4.1.3 Step 5 / PLAN §6）
 *
 * 对 examples/ 下全部合法样例跑一遍完整布局，程序化断言硬性不变量，并输出观感指标：
 *   - 非正交段数（必须 0）
 *   - 穿节点段数（必须 0）
 *   - 穿「无关分组框」段数（必须 0）
 *   - 连线十字交叉数（尽量 0，按样例汇报）
 *   - 每条边的折数（弯折数 = 非共线拐点数）
 *
 * 用法：pnpm exec tsx scripts/audit-routing.ts [spec.yaml ...]
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateArchSpec } from '@dsh-diagram/schema';
import { layoutSpec } from '@dsh-diagram/layout';
import type { LayoutEdge, LayoutPoint, Rect } from '@dsh-diagram/layout';

const EPS = 0.01;

interface Seg { axis: 'h' | 'v'; coord: number; lo: number; hi: number }

function toSegs(points: LayoutPoint[]): { segs: Seg[]; nonOrtho: number } {
  const segs: Seg[] = [];
  let nonOrtho = 0;
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (Math.abs(a.y - b.y) < EPS) {
      segs.push({ axis: 'h', coord: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
    } else if (Math.abs(a.x - b.x) < EPS) {
      segs.push({ axis: 'v', coord: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
    } else {
      nonOrtho += 1;
    }
  }
  return { segs, nonOrtho };
}

function hitsRect(seg: Seg, rect: Rect, pad: number): boolean {
  const x1 = rect.x - pad, y1 = rect.y - pad;
  const x2 = rect.x + rect.width + pad, y2 = rect.y + rect.height + pad;
  if (seg.axis === 'h') {
    if (seg.coord < y1 || seg.coord > y2) return false;
    return seg.hi >= x1 && seg.lo <= x2;
  }
  if (seg.coord < x1 || seg.coord > x2) return false;
  return seg.hi >= y1 && seg.lo <= y2;
}

function bends(points: LayoutPoint[]): number {
  let count = 0;
  for (let i = 1; i + 1 < points.length; i += 1) {
    const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
    const abH = Math.abs(a.y - b.y) < EPS;
    const bcH = Math.abs(b.y - c.y) < EPS;
    if (abH !== bcH) count += 1;
  }
  return count;
}

function crosses(a: Seg, b: Seg): boolean {
  if (a.axis === b.axis) return false;
  const h = a.axis === 'h' ? a : b;
  const v = a.axis === 'h' ? b : a;
  if (h.coord <= v.lo + 1 || h.coord >= v.hi - 1) return false;
  if (v.coord <= h.lo + 1 || v.coord >= h.hi - 1) return false;
  return true;
}

const args = process.argv.slice(2);
const files = args.length > 0
  ? args
  : (await readdir('examples'))
      .filter((f) => /\.ya?ml$/i.test(f) && !/invalid/i.test(f))
      .sort()
      .map((f) => join('examples', f));

let hardFailures = 0;
const summary: string[] = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const parsed = validateArchSpec(source);
  if (!parsed.ok) {
    console.log('SKIP (invalid) ' + file);
    continue;
  }
  const result = await layoutSpec(parsed.spec);
  const nodeRects = new Map(result.nodes.map((n) => [n.id, { x: n.absX, y: n.absY, width: n.width, height: n.height }]));
  const groupOf = new Map(result.nodes.map((n) => [n.id, n.groupId]));
  const groupRect = new Map(result.groups.map((g) => [g.id, { x: g.absX, y: g.absY, width: g.width, height: g.height }]));
  const groupParent = new Map(result.groups.map((g) => [g.id, g.parentId]));
  const chainOf = (id: string): Set<string> => {
    const chain = new Set<string>([id]);
    let cursor = groupParent.get(id);
    while (cursor !== undefined && !chain.has(cursor)) {
      chain.add(cursor);
      cursor = groupParent.get(cursor);
    }
    return chain;
  };

  let nonOrtho = 0;
  let nodeHits = 0;
  let groupHits = 0;
  let crossingCount = 0;
  let totalBends = 0;
  let maxBends = 0;
  const edgeSegs = new Map<string, Seg[]>();
  const detail: string[] = [];

  for (const edge of result.edges as LayoutEdge[]) {
    const converted = toSegs(edge.points);
    nonOrtho += converted.nonOrtho;
    edgeSegs.set(edge.id, converted.segs);
    const bendCount = bends(edge.points);
    totalBends += bendCount;
    maxBends = Math.max(maxBends, bendCount);
    detail.push('    ' + edge.id + ' ' + edge.from + ' -> ' + edge.to + ' [' + (edge.label ?? '') + '] 折数=' + bendCount + ' 段数=' + converted.segs.length);

    const exemptGroups = new Set<string>();
    for (const nodeId of [edge.from, edge.to]) {
      const g = groupOf.get(nodeId);
      if (g !== undefined) for (const id of chainOf(g)) exemptGroups.add(id);
    }
    for (const seg of converted.segs) {
      for (const [id, rect] of nodeRects) {
        if (id === edge.from || id === edge.to) continue;
        if (hitsRect(seg, rect, 0)) {
          nodeHits += 1;
          detail.push('      ! 穿节点 ' + id + ' @ ' + seg.axis + seg.coord.toFixed(0));
        }
      }
      for (const [id, rect] of groupRect) {
        if (exemptGroups.has(id)) continue;
        if (hitsRect(seg, rect, 0)) {
          groupHits += 1;
          detail.push('      ! 穿无关分组框 ' + id + ' @ ' + seg.axis + seg.coord.toFixed(0));
        }
      }
    }
  }

  const ids = [...edgeSegs.keys()];
  const crossingPairs: string[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = edgeSegs.get(ids[i]!)!;
      const b = edgeSegs.get(ids[j]!)!;
      let hit = false;
      for (const sa of a) for (const sb of b) if (crosses(sa, sb)) hit = true;
      if (hit) {
        crossingCount += 1;
        crossingPairs.push(ids[i] + '×' + ids[j]);
      }
    }
  }

  const bad = nonOrtho + nodeHits + groupHits;
  hardFailures += bad;
  console.log('');
  console.log('=== ' + file + ' ===');
  console.log('  边数=' + result.edges.length + ' 非正交=' + nonOrtho + ' 穿节点=' + nodeHits + ' 穿无关分组框=' + groupHits + ' 交叉对=' + crossingCount + ' 总折数=' + totalBends + ' 最大折数=' + maxBends);
  if (crossingPairs.length > 0) console.log('  交叉: ' + crossingPairs.join(', '));
  console.log(detail.join(String.fromCharCode(10)));
  summary.push(file + ': 非正交=' + nonOrtho + ' 穿节点=' + nodeHits + ' 穿无关组=' + groupHits + ' 交叉=' + crossingCount + ' 总折数=' + totalBends + ' 最大折数=' + maxBends);
}

console.log('');
console.log('=== 汇总 ===');
for (const line of summary) console.log('  ' + line);
console.log(hardFailures === 0 ? 'OK 硬性不变量全部通过（非正交/穿节点/穿无关分组框 = 0）' : 'FAIL 硬性不变量失败 ' + hardFailures + ' 处');
process.exitCode = hardFailures === 0 ? 0 : 1;
