import { createProxyVariable } from "../proxy/proxy-variable";
import type { Variable } from "../types";

/**
 * 跟踪每个 variable 的唯一 Symbol ID
 */
const variableIds = new WeakMap<object, symbol>();

/**
 * 计数器用于生成唯一变量 ID
 */
let variableCounter = 0;

/**
 * 创建一个类型化变量
 * 返回 Proxy 对象，支持链式属性访问和方法调用
 *
 * @example
 * ```ts
 * const x = variable<number>();
 * const config = variable<{ timeout: number }>();
 * const timeout = config.timeout; // Proxy expression
 * ```
 */
export function variable<T>(): Variable<T> {
  const id = Symbol(`var_${variableCounter++}`);
  const proxy = createProxyVariable<T>(id);
  variableIds.set(proxy, id);
  return proxy;
}

/**
 * 获取 variable 的唯一 Symbol ID
 */
export function getVariableId(variable: unknown): symbol | undefined {
  // Proxy 包装函数，typeof 可能是 'function' 或 'object'
  if ((typeof variable !== "object" && typeof variable !== "function") || variable === null) return undefined;
  return variableIds.get(variable);
}
