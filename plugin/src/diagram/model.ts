/**
 * YAML → 场景 的**唯一管线**（卡片与「回合末尾预览」共用）。
 *
 * 为什么要抽出来：卡片（`client.tsx`）与回合末尾预览（`TurnPreview.tsx`）需要的是同一件事 ——
 * 把一段 YAML 变成可以画的场景 + 可以导出 .drawio 的 layout。之前这段管线写在卡片里，
 * 预览再用一份就会漂移（两处对 YAML 的容忍度不一样，同一张图两个样子）。
 *
 * 管线刻意不含 Ajv（见 `packages/schema/src/browser.ts`）：宿主已经校验过了，
 * 渲染侧只做「解析 + 填缺省 + 布局 + 构场景」，并在宿主验过的前提下**尽力容忍**输入 ——
 * 失败时返回错误字符串由调用方展示，不抛到 React 之外。
 */
import { useEffect, useState } from 'react'
import { buildDrawio } from '@dsh-diagram/drawio'
import { layoutSpec, type LayoutResult } from '@dsh-diagram/layout'
import { normalizeSpec, parseYaml } from '@dsh-diagram/schema/browser'
import type { ArchSpec, NormalizedSpec } from '@dsh-diagram/schema/browser'
import { buildScene, type DiagramScene } from './scene'

/** 一次可渲染的架构图：场景 + 导出所需的一切。 */
export interface DiagramModel {
  scene: DiagramScene
  spec: NormalizedSpec
  layout: LayoutResult
  title: string
}

/**
 * 形状守卫：`normalizeSpec` 假定结构已经通过校验，而浏览器半没有 Ajv 兜底，
 * 所以先把输入变成一个「至少不会抛在 normalize 内部」的形状。
 * @param value - 解析出来的 YAML 根值。
 * @returns 可信的 ArchSpec。
 */
export function asArchSpec(value: unknown): ArchSpec {
  if (typeof value !== 'object' || value === null) throw new Error('YAML 顶层不是对象')
  const candidate = value as { nodes?: unknown; edges?: unknown }
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    throw new Error('缺少 nodes / edges 数组')
  }
  return value as ArchSpec
}

/**
 * 跑完整条管线。
 * @param yamlSpec - YAML 文本（来自调用参数或 `tool/result.meta`）。
 * @param title - 展示/导出用的标题；空串时回落到 YAML 自己的 `meta.title`。
 * @returns 可渲染的模型。
 */
export async function buildDiagramModel(yamlSpec: string, title: string): Promise<DiagramModel> {
  const parsed = parseYaml(yamlSpec)
  if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message ?? 'YAML 解析失败')
  const spec = normalizeSpec(asArchSpec(parsed.value))
  const layout = await layoutSpec(spec)
  const scene = buildScene(layout, spec)
  return { scene, spec, layout, title: title !== '' ? title : spec.meta.title ?? '' }
}

/** 管线状态：模型与「为什么画不出来」二选一。 */
export interface DiagramModelState {
  model: DiagramModel | null
  error: string | null
}

/**
 * 用**同一份布局**导出明文 .drawio 并触发浏览器下载。
 *
 * 卡片与回合末尾预览共用：预览与导出必须逐点一致，所以两侧都从 `DiagramModel.layout` 出发，
 * 而不是各自重新算一遍。
 * @param model - 已算好的模型。
 * @returns 实际下载的文件名（供调用方提示用）。
 */
export function downloadDrawio(model: DiagramModel): string {
  const artifact = buildDrawio({
    title: model.title === '' ? 'diagram' : model.title,
    spec: model.spec,
    layout: model.layout,
  })
  const blob = new Blob([artifact.xml], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = artifact.fileName
  anchor.rel = 'noopener'
  anchor.click()
  // 立刻 revoke 在部分浏览器会打断下载，给一拍再回收。
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return artifact.fileName
}

/**
 * React 绑定：`yamlSpec` / `title` 变化时重算，卸载或参数再变时丢弃在飞的结果。
 * @param yamlSpec - YAML 文本；空串表示"还没有内容"（不报错、不放模型）。
 * @param title - 标题。
 * @returns 模型与错误。
 */
export function useDiagramModel(yamlSpec: string, title: string): DiagramModelState {
  const [model, setModel] = useState<DiagramModel | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (yamlSpec === '') {
      setModel(null)
      setError(null)
      return
    }
    let cancelled = false
    setError(null)
    void (async () => {
      try {
        const next = await buildDiagramModel(yamlSpec, title)
        if (!cancelled) setModel(next)
      } catch (cause: unknown) {
        if (cancelled) return
        setModel(null)
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    })()
    return () => { cancelled = true }
  }, [yamlSpec, title])

  return { model, error }
}
