import { z } from "zod";
import type { Variable } from "./types";

/**
 * 创建一个类型化变量
 *
 * @template T - Zod schema 类型
 * @param schema - Zod schema 对象，定义变量的类型和验证规则
 * @returns 返回 Variable 对象，包含 _tag 标记和 schema
 *
 * @example
 * ```ts
 * const x = variable(z.number())
 * const name = variable(z.string())
 * const config = variable(z.object({
 *   count: z.number(),
 *   enabled: z.boolean()
 * }))
 * ```
 */
export function variable<T extends z.ZodType>(schema: T): Variable<T> {
  return {
    _tag: "variable",
    schema,
    _type: undefined as any, // 仅用于类型推导，运行时不存在
  } as Variable<T>;
}
