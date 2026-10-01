/**
 * 宿主边界的**最小契约声明**（只为类型检查，不产生运行时代码 —— `.d.ts` 会被 esbuild 忽略）。
 *
 * 背景：本插件是在 dsh 之外开发的，`pnpm typecheck:plugin` 只映射了
 * `@deepseek-ai/dsh-tools` / `@deepseek-ai/cordis` / `react` 三个外部依赖。
 * 有两类成员在这个隔离检查里解析不到，于是按**权威签名**在这里补出来：
 *
 * ① `Context.get` / `Context.emit` —— cordis 把这两条增强写在 `declare module './context.ts'`
 *    里（相对说明符）。映射到已构建的 `.d.ts` 时，这种相对增强不会生效；
 *    而 dsh-tools 用的是**包名**形式的增强（`declare module '@deepseek-ai/cordis'`），所以
 *    `ctx.tools` 正常、只有这两个成员缺失。权威：
 *      - `vendor/cordis/lib/types/reflect.d.ts:14`（`get`）
 *      - `vendor/cordis/lib/types/events.d.ts:44`（`emit`，按 `Events` 全类型化）
 * ② `fs/observed` 事件 —— 由 `@deepseek-ai/dsh-fs` 用包名增强发布。这里**不** import 它的类型：
 *    那会把整个 fs + sandbox 的类型图拉进这个小插件的检查，而我们只用到
 *    `target.displayPath` 与 `version`。权威：`packages/fs/fs/src/index.ts:77`。
 *
 * 声明与权威逐条对齐：形状写错的代价是**我们自己的调用点**报错 —— 这正是想要的效果。
 */
declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * 读取服务实现，不要求 `inject`。
     * @param name - 服务名。
     * @param strict - `true`（缺省）时只返回提供方 fiber 仍活跃的实现。
     * @returns 服务值，未提供时为 `undefined`。
     */
    get<K extends string & keyof this>(name: K, strict?: boolean): undefined | this[K]
    /** 类型面之外的服名走这条重载。 */
    get(name: string, strict?: boolean): unknown

    /**
     * 同步派发一个事件（不等监听器返回值）。
     * @param name - 事件名，必须是 `Events` 里的键。
     * @param args - 传给每个监听器的参数。
     */
    emit<K extends keyof Events>(name: K, ...args: Parameters<Events[K]>): void
    /** 同上，带显式 `this`（也用于过滤）。 */
    emit<K extends keyof Events>(thisArg: unknown, name: K, ...args: Parameters<Events[K]>): void
  }

  interface Events {
    /**
     * 登记一次文件观察：写入/读取之后告诉 fs 观察账本"此刻内容是这个版本"。
     * 不发的话，模型紧接着 `edit` 同一个文件会被判 `FS_NOT_OBSERVED`。
     * @param target - 被观察的文件（我们只用得到 `displayPath`）。
     * @param observation - `present` 表示"此刻内容是这个版本"。
     * @param actor - 触发这次观察的对象（我们传本次工具调用）。
     */
    'fs/observed'(
      target: { displayPath: string },
      observation: { kind: 'present'; version: unknown },
      actor: object | undefined,
    ): void
  }
}
