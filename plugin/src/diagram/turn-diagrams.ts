/**
 * 回合末尾预览（T6）：把一次对话回合里**我们自己的**工具调用，折成「本回合产出了哪几张架构图」。
 *
 * ## 为什么需要这条数据链
 *
 * dsh 把工具调用渲染在 ui-chat 的 step 过程折叠行里（locale key
 * `message.stepProcess.done.tools` =「已调用工具」），回合结束后默认收起 —— 卡片跟着一起看不见。
 * 官方给「回合末尾再挂一块」的槽位是 `conversation.chat.turnTail`（list 槽），但它拿到的是
 * `TurnLocation`（本回合的坐标），**不直接给工具结果**。
 *
 * 所以按你 profile 里现成跑着的 `dsh-univer-office` 的 `univer-turn-preview` 同款做法：
 *
 *   ① `uiConversation.events.register(definition)` 注册一个 conversation 事件定义，
 *      匹配本回合的 `turn/start` + `tool/call` / `tool/result`，把结果折进 `TurnLocation.data`；
 *   ② `turnTail` 条目用 `owner.turn.data.get(KEY)` 读出来渲染。
 *
 * ## 收录规则（与工具契约一一对应）
 *
 * 读不到内容就**不收录** —— 宁可不显示，也不显示一张空白卡片：
 *   - `render_architecture`：YAML 就在 `tool/call.arguments.yaml_spec`；
 *   - `yaml_to_drawio`：参数只有 `path`，YAML 由宿主经
 *     `presentationMeta → tool/result.meta.yaml_spec` 投递（零模型上下文开销）；
 *   - 失败的调用通常拿不到 YAML（校验失败没有 spec；投影器只在成功结果上跑），因而不收录。
 *
 * 刻意不 import dsh 客户端包的类型：本插件的类型检查（`pnpm typecheck:plugin`）只映射了
 * cordis / dsh-tools / react，客户端槽位类型在这里以**最小结构**声明（与真实契约一致的字段），
 * 这样检查既不瞎眼、也不必把整套 UI 类型图拉进来。
 */

/** conversation 事件定义的 `kind`（也是节点渲染键）。 */
export const DIAGRAM_TURN_KIND = 'dshDiagramTurn'

/** `TurnLocation.data` 里存放本回合图表的 key（turnTail 条目按它读）。 */
export const DIAGRAM_TURN_DATA_KEY = 'dshDiagramTurn'

/** 会被收录的两个 wire 工具名。 */
const TRACKED_TOOLS: readonly string[] = ['render_architecture', 'yaml_to_drawio']

/** 本回合里一张可渲染的架构图（只留渲染与导出所需的最小字段）。 */
export interface TurnDiagram {
  readonly callId: string
  readonly title: string
  readonly yamlSpec: string
}

/** 折叠状态：`pending` 存尚未配对结果的 `tool/call`，`diagrams` 是已配对可渲染的。 */
interface TurnState {
  readonly turn: number
  readonly pending: Readonly<Record<string, { readonly title: string; readonly yamlSpec: string }>>
  readonly diagrams: readonly TurnDiagram[]
}

/** conversation 事件定义里我们看到的事件切片。 */
interface SessionEventLike {
  readonly type: string
  readonly data: unknown
}

interface EventMatch {
  readonly id: string
  readonly role: 'start' | 'update'
}

interface DefinitionContext {
  readonly state?: unknown
}

/** 只把普通对象当记录看：null / 数组 / 标量一律 undefined。 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** 解析 `tool/call.arguments`（模型给的 JSON 字符串）；半截或非法就当作没有。 */
function parseArguments(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined
  try {
    return asRecord(JSON.parse(raw))
  } catch {
    return undefined
  }
}

/**
 * 本插件的 conversation 事件定义。
 *
 * `match` 只认三种事件；`start` 建初态；`update` 增量折叠；`buildLocationData` 按 turn 作用域
 * 把结果挂到 `TurnLocation.data` 上。没有产出图时 `buildLocationData` 返回 `null`，
 * 于是本回合**不会**多出一个空条目。
 */
export const diagramTurnDefinition = {
  kind: DIAGRAM_TURN_KIND,

  match(event: SessionEventLike): EventMatch | null {
    const turn = asRecord(event.data)?.turn
    if (typeof turn !== 'number') return null
    if (event.type === 'turn/start') return { id: String(turn), role: 'start' }
    if (event.type === 'tool/call' || event.type === 'tool/result') return { id: String(turn), role: 'update' }
    return null
  },

  start(_context: DefinitionContext, match: { readonly event: SessionEventLike }): TurnState {
    const turn = asRecord(match.event.data)?.turn
    return { turn: typeof turn === 'number' ? turn : 0, pending: {}, diagrams: [] }
  },

  update(context: DefinitionContext, match: { readonly event: SessionEventLike }): TurnState {
    const state = context.state as TurnState | undefined
    const data = asRecord(match.event.data)
    if (state === undefined || data === undefined) {
      return { turn: 0, pending: {}, diagrams: [] }
    }

    if (match.event.type === 'tool/call') {
      const callId = typeof data.callId === 'string' ? data.callId : undefined
      const name = typeof data.name === 'string' ? data.name : undefined
      if (callId === undefined || name === undefined || !TRACKED_TOOLS.includes(name)) return state
      const args = parseArguments(data.arguments)
      return {
        ...state,
        pending: {
          ...state.pending,
          [callId]: {
            title: typeof args?.title === 'string' ? args.title : '',
            yamlSpec: typeof args?.yaml_spec === 'string' ? args.yaml_spec : '',
          },
        },
      }
    }

    if (match.event.type === 'tool/result') {
      const callId = asRecord(data.message)?.toolCallId
      if (typeof callId !== 'string') return state
      const pending = state.pending[callId]
      if (pending === undefined) return state

      // YAML 优先取调用参数；文件级工具的 YAML 只在结果 meta 里。
      const meta = asRecord(data.meta)
      const yamlSpec = pending.yamlSpec !== ''
        ? pending.yamlSpec
        : (typeof meta?.yaml_spec === 'string' ? meta.yaml_spec : '')

      const rest = { ...state.pending }
      delete rest[callId]
      if (yamlSpec === '') return { ...state, pending: rest }

      const fileName = typeof meta?.file_name === 'string' ? meta.file_name.replace(/\.drawio$/i, '') : ''
      return {
        ...state,
        pending: rest,
        diagrams: [...state.diagrams, {
          callId,
          title: pending.title !== '' ? pending.title : fileName,
          yamlSpec,
        }],
      }
    }

    return state
  },

  buildLocationData(context: DefinitionContext, scope: string) {
    const state = context.state as TurnState | undefined
    if (scope !== 'turn' || state === undefined || state.diagrams.length === 0) return null
    return {
      kind: 'turn' as const,
      turn: state.turn,
      key: DIAGRAM_TURN_DATA_KEY,
      value: { diagrams: state.diagrams },
    }
  },
}

/** turnTail 条目拿到的 owner props 里我们用到的那一小块。 */
export interface TurnOwnerProps {
  readonly turn: { readonly data: { get(key: string): unknown } }
}

/**
 * 从 turnTail 的 owner props 里取出本回合的图。
 * @param owner - 槽位给的 owner props。
 * @returns 图数组；本回合没有图时是空数组（条目据此返回 null，不占位）。
 */
export function selectTurnDiagrams(owner: TurnOwnerProps): readonly TurnDiagram[] {
  const value = asRecord(owner.turn.data.get(DIAGRAM_TURN_DATA_KEY))
  const diagrams = value?.diagrams
  if (!Array.isArray(diagrams)) return []
  return diagrams as readonly TurnDiagram[]
}
