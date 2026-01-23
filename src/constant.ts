import type { Expression } from "./types";

/**
 * JSON 可序列化的值类型
 */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * 创建一个编译期常量表达式
 *
 * 这是 `expr({})(JSON.stringify(value))` 的快速路径，
 * 用于在表达式中嵌入静态值，避免在运行时传入或在多处重复编写。
 *
 * @template T - 常量值类型（必须是 JSON 可序列化的）
 * @param value - 要嵌入的常量值
 * @returns 返回一个 Expression 对象，其结果类型为 T
 *
 * @example
 * ```ts
 * // 创建一个数字常量
 * const PI = constant(3.14159)
 *
 * // 创建一个字符串常量
 * const greeting = constant("Hello, World!")
 *
 * // 创建一个对象常量
 * const config = constant({ maxRetries: 3, timeout: 5000 })
 *
 * // 在表达式中使用常量
 * const radius = variable(z.number())
 * const area = expr({ PI, radius })("PI * radius * radius")
 * ```
 */
export function constant<const T extends JsonValue>(value: T): Expression<{}, T> {
  return {
    _tag: "expression",
    context: {},
    source: JSON.stringify(value),
    _type: undefined as unknown as T,
  };
}
