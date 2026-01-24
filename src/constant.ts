import { createProxyExpressionWithSource } from "./proxy-variable";
import type { Proxify } from "./types";

/**
 * 创建一个常量表达式
 *
 * @deprecated 直接使用原始值即可。在 Proxy 系统中，原始值会自动序列化。
 *
 * @example
 * ```ts
 * // ❌ 不再推荐
 * const PI = constant(3.14159);
 *
 * // ✅ 推荐方式
 * const area = expr({ radius })("3.14159 * radius * radius");
 * // 或
 * const area = expr({ radius, PI: 3.14159 })("PI * radius * radius");
 * ```
 */
export function constant<T>(value: T): Proxify<T> {
  const source = JSON.stringify(value);
  return createProxyExpressionWithSource<T>(source, new Set());
}
