import * as jsYaml from 'js-yaml';
import type { Diagnostic } from './diagnostics';

export type ParseResult = { ok: true; value: unknown } | { ok: false; diagnostics: Diagnostic[] };

interface YamlMark {
  line: number;
  column: number;
}

/** 解析 YAML 文本；语法错误转成与校验错误同构的诊断对象 */
export function parseYaml(source: string): ParseResult {
  try {
    return { ok: true, value: jsYaml.load(source) };
  } catch (error) {
    const err = error as { reason?: string; message?: string; mark?: YamlMark };
    const mark = err.mark;
    return {
      ok: false,
      diagnostics: [
        {
          code: 'YAML_SYNTAX',
          path: mark ? `yaml:${mark.line + 1}:${mark.column + 1}` : 'yaml',
          message: `failed to parse YAML: ${err.reason ?? err.message ?? 'unknown error'}`,
        },
      ],
    };
  }
}