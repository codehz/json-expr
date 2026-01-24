// proxy-variable.ts
import { getProxyMetadata, setProxyMetadata } from "./proxy-metadata";
import type { Proxify } from "./types";

/**
 * 使用 Symbol.description 生成占位符
 * 用于在表达式源码中标识变量
 */
function getVariablePlaceholder(id: symbol): string {
  return `$$VAR_${id.description}$$`;
}

/**
 * 序列化参数为表达式字符串
 * - Proxy Variable/Expression：使用源码或占位符
 * - 数组：递归处理元素
 * - 对象：递归处理属性
 * - 原始值：JSON.stringify
 */
export function serializeArgument(arg: unknown): string {
  // 1. 检查是否是 Proxy (通过 getProxyMetadata)
  // 注意：Proxy 包装的是函数，所以 typeof 可能是 "function" 或 "object"
  if ((typeof arg === "object" || typeof arg === "function") && arg !== null) {
    const meta = getProxyMetadata(arg);
    if (meta) {
      // 如果有 source，直接返回（已是完整表达式）
      if (meta.source) return meta.source;
      // 否则是根 variable，用占位符
      if (meta.rootVariable) return getVariablePlaceholder(meta.rootVariable);
    }
  }

  // 2. 数组递归处理
  if (Array.isArray(arg)) {
    return `[${arg.map(serializeArgument).join(", ")}]`;
  }

  // 3. 普通对象递归处理
  if (typeof arg === "object" && arg !== null) {
    const entries = Object.entries(arg)
      .map(([k, v]) => {
        // 如果 key 需要引号（非有效标识符）
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
        return `${safeKey}: ${serializeArgument(v)}`;
      })
      .join(", ");
    return `{${entries}}`;
  }

  // 4. 原始值（包括 null, undefined, number, string, boolean）
  return JSON.stringify(arg);
}

/**
 * 从参数中收集依赖的 Symbol
 * 递归遍历数组和对象，收集所有 Proxy 的依赖
 */
export function collectDepsFromArgs(args: unknown[], deps: Set<symbol>): void {
  for (const arg of args) {
    // 注意：Proxy 包装的是函数，所以 typeof 可能是 "function" 或 "object"
    if ((typeof arg === "object" || typeof arg === "function") && arg !== null) {
      const meta = getProxyMetadata(arg);
      if (meta?.dependencies) {
        for (const dep of meta.dependencies) {
          deps.add(dep);
        }
      } else if (Array.isArray(arg)) {
        collectDepsFromArgs(arg, deps);
      } else if (typeof arg === "object") {
        collectDepsFromArgs(Object.values(arg), deps);
      }
    }
  }
}

/**
 * 创建根 Variable Proxy
 * 拦截属性访问，返回新的 expression proxy
 * 不可直接调用（apply 应该只在链式调用后可用）
 *
 * @param id - 变量的唯一标识 Symbol
 * @returns Proxy 包装的 Variable
 */
export function createProxyVariable<T>(id: symbol): Proxify<T> {
  const deps = new Set([id]);

  const proxy = new Proxy(function () {} as unknown as Proxify<T>, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      // 属性访问：创建 expression proxy
      return createProxyExpression<unknown>(id, [String(prop)], deps);
    },
    apply() {
      throw new Error("Variable cannot be called directly");
    },
  });

  setProxyMetadata(proxy, {
    type: "variable",
    path: [],
    rootVariable: id,
    dependencies: deps,
  });

  return proxy;
}

/**
 * 创建属性访问后的 Proxy
 * 继续拦截属性访问（链式访问）
 * 拦截 apply 进行方法调用
 *
 * @param rootId - 根变量的 Symbol
 * @param path - 属性访问路径
 * @param deps - 依赖集合
 * @returns Proxy 包装的 Expression
 */
export function createProxyExpression<T>(rootId: symbol, path: string[], deps: Set<symbol>): Proxify<T> {
  const source = `${getVariablePlaceholder(rootId)}.${path.join(".")}`;

  const proxy = new Proxy(function () {} as unknown as Proxify<T>, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      return createProxyExpression<unknown>(rootId, [...path, String(prop)], deps);
    },
    apply(_target, _thisArg, args) {
      const serializedArgs = args.map(serializeArgument).join(", ");
      const callSource = `${source}(${serializedArgs})`;
      // 收集参数中的依赖
      const newDeps = new Set(deps);
      collectDepsFromArgs(args, newDeps);
      return createProxyExpressionWithSource<T>(callSource, newDeps);
    },
  });

  setProxyMetadata(proxy, {
    type: "expression",
    path,
    rootVariable: rootId,
    source,
    dependencies: deps,
  });

  return proxy;
}

/**
 * 创建带完整源码的 Proxy（方法调用后）
 * 可以继续链式访问和调用
 *
 * @param source - 完整的表达式源码
 * @param deps - 依赖集合
 * @returns Proxy 包装的 Expression
 */
export function createProxyExpressionWithSource<T>(source: string, deps: Set<symbol>): Proxify<T> {
  const proxy = new Proxy(function () {} as unknown as Proxify<T>, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      // 继续访问：source.prop
      const newSource = `(${source}).${String(prop)}`;
      return createProxyExpressionWithSource<unknown>(newSource, deps);
    },
    apply(_target, _thisArg, args) {
      const serializedArgs = args.map(serializeArgument).join(", ");
      const callSource = `(${source})(${serializedArgs})`;
      const newDeps = new Set(deps);
      collectDepsFromArgs(args, newDeps);
      return createProxyExpressionWithSource<T>(callSource, newDeps);
    },
  });

  setProxyMetadata(proxy, {
    type: "expression",
    path: [source],
    source,
    dependencies: deps,
  });

  return proxy;
}
