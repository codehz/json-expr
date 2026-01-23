import type { InferExpressionResult, ValidateExpression } from "./type-parser";
import type { Expression, Variable } from "./types";

/**
 * 表达式上下文类型约束
 */
type ExprContext = Record<string, Variable<any> | Expression<any, any>>;

/**
 * 表达式错误类型
 */
type ExprError<Msg extends string, Details = unknown> = {
  readonly __error: Msg;
  readonly __details: Details;
};

/**
 * 验证结果处理：如果验证失败返回错误类型，否则返回推导的结果类型
 */
type ExprResult<Source extends string, TContext extends ExprContext> =
  ValidateExpression<Source, TContext> extends true
    ? InferExpressionResult<Source, TContext>
    : ValidateExpression<Source, TContext> extends { error: "undefined_identifiers"; identifiers: infer Ids }
      ? ExprError<"Undefined identifiers in expression", Ids>
      : ExprError<"Expression validation failed", ValidateExpression<Source, TContext>>;

/**
 * 创建一个表达式，支持编译时类型检查和返回类型自动推导
 *
 * @template TContext - 表达式上下文类型（Variable 或 Expression 的映射）
 * @param context - 包含 Variable 或 Expression 的上下文对象
 * @returns 返回一个函数，该函数接收表达式源码字符串并返回 Expression 对象
 *
 * 类型系统会：
 * 1. 验证表达式中使用的所有标识符都在 context 中定义
 * 2. 根据表达式和操作数类型自动推导返回类型
 *
 * @example
 * ```ts
 * const x = variable(z.number())
 * const y = variable(z.number())
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
export function expr<TContext extends ExprContext>(
  context: TContext
): <Source extends string>(source: Source) => Expression<TContext, ExprResult<Source, TContext>> {
  return <Source extends string>(source: Source): Expression<TContext, ExprResult<Source, TContext>> => {
    return {
      _tag: "expression",
      context,
      source,
      _type: undefined as any,
    } as Expression<TContext, ExprResult<Source, TContext>>;
  };
}
