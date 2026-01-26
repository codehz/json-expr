import type { ProxyExpression, Variable } from "../../types";

// ============================================================================
// 上下文验证
// ============================================================================

/** 从 Variable 提取值类型 */
export type ExtractType<T> = T extends ProxyExpression<infer V> ? V : T extends Variable<infer V> ? V : never;

/** 从上下文对象构建类型映射 */
export type ContextTypeMap<TContext> = {
  [K in keyof TContext]: ExtractType<TContext[K]>;
};

/** 找出未定义的标识符 */
export type FindUndefinedIdentifiers<Ids extends string, ContextKeys extends string> = Ids extends ContextKeys
  ? never
  : Ids;
