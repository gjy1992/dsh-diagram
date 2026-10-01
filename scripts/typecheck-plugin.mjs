/**
 * 插件两半的类型检查（T3）。
 *
 * 为什么需要单独一条检查：`plugin/src/**` 是**在宿主之外**开发的代码 —— 它 import 的
 * `@deepseek-ai/dsh-tools`、`@deepseek-ai/cordis`、`react` 都不在本仓库的 node_modules 里
 * （前两者随 dsh 安装解析，react 由浏览器模块表提供），根 tsconfig 也没有 DOM / JSX 设置。
 * 于是「esbuild 能打包」并不等于「类型对」：一个写错的属性名或漏掉的空值判断，
 * 只有到运行时才会暴露。
 *
 * 做法：**生成**一份临时 tsconfig（`tmp/tsconfig.plugin.json`，gitignore），把三个外部依赖
 * 映射到本机 dsh 已构建的 `.d.ts` 上，再用本仓库的 tsc 检查。刻意不把机器相关路径写进仓库 ——
 * 换台机器只要 dsh 检出还在（或设 `DSH_DIAGRAM_DSH_ROOT`）就能跑。
 *
 * 找不到 dsh 检出目录时**直接失败**，不静默跳过：一个会静默跳过的类型检查等于没有。
 *
 * 用法：`pnpm typecheck:plugin`
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'tmp')
const OUT_FILE = join(OUT_DIR, 'tsconfig.plugin.json')
/**
 * 直接跑 TypeScript 的 JS 入口，不走 `node_modules/.bin/tsc.cmd`：
 * Windows 上 `spawnSync` 一个 `.cmd` 而不带 shell 会 EINVAL（Node ≥ 20 的行为），
 * 而带 shell 又要自己处理引号转义 —— 用 `process.execPath + bin/tsc` 最干净。
 */
const TSC_JS = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')

/** 定位 dsh 检出目录：环境变量 → 同盘兄弟目录 → 已知本机位置。 */
function findDshRoot() {
  const candidates = [
    process.env.DSH_DIAGRAM_DSH_ROOT,
    resolve(ROOT, '..', 'dsh'),
    resolve(ROOT, '..', '..', 'dsh'),
    'F:/gitProject/dsh',
  ].filter((value) => typeof value === 'string' && value.length > 0)

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'packages', 'core', 'tools', 'lib', 'types', 'index.d.ts'))) {
      return candidate
    }
  }
  throw new Error(
    '找不到 dsh 检出目录（需要它已构建的 .d.ts 才能检查插件两半）。已尝试：\n'
    + candidates.map((value) => `  - ${value}`).join('\n') + '\n'
    + '可设 DSH_DIAGRAM_DSH_ROOT 指定，或在该检出目录里先跑一次构建。',
  )
}

/** pnpm 存储里的 @types/react 目录（取最高版本）。 */
function findTypesReact(dshRoot) {
  const store = join(dshRoot, 'node_modules', '.pnpm')
  if (!existsSync(store)) throw new Error(`找不到 pnpm 存储：${store}`)
  const packages = readdirSync(store)
    .filter((name) => name.startsWith('@types+react@'))
    .sort()
    .reverse()
  for (const name of packages) {
    const dir = join(store, name, 'node_modules', '@types', 'react')
    if (existsSync(join(dir, 'index.d.ts'))) return dir
  }
  throw new Error(`pnpm 存储里没有 @types/react：${store}`)
}

const dshRoot = findDshRoot()
const dshToolsTypes = join(dshRoot, 'packages', 'core', 'tools', 'lib', 'types', 'index.d.ts')
const cordisTypes = join(dshRoot, 'vendor', 'cordis', 'lib', 'types', 'index.d.ts')
const reactTypes = findTypesReact(dshRoot)

if (!existsSync(cordisTypes)) {
  throw new Error(`找不到 cordis 的已构建类型：${cordisTypes}`)
}
if (!existsSync(TSC_JS)) {
  throw new Error(`找不到 tsc：${TSC_JS}（先在仓库里 pnpm install）`)
}

/**
 * tsc 的 `include` / `paths` 只认正斜杠（Windows 反斜杠会让通配符匹配不到，
 * 报 TS18003 "No inputs were found"），所以生成配置前统一转换。
 */
const posix = (value) => value.split('\\').join('/')

/** 只映射「本机解析不到」的 specifier；本地包用相对 ROOT 的绝对路径，避免被 cwd 影响。 */
const config = {
  compilerOptions: {
    target: 'ES2022',
    // 两半合检：宿主半要 node 类型（node:zlib / Buffer / AbortSignal），
    // 客户端半要 DOM（document / Blob / URL / ResizeObserver / 各 Event）。
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'Bundler',
    jsx: 'react-jsx',
    strict: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    forceConsistentCasingInFileNames: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    // 外部 .d.ts 由 dsh / react 自己维护，不替它们做整体检查；我们只负责自己的代码。
    skipLibCheck: true,
    noEmit: true,
    types: ['node'],
    baseUrl: posix(ROOT),
    paths: {
      '@dsh-diagram/schema': ['packages/schema/src/index.ts'],
      '@dsh-diagram/schema/browser': ['packages/schema/src/browser.ts'],
      '@dsh-diagram/layout': ['packages/layout/src/index.ts'],
      '@dsh-diagram/drawio': ['packages/drawio/src/index.ts'],
      '@dsh-diagram/core': ['packages/core/src/index.ts'],
      '@deepseek-ai/dsh-tools': [posix(dshToolsTypes)],
      '@deepseek-ai/cordis': [posix(cordisTypes)],
      react: [posix(join(reactTypes, 'index.d.ts'))],
      'react/jsx-runtime': [posix(join(reactTypes, 'jsx-runtime.d.ts'))],
      'react/jsx-dev-runtime': [posix(join(reactTypes, 'jsx-dev-runtime.d.ts'))],
    },
  },
  include: [
    posix(join(ROOT, 'plugin', 'src', '**', '*.ts')),
    posix(join(ROOT, 'plugin', 'src', '**', '*.tsx')),
  ],
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
console.log('[typecheck-plugin] dsh 检出：', dshRoot)
console.log('[typecheck-plugin] 生成：', OUT_FILE)

// stdio: 'inherit' —— 不用管道捕获子进程输出（受限模式下管道会 EPERM），也让 tsc 直接着色。
const result = spawnSync(process.execPath, [TSC_JS, '-p', OUT_FILE], { stdio: 'inherit', cwd: ROOT, shell: false })
if (result.error !== undefined) throw result.error
if (result.status !== 0) {
  console.error(`[typecheck-plugin] 类型检查未通过（tsc exit ${String(result.status)}）`)
  process.exit(result.status ?? 1)
}
console.log('[typecheck-plugin] 插件两半类型检查通过')
