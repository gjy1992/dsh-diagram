import { buildDrawio } from '@dsh-diagram/drawio';
import { layoutSpec } from '@dsh-diagram/layout';
import { validateArchSpec, type Diagnostic } from '@dsh-diagram/schema';

export type RenderResult =
  | { ok: true; data: { drawioXml: string; drawioFileName: string } }
  | { ok: false; diagnostics: Diagnostic[] };

export interface RenderInput {
  title: string;
  yamlSpec: string;
}

/**
 * 编排入口（Phase 2 的 Tool 执行器只是它的薄包装）：
 * parse → validate → layout → export。
 * 不抛异常；错误以结构化诊断数组返回，可直接作为 ToolError 载荷。
 */
export async function renderArchitecture(input: RenderInput): Promise<RenderResult> {
  const validated = validateArchSpec(input.yamlSpec);
  if (!validated.ok) {
    return { ok: false, diagnostics: validated.diagnostics };
  }

  const layout = await layoutSpec(validated.spec);
  const artifact = buildDrawio({ title: input.title, spec: validated.spec, layout });

  return {
    ok: true,
    data: { drawioXml: artifact.xml, drawioFileName: artifact.fileName },
  };
}