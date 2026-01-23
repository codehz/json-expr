import type { Expression, Variable } from "./types"

/**
 * 创建一个表达式，采用柯里化设计以支持 TypeScript 类型推导
 * 
 * @template TContext - 表达式上下文类型（Variable 或 Expression 的映射）
 * @param context - 包含 Variable 或 Expression 的上下文对象
 * @returns 返回一个函数，该函数接收表达式源码字符串并返回 Expression 对象
 * 
 * @example
 * ```ts
 * const x = variable(z.number())
 * const y = variable(z.number())
 * 
 * // 不指定返回类型，默认推导
 * const sum = expr({ x, y })<number>("x + y")
 * 
 * // 或使用上一步的表达式作为上下文
 * const product = expr({ sum })<number>("sum * 2")
 * ```
 */
export function expr<TContext>(
  context: TContext
): <TResult>(source: string) => Expression<TContext, TResult> {
  return <TResult>(source: string): Expression<TContext, TResult> => {
    return {
      _tag: "expression",
      context,
      source
    } as Expression<TContext, TResult>
  }
}
