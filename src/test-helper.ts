import { compile } from "./compile";
import { evaluate } from "./evaluate";
import type { LambdaBodyResult, Variable } from "./types";

/**
 * 从变量映射推导值类型
 * 例如: { x: Variable<number> } -> { x: number }
 */
type InferVariableValues<T extends Record<string, Variable<unknown>>> = {
  [K in keyof T]: T[K] extends Variable<infer U> ? U : never;
};

/**
 * 编译并求值表达式
 * 自动推导变量类型和返回类型
 *
 * @template TResult - 表达式求值结果类型
 * @template TVars - 变量映射类型
 * @param expr - 要编译的表达式
 * @param variables - 变量定义映射
 * @param values - 变量值映射
 * @returns 表达式求值结果
 *
 * @example
 * ```ts
 * const callback = variable<(f: (x: number) => number) => number>();
 * const result = compileAndEvaluate(
 *   myExpr,
 *   { callback },
 *   { callback: (fn) => fn(5) }
 * );
 * ```
 */
export function compileAndEvaluate<
  TResult = unknown,
  TVars extends Record<string, Variable<unknown>> = Record<string, Variable<unknown>>,
>(expr: LambdaBodyResult<TResult>, variables: TVars, values: InferVariableValues<TVars>): TResult {
  const compiled = compile(expr, variables);
  return evaluate<TResult>(compiled, values);
}
