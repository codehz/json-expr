import { getProxyMetadata } from "./proxy-metadata";
import { createProxyExpressionWithSource } from "./proxy-variable";
import type { InferExpressionResult, ValidateExpression } from "./type-parser";
import type { Proxify } from "./types";
import { getVariableId, getVariablePlaceholder } from "./variable";

/**
 * 创建表达式
 * 返回 Proxy Expression，可以继续链式调用
 *
 * @template TContext - 表达式上下文类型
 * @param context - 包含 Variable 或 Proxy Expression 的上下文对象
 * @returns 返回一个函数，该函数接收表达式源码字符串并返回 Proxy Expression
 *
 * 类型系统会：
 * 1. 验证表达式中使用的所有标识符都在 context 中定义
 * 2. 根据表达式和操作数类型自动推导返回类型
 *
 * @example
 * ```ts
 * const x = variable<number>();
 * const y = variable<number>();
 *
 * // 自动推导返回类型为 number
 * const sum = expr({ x, y })("x + y")
 *
 * // 自动推导返回类型为 boolean
 * const isPositive = expr({ sum })("sum > 0")
 *
 * // 编译错误：z 未在 context 中定义
 * // const invalid = expr({ x, y })("x + z")
 * ```
 */
export function expr<TContext extends Record<string, unknown>>(
  context: TContext
): <TSource extends string>(
  source: ValidateExpression<TSource, TContext> extends never ? never : TSource
) => Proxify<InferExpressionResult<TSource, TContext>> {
  return <TSource extends string>(source: ValidateExpression<TSource, TContext> extends never ? never : TSource) => {
    // 收集所有依赖的 Symbol
    const deps = new Set<symbol>();

    // 建立 变量名 -> Symbol 的映射
    const nameToId = new Map<string, symbol>();

    for (const [name, value] of Object.entries(context)) {
      // 检查是否是 Proxy variable
      const id = getVariableId(value);
      if (id) {
        deps.add(id);
        nameToId.set(name, id);
      } else {
        // 也可能是另一个 Proxy expression（注意：Proxy 包装函数，typeof 返回 'function'）
        const meta =
          (typeof value === "object" || typeof value === "function") && value !== null
            ? getProxyMetadata(value)
            : undefined;
        if (meta?.dependencies) {
          for (const dep of meta.dependencies) {
            deps.add(dep);
          }
        }
      }
    }

    // 将源码中的变量名替换为占位符
    let transformedSource = source as string;
    for (const [name, id] of nameToId) {
      // 使用正则替换，确保是完整的标识符
      const placeholder = getVariablePlaceholder(id);
      // 注意：在 replace 的替换字符串中，$$ 会被解释为字面量 $
      // 所以需要将 $ 替换为 $$
      const escapedPlaceholder = placeholder.replace(/\$/g, "$$$$");
      const regex = new RegExp(`\\b${name}\\b`, "g");
      transformedSource = transformedSource.replace(regex, escapedPlaceholder);
    }

    // 处理 context 中的 Proxy expression（它们的 source 已包含占位符）
    for (const [name, value] of Object.entries(context)) {
      // 注意：Proxy 包装函数，typeof 返回 'function'
      if ((typeof value === "object" || typeof value === "function") && value !== null && !getVariableId(value)) {
        const meta = getProxyMetadata(value);
        if (meta?.source) {
          const regex = new RegExp(`\\b${name}\\b`, "g");
          // 转义 $ 以避免被解释为替换模式
          const escapedSource = `(${meta.source})`.replace(/\$/g, "$$$$");
          transformedSource = transformedSource.replace(regex, escapedSource);
        }
      }
    }

    return createProxyExpressionWithSource<InferExpressionResult<TSource, TContext>>(transformedSource, deps);
  };
}
