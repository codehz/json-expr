import { createProxyVariable } from "./proxy-variable";
import type { Variable } from "./types";

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
  variableIds.set(proxy as object, id);
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

/**
 * 生成变量占位符字符串
 * 格式：$$VAR_var_N$$
 */
export function getVariablePlaceholder(id: symbol): string {
  return `$$VAR_${id.description}$$`;
}

/**
 * 从占位符提取变量 ID 描述
 * 返回 null 如果不是有效占位符
 */
export function parseVariablePlaceholder(placeholder: string): string | null {
  const match = placeholder.match(/^\$\$VAR_(.+)\$\$$/);
  return match ? (match[1] ?? null) : null;
}
