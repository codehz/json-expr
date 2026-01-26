import { createProxyExpressionWithAST, serializeArgumentToAST } from "../proxy/proxy-variable";
import type { Proxify } from "../types";

/**
 * 将静态值包装为 Proxy Expression
 * 返回的 Proxy 可以像 Variable 一样调用方法和访问属性
 *
 * @template T - 值的类型
 * @param value - 要包装的静态值（支持原始值、对象、数组、Date、RegExp 等）
 * @returns Proxy Expression，可以继续链式调用
 *
 * @example
 * ```ts
 * // 包装 RegExp
 * const pattern = wrap(/^[a-z]+$/i);
 * const input = variable<string>();
 * const result = pattern.match(input);
 *
 * // 包装 Date
 * const now = wrap(new Date());
 * const year = now.getFullYear();
 *
 * // 包装数组
 * const numbers = wrap([1, 2, 3, 4, 5]);
 * const doubled = numbers.map((x) => x * 2);
 * ```
 */
export function wrap<T>(value: T): Proxify<T> {
  // 将静态值序列化为 AST
  const ast = serializeArgumentToAST(value);

  // 创建没有依赖的 Proxy Expression
  const deps = new Set<symbol>();

  return createProxyExpressionWithAST<T>(ast, deps);
}
