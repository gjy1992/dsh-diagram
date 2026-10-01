/**
 * 浏览器入口：只暴露「类型 + YAML 解析 + 填缺省」，**刻意不含 Ajv**。
 *
 * 客户端卡片要按 P2-D1 从调用参数 `yaml_spec` 现场重算布局，但：
 * ① Ajv 编译 schema 走 `new Function`，在 Web 环境有 CSP 风险；
 * ② 宿主已经校验过了，渲染侧不该为一份用不上的校验器多背 ~120KB。
 * 因此浏览器半只走 `parseYaml → normalizeSpec → layoutSpec → buildDrawio`。
 *
 * 宿主半仍然从包根入口（`index.ts`，含 `validateArchSpec`）导入。
 */
export * from './types';
export * from './parse';
export * from './normalize';
