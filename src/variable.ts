import type { Variable } from "./types";

/**
 * 创建一个类型化变量
 *
 * @template T - 变量的值类型
 * @returns 返回 Variable 对象，包含 _tag 标记
 *
 * @example
 * ```ts
 * const x = variable<number>()
 * const name = variable<string>()
 * const config = variable<{
 *   count: number,
 *   enabled: boolean
 * }>()
 * ```
 */
export function variable<T>(): Variable<T> {
  return {
    _tag: "variable",
    _type: undefined as unknown as T, // 仅用于类型推导，运行时不存在
  } as Variable<T>;
}
