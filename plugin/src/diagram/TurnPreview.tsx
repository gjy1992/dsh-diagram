/**
 * 回合末尾的架构图预览（T6）—— 挂 `conversation.chat.turnTail` 的那个条目。
 *
 * 存在的理由：工具行在 ui-chat 的 step 过程折叠行里，回合结束后默认收起，
 * 卡片跟着看不见。这里在**回合末尾**（Turn 的动作行之前）再摆一次本轮产出的图，
 * 与工具行是否展开无关。
 *
 * 与卡片的区别只有三处，其余全部复用（`model.ts` 的管线、`DiagramCanvas` 的画布）：
 *   - 画布用 `variant="preview"`：可视高度更矮、隐藏操作提示行；
 *   - 标题更紧凑（一行标题 + 下载按钮），因为它出现在回合结尾而不是工具调用处；
 *   - 本回合**没有**产出图时返回 `null`，不占位（list 槽的契约：无内容即无条目）。
 */
import { useCallback } from 'react'
import { DiagramCanvas } from './DiagramCanvas'
import { downloadDrawio, useDiagramModel } from './model'
import { selectTurnDiagrams, type TurnDiagram, type TurnOwnerProps } from './turn-diagrams'

/** 预览文案（由 client.tsx 从 locale 绑定后传入，组件本身不碰 ctx）。 */
export interface TurnPreviewLabels {
  title: string
  download: string
  fitWidth: string
  fitAll: string
  zoomIn: string
  zoomOut: string
  failed: string
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginTop: '10px',
  },
  item: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    padding: '8px 10px',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: '10px',
    background: 'var(--dsw-alias-bg-layer-1)',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--dsw-alias-label-primary)',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flex: '0 0 auto',
    background: 'var(--dsw-alias-state-success-primary)',
  },
  name: { fontWeight: 600, flex: '0 0 auto' },
  summary: {
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: 'var(--dsw-alias-label-secondary)',
  },
  button: {
    flex: '0 0 auto',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: 'transparent',
    color: 'var(--dsw-alias-label-secondary)',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1.4,
    padding: '1px 7px',
    borderRadius: '6px',
  },
  note: { fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)' },
}

/** 一张图的预览块。 */
function TurnDiagramItem({ diagram, labels }: { diagram: TurnDiagram; labels: TurnPreviewLabels }) {
  const { model, error } = useDiagramModel(diagram.yamlSpec, diagram.title)

  const onDownload = useCallback(() => {
    if (model === null) return
    try {
      downloadDrawio(model)
    } catch (cause: unknown) {
      console.error('[dsh-diagram] 回合预览导出 .drawio 失败:', cause)
    }
  }, [model])

  return (
    <div style={styles.item} data-dsh-diagram-turn-preview="">
      <div style={styles.head}>
        <span style={styles.dot} aria-hidden />
        <span style={styles.name}>{labels.title}</span>
        <span style={styles.summary}>{diagram.title !== '' ? diagram.title : model?.title ?? ''}</span>
        <button type="button" style={styles.button} onClick={onDownload}>{labels.download}</button>
      </div>
      {model !== null && (
        <DiagramCanvas
          scene={model.scene}
          fileName={model.title}
          onDownload={onDownload}
          labels={labels}
          idPrefix={`dsh-diagram-turn-${diagram.callId}`}
          variant="preview"
        />
      )}
      {error !== null && <div style={styles.note}>{labels.failed}: {error}</div>}
    </div>
  )
}

/**
 * 回合末尾预览条目。
 * @param props - 槽位 owner props（含本回合坐标）与绑定好的文案。
 * @returns 有图时是预览块，没有时 `null`。
 */
export function TurnPreview({ turn, labels }: { turn: TurnOwnerProps['turn']; labels: TurnPreviewLabels }) {
  const diagrams = selectTurnDiagrams({ turn })
  if (diagrams.length === 0) return null
  return (
    <div style={styles.wrap}>
      {diagrams.map((diagram) => (
        <TurnDiagramItem key={diagram.callId} diagram={diagram} labels={labels} />
      ))}
    </div>
  )
}
