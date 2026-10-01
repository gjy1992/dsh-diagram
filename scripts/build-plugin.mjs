/**
 * 打包 plugin/ 的两半 —— dsh-diagram 的可安装 bundle 产物。
 *
 * 本仓库不引入构建依赖：esbuild 按候选位置解析（显式环境变量 → 本仓库 devDependency
 * → 本机 dsh checkout）。这样离线也能出包，将来 `pnpm add -D esbuild` 后自动切到本地。
 *
 * 产物：
 *   plugin/index.js   宿主半（ESM）。`@deepseek-ai/*` 保持 external —— 它们是 dsh 自带包，
 *                     随 dsh 安装解析，必须与运行时同一份实例。
 *   plugin/client.js  客户端半。esbuild 出 CJS 主体，再套一层 `window.__ModuleLoader__.load`
 *                     信封（浏览器侧唯一的注册入口）；`react` / `react/jsx-runtime` 留给
 *                     浏览器模块表，其余（含 @dsh-diagram/* 引擎）全部内联。
 *
 * 用法：node scripts/build-plugin.mjs
 */
import { existsSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_DIR = join(ROOT, 'plugin')
const TSCONFIG = join(ROOT, 'tsconfig.json')

/**
 * pnpm 存储里的 esbuild 包目录（`<root>/node_modules/.pnpm/esbuild@<ver>/node_modules/esbuild`）。
 * pnpm 不会把 esbuild 提升到 `node_modules/esbuild`，所以不能直接按裸名 require 另一个仓库。
 * @param root - 一个 pnpm 工作区根。
 * @returns 按版本升序的候选包目录。
 */
function pnpmEsbuildCandidates(root) {
  const store = join(root, 'node_modules', '.pnpm')
  if (!existsSync(store)) return []
  return readdirSync(store)
    .filter((name) => name.startsWith('esbuild@'))
    .sort()
    .map((name) => join(store, name, 'node_modules', 'esbuild'))
    .filter((dir) => existsSync(dir))
}

/** 解析 esbuild：候选逐个尝试，全部失败时给出可操作的提示。 */
function loadEsbuild() {
  const require = createRequire(import.meta.url)
  const candidates = [
    process.env.DSH_DIAGRAM_ESBUILD,
    'esbuild',
    ...pnpmEsbuildCandidates(ROOT).reverse(),
    ...pnpmEsbuildCandidates(process.env.DSH_DIAGRAM_ESBUILD_ROOT ?? 'F:/gitProject/dsh').reverse(),
  ].filter((value) => typeof value === 'string' && value.length > 0)

  const failures = []
  for (const candidate of candidates) {
    try {
      return { esbuild: require(candidate), source: candidate }
    } catch (error) {
      failures.push(`  - ${candidate}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(
    `未找到 esbuild。已尝试：\n${failures.join('\n')}\n`
    + '可设置 DSH_DIAGRAM_ESBUILD 指向 esbuild 包目录，'
    + '或在仓库内安装：pnpm add -D -w esbuild',
  )
}

const pkg = JSON.parse(await readFile(join(PLUGIN_DIR, 'package.json'), 'utf8'))
if (typeof pkg.name !== 'string' || pkg.name.length === 0) {
  throw new Error('plugin/package.json 缺少 name，无法给客户端产物盖章模块 id')
}
if (!existsSync(TSCONFIG)) {
  throw new Error(`找不到根 tsconfig（${TSCONFIG}）—— @dsh-diagram/* 的 paths 别名由它解析`)
}

const { esbuild, source } = loadEsbuild()
console.log(`[build-plugin] esbuild ← ${source}`)

const shared = {
  bundle: true,
  tsconfig: TSCONFIG,
  legalComments: 'none',
  logLevel: 'warning',
}

// ① 宿主半：ESM，dsh 自带包外置。
await esbuild.build({
  ...shared,
  entryPoints: [join(PLUGIN_DIR, 'src/host.ts')],
  outfile: join(PLUGIN_DIR, 'index.js'),
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: ['@deepseek-ai/*'],
})

// ② 客户端半：CJS 主体（write:false，稍后套信封）。
const client = await esbuild.build({
  ...shared,
  entryPoints: [join(PLUGIN_DIR, 'src/client.tsx')],
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  write: false,
  metafile: true,
})

const body = client.outputFiles[0].text
const envelope = [
  '// 由 scripts/build-plugin.mjs 生成，请勿手改（改 plugin/src/client.tsx）。',
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(pkg.name)},`,
  '  factory: (require) => {',
  '    const module = { exports: {} };',
  '    const exports = module.exports;',
  '    (function (module, exports, require) {',
  body,
  '    })(module, exports, require);',
  '    return module.exports.default ?? module.exports;',
  '  },',
  '});',
  '',
].join('\n')
await writeFile(join(PLUGIN_DIR, 'client.js'), envelope, 'utf8')

const bytes = (text) => `${(Buffer.byteLength(text, 'utf8') / 1024).toFixed(1)} KB`
console.log(`[build-plugin] plugin/index.js   已生成`)
console.log(`[build-plugin] plugin/client.js  已生成（${bytes(body)} 主体 / 共 ${bytes(envelope)}）`)
for (const [file, meta] of Object.entries(client.metafile.outputs)) {
  console.log(`[build-plugin] client inputs: ${Object.keys(meta.inputs).length} 个模块，入口 ${file}`)
}
