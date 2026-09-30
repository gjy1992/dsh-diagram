import {
  EDGE_STYLES,
  GROUP_VARIANTS,
  INNER_DIRECTIONS,
  LAYOUT_DIRECTIONS,
  MAX_MAX_COLUMNS,
  MIN_MAX_COLUMNS,
  NODE_VARIANTS,
} from './types';

/**
 * 手写 JSON Schema（Draft-07，Ajv 编译）。
 * 只负责"结构与枚举"这一层；外键引用与嵌套环校验在 validate.ts 里做。
 */
export const archSpecSchema: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  required: ['nodes', 'edges'],
  properties: {
    version: { type: 'string' },
    meta: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        desc: { type: 'string' },
        summary: { type: 'string' },
        guide: { type: 'string' },
      },
    },
    layout: {
      type: 'object',
      additionalProperties: false,
      properties: {
        max_columns: {
          oneOf: [
            { type: 'integer', minimum: MIN_MAX_COLUMNS, maximum: MAX_MAX_COLUMNS },
            { type: 'string', enum: ['auto'] },
          ],
        },
        direction: { type: 'string', enum: [...LAYOUT_DIRECTIONS] },
        inner_direction: { type: 'string', enum: [...INNER_DIRECTIONS] },
      },
    },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title'],
        properties: {
          id: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          variant: { type: 'string', enum: [...GROUP_VARIANTS] },
          parent: { type: 'string', minLength: 1 },
        },
      },
    },
    nodes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title'],
        properties: {
          id: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          group: { type: 'string', minLength: 1 },
          desc: { type: 'string' },
          variant: { type: 'string', enum: [...NODE_VARIANTS] },
          items: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    edges: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', minLength: 1 },
          to: { type: 'string', minLength: 1 },
          label: { type: 'string' },
          style: { type: 'string', enum: [...EDGE_STYLES] },
        },
      },
    },
  },
};