/**
 * 回合末尾预览（T6）折叠逻辑的确定性断言。
 *
 * 为什么需要它：T6 的真相分两半 ——
 *   ① **折叠逻辑**（`match` / `start` / `update` / `buildLocationData`）是我们自己的代码，
 *      可以用合成事件确定性地断言，不该靠"刷新页面看看有没有东西"；
 *   ② **宿主是否把事件喂进来**（conversation 层对已发生历史的处理时机）只能用真实回合验证。
 * 这个脚本负责 ①，让 ② 出问题时能立刻排除掉折叠逻辑本身。
 *
 * 用法：`pnpm exec tsx scripts/audit-turn-fold.ts`
 */
import {
  DIAGRAM_TURN_DATA_KEY,
  diagramTurnDefinition,
} from '../plugin/src/diagram/turn-diagrams'

interface TurnState {
  turn: number
  pending: Record<string, { title: string; yamlSpec: string }>
  diagrams: readonly { callId: string; title: string; yamlSpec: string }[]
}

const failures: string[] = []

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✅ ${label}`)
  } else {
    console.log(`  ❌ ${label}${detail === '' ? '' : ` — ${detail}`}`)
    failures.push(label)
  }
}

/** 把一串合成事件喂进定义，返回最终 state 与 buildLocationData 的结果。 */
function fold(events: readonly { type: string; data: unknown }[]): {
  state: TurnState
  location: unknown
} {
  let context: { state?: unknown } = {}
  for (const event of events) {
    const match = diagramTurnDefinition.match(event as never)
    if (match === null) continue
    context = match.role === 'start'
      ? { state: diagramTurnDefinition.start(context as never, { event } as never) }
      : { state: diagramTurnDefinition.update(context as never, { event } as never) }
  }
  return {
    state: context.state as TurnState,
    location: diagramTurnDefinition.buildLocationData(context as never, 'turn'),
  }
}

const callEvent = (callId: string, name: string, args: unknown) => ({
  type: 'tool/call',
  data: { turn: 7, step: 2, callId, name, arguments: JSON.stringify(args) },
})
const resultEvent = (callId: string, meta?: unknown) => ({
  type: 'tool/result',
  data: { turn: 7, step: 2, message: { role: 'tool', toolCallId: callId }, ...(meta === undefined ? {} : { meta }) },
})

console.log('T6 折叠逻辑断言：')

// ① 内联工具：YAML 来自调用参数
{
  const { state, location } = fold([
    { type: 'turn/start', data: { turn: 7 } },
    callEvent('c1', 'render_architecture', { title: '架构甲', yaml_spec: 'nodes: []\nedges: []' }),
    resultEvent('c1'),
  ])
  check('内联工具被收录', state.diagrams.length === 1, JSON.stringify(state.diagrams))
  check('标题来自调用参数', state.diagrams[0]?.title === '架构甲')
  check('配对后清空 pending', Object.keys(state.pending).length === 0)
  const value = (location as { value?: { diagrams?: unknown[] } } | null)?.value
  check('buildLocationData 挂上 turn 作用域', (location as { key?: string } | null)?.key === DIAGRAM_TURN_DATA_KEY && Array.isArray(value?.diagrams))
}

// ② 文件级工具：YAML 只在结果 meta 里，标题回落 file_name 且去掉 .drawio
{
  const { state } = fold([
    { type: 'turn/start', data: { turn: 8 } },
    callEvent('c2', 'yaml_to_drawio', { path: 'examples/03.yaml' }),
    resultEvent('c2', { yaml_spec: 'nodes: []\nedges: []', file_name: '订单编排.drawio' }),
  ])
  check('文件级工具从 meta 取到 YAML', state.diagrams.length === 1)
  check('标题回落 file_name 且去扩展名', state.diagrams[0]?.title === '订单编排', state.diagrams[0]?.title)
}

// ③ 失败调用（没有 YAML）不收录
{
  const { state, location } = fold([
    { type: 'turn/start', data: { turn: 9 } },
    callEvent('c3', 'render_architecture', { title: '坏的' }),
    resultEvent('c3'),
  ])
  check('拿不到 YAML 就不收录', state.diagrams.length === 0)
  check('无产出时 buildLocationData 返回 null', location === null)
}

// ④ 无关工具被忽略
{
  const { state } = fold([
    { type: 'turn/start', data: { turn: 10 } },
    callEvent('c4', 'bash', { command: 'ls' }),
    resultEvent('c4', { yaml_spec: 'nodes: []\nedges: []' }),
  ])
  check('无关工具不收录也不留 pending', state.diagrams.length === 0 && Object.keys(state.pending).length === 0)
}

// ⑤ 同一回合多张图按序累积，且只认本回合
{
  const { state } = fold([
    { type: 'turn/start', data: { turn: 11 } },
    callEvent('c5', 'render_architecture', { title: 'A', yaml_spec: 'nodes: []\nedges: []' }),
    resultEvent('c5'),
    callEvent('c6', 'render_architecture', { title: 'B', yaml_spec: 'nodes: []\nedges: []' }),
    resultEvent('c6'),
    { type: 'turn/start', data: { turn: 12 } },
    callEvent('c7', 'render_architecture', { title: 'C', yaml_spec: 'nodes: []\nedges: []' }),
    resultEvent('c7'),
  ])
  check('第二回合只算自己的图', state.turn === 12 && state.diagrams.length === 1 && state.diagrams[0]?.title === 'C')
}

// ⑥ 坏参数（非法 JSON）不炸
{
  const { state } = fold([
    { type: 'turn/start', data: { turn: 13 } },
    { type: 'tool/call', data: { turn: 13, step: 1, callId: 'c8', name: 'render_architecture', arguments: '{半截' } },
    resultEvent('c8'),
  ])
  check('非法 arguments 不抛且不收录', state.diagrams.length === 0)
}

if (failures.length > 0) {
  console.error(`\nT6 折叠逻辑：${failures.length} 项未通过`)
  process.exit(1)
}
console.log('\nT6 折叠逻辑全部通过')
