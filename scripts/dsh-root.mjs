/**
 * 定位本机的 dsh —— 供构建 / 类型检查脚本共用（T15）。
 *
 * 为什么要有这个文件：这两个脚本原先各自写死了一个 `F:/gitProject/dsh` 兜底路径，
 * 换电脑（或换盘）后既找不到、也不报清楚原因。现在统一走这里：
 *
 *   1. `DSH_DIAGRAM_DSH_ROOT`（显式指定，优先级最高）
 *   2. 仓库的兄弟目录：`<repo>/../dsh`、`<repo>/../../dsh`
 *   3. 都找不到 → 返回 undefined，由调用方决定是「报错说清楚」还是「可以跳过」
 *
 * 刻意**不**去猜安装版 dsh（`%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\app.asar`）：
 * 那儿只有已构建的运行时产物，`@deepseek-ai/cordis` 连 `.d.ts` 都没随包发布
 * （见 PLAN.md §P2.10 T14），拿它做类型检查会得到一份「看起来在检查、其实缺类型」的假绿。
 * 需要安装版信息的是激活自检，那是 `scripts/verify-plugin-activation.ps1` 的职责。
 *
 * 用法：
 *   import { findDshCheckout, requireDshCheckout } from './dsh-root.mjs'
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 仓库根目录（本文件在 `<repo>/scripts/` 下）。 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 一个目录算不算「已构建的 dsh 检出」：三个脚本要用的类型入口都在。
 * @param root - 候选目录。
 * @returns 是否可用。
 */
function isBuiltCheckout(root) {
  return existsSync(join(root, 'packages', 'core', 'tools', 'lib', 'types', 'index.d.ts'))
}

/**
 * 列出候选检出目录（不判断存在性，便于错误信息里原样展示）。
 * @returns 候选绝对路径，按优先级排列。
 */
export function dshCheckoutCandidates() {
  return [
    process.env.DSH_DIAGRAM_DSH_ROOT,
    resolve(REPO_ROOT, '..', 'dsh'),
    resolve(REPO_ROOT, '..', '..', 'dsh'),
  ].filter((value) => typeof value === 'string' && value.length > 0)
}

/**
 * 找到本机已构建的 dsh 检出目录。
 * @returns 检出根目录；找不到时 undefined。
 */
export function findDshCheckout() {
  for (const candidate of dshCheckoutCandidates()) {
    if (isBuiltCheckout(candidate)) return candidate
  }
  return undefined
}

/**
 * 找到检出目录，找不到就抛出带可操作提示的错误。
 * @param purpose - 出现在错误信息里的用途说明（例如「检查插件两半的类型」）。
 * @returns 检出根目录。
 */
export function requireDshCheckout(purpose) {
  const root = findDshCheckout()
  if (root !== undefined) return root
  throw new Error(
    `找不到本机已构建的 dsh 检出目录（${purpose}需要它的 .d.ts）。已尝试：\n`
    + dshCheckoutCandidates().map((value) => `  - ${value}`).join('\n') + '\n'
    + '可设 DSH_DIAGRAM_DSH_ROOT 指定检出目录，并在该目录里先跑一次构建。',
  )
}
