// lambda.ts
import { getProxyMetadata, setProxyMetadata } from "./proxy-metadata";
import { createProxyExpressionWithSource, createProxyVariable } from "./proxy-variable";
import type { Lambda, LambdaBuilder, Proxify } from "./types";

/**
 * Lambda 参数计数器，用于生成唯一 ID
 */
let lambdaParamCounter = 0;

/**
 * Lambda 参数到索引的映射
 * 用于编译时确定参数位置
 */
const lambdaParamIndices = new WeakMap<object, number>();

/**
 * 获取 lambda 参数的索引
 */
export function getLambdaParamIndex(param: unknown): number | undefined {
  if ((typeof param !== "object" && typeof param !== "function") || param === null) {
    return undefined;
  }
  return lambdaParamIndices.get(param);
}

/**
 * 创建 lambda 参数代理
 * 生成带特殊标记的 Proxy，用于在表达式中追踪参数
 *
 * @param index - 参数索引（0, 1, 2...）
 * @returns Lambda 参数代理
 */
function createLambdaParam<T>(index: number): Proxify<T> {
  // 使用带前缀的唯一 ID，避免与普通变量冲突
  const id = Symbol(`lambda_param_${lambdaParamCounter++}_${index}`);
  const proxy = createProxyVariable<T>(id);

  // 记录参数索引
  lambdaParamIndices.set(proxy as object, index);

  return proxy;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 创建类型安全的 lambda 表达式
 *
 * @template Args - 参数类型元组
 * @template R - 返回值类型
 * @param builder - Lambda 构建函数，接收参数代理，返回函数体表达式
 * @returns Lambda 表达式代理
 *
 * @example
 * ```ts
 * const add = lambda<[number, number], number>(
 *   (a, b) => expr({ a, b })("a + b")
 * );
 *
 * const numbers = variable<number[]>();
 * const sum = numbers.reduce(add, 0);
 * ```
 */
export function lambda<Args extends unknown[], R>(builder: LambdaBuilder<Args, R>): Lambda<Args, R> {
  // 1. 根据 builder 函数的参数数量创建参数代理
  const paramCount = builder.length;
  const params: Proxify<unknown>[] = [];
  const paramSymbols: symbol[] = [];

  for (let i = 0; i < paramCount; i++) {
    const param = createLambdaParam<unknown>(i);
    params.push(param);

    // 获取参数的 Symbol ID
    const meta = getProxyMetadata(param as object);
    if (meta?.rootVariable) {
      paramSymbols.push(meta.rootVariable);
    }
  }

  // 2. 调用 builder 获取函数体表达式
  const bodyExpr = builder(...(params as Parameters<LambdaBuilder<Args, R>>));

  // 3. 从 bodyExpr 中提取源码和依赖
  const meta = getProxyMetadata(bodyExpr as object);
  if (!meta?.source) {
    throw new Error("Lambda body must return a Proxy expression");
  }

  const bodySource = meta.source;
  const bodyDeps = meta.dependencies ?? new Set<symbol>();

  // 4. 将参数占位符替换为实际参数名 (_0, _1, _2...)
  let lambdaBody = bodySource;
  for (let i = 0; i < paramSymbols.length; i++) {
    const sym = paramSymbols[i];
    if (!sym) continue;
    // 占位符格式：$$VAR_lambda_param_N_INDEX$$
    const placeholder = `$$VAR_${sym.description}$$`;
    const paramName = `_${i}`;
    lambdaBody = lambdaBody.replace(new RegExp(escapeRegex(placeholder), "g"), paramName);
  }

  // 5. 构造完整的箭头函数源码
  const paramList = params.map((_, i) => `_${i}`).join(",");
  const lambdaSource = paramCount === 1 ? `${paramList}=>${lambdaBody}` : `(${paramList})=>${lambdaBody}`;

  // 6. 过滤掉 lambda 参数依赖，只保留外部闭包变量
  const closureDeps = new Set<symbol>();
  for (const dep of bodyDeps) {
    if (!paramSymbols.includes(dep)) {
      closureDeps.add(dep);
    }
  }

  // 7. 返回包含 lambda 源码的 Proxy
  const lambdaProxy = createProxyExpressionWithSource<(...args: Args) => R>(lambdaSource, closureDeps);

  // 8. 设置额外的 lambda 元数据（标记为 lambda 类型）
  const existingMeta = getProxyMetadata(lambdaProxy as object);
  if (existingMeta) {
    setProxyMetadata(lambdaProxy as object, {
      ...existingMeta,
      type: "expression", // 保持为 expression，但源码包含箭头函数
    });
  }

  return lambdaProxy as Lambda<Args, R>;
}
