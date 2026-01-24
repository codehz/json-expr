// proxy-metadata.ts

/**
 * Proxy 元数据接口
 */
export interface ProxyMetadata {
  type: "variable" | "expression";
  path: string[]; // 表达式路径，如 ["ui", "Text"]
  source?: string; // 完整表达式源码（expression 类型）
  rootVariable?: symbol; // 根 variable 的唯一标识
  dependencies?: Set<symbol>; // 依赖的所有 variable Symbol
}

/**
 * 全局 WeakMap 存储
 */
const proxyMetadata = new WeakMap<object, ProxyMetadata>();

/**
 * 设置 Proxy 元数据
 */
export function setProxyMetadata(proxy: object, metadata: ProxyMetadata): void {
  proxyMetadata.set(proxy, metadata);
}

/**
 * 获取 Proxy 元数据
 */
export function getProxyMetadata(proxy: object): ProxyMetadata | undefined {
  return proxyMetadata.get(proxy);
}

/**
 * 检查对象是否是 Proxy variable
 */
export function isProxyVariable(obj: unknown): obj is object {
  if ((typeof obj !== "object" && typeof obj !== "function") || obj === null) return false;
  const meta = proxyMetadata.get(obj);
  return meta?.type === "variable";
}

/**
 * 检查对象是否是 Proxy expression
 */
export function isProxyExpression(obj: unknown): obj is object {
  if ((typeof obj !== "object" && typeof obj !== "function") || obj === null) return false;
  const meta = proxyMetadata.get(obj);
  return meta?.type === "expression";
}

/**
 * 检查对象是否是任意 Proxy (variable 或 expression)
 */
export function isProxy(obj: unknown): obj is object {
  if ((typeof obj !== "object" && typeof obj !== "function") || obj === null) return false;
  return proxyMetadata.has(obj);
}
