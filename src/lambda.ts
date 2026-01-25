// lambda.ts
import type { ASTNode } from "./parser";
import { getProxyMetadata, setProxyMetadata } from "./proxy-metadata";
import {
  collectDepsFromArgs,
  createProxyExpressionWithAST,
  createProxyVariable,
  serializeArgumentToAST,
} from "./proxy-variable";
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
  lambdaParamIndices.set(proxy, index);

  return proxy;
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
  // 1. 创建参数代理和符号映射
  const paramCount = builder.length;
  const { params, paramSymbols } = createLambdaParams(paramCount);

  // 2. 调用 builder 获取函数体表达式
  const bodyExpr = builder(...(params as Parameters<LambdaBuilder<Args, R>>));

  // 3. 从 bodyExpr 中提取 AST 和依赖
  const { bodyAst, bodyDeps } = extractBodyAstAndDeps(bodyExpr);

  // 4. 构造完整的箭头函数 AST（参数名使用占位符，在代码生成时分配）
  // 注意：不再在此处转换参数占位符，而是保持占位符到代码生成时统一分配唯一参数名
  const arrowFunctionAst = createArrowFunctionAst(bodyAst, paramCount, paramSymbols);

  // 5. 过滤掉 lambda 参数依赖，只保留外部闭包变量
  const closureDeps = filterClosureDeps(bodyDeps, paramSymbols);

  // 7. 返回包含 lambda AST 的 Proxy
  const lambdaProxy = createProxyExpressionWithAST<(...args: Args) => R>(arrowFunctionAst, closureDeps);

  // 8. 设置额外的 lambda 元数据（标记为 lambda 类型）
  const existingMeta = getProxyMetadata(lambdaProxy);
  if (existingMeta) {
    setProxyMetadata(lambdaProxy, {
      ...existingMeta,
      type: "expression", // 保持为 expression，但 AST 包含箭头函数
    });
  }

  return lambdaProxy as Lambda<Args, R>;
}

/**
 * 创建 lambda 参数和符号映射
 */
function createLambdaParams(paramCount: number) {
  const params: Proxify<unknown>[] = [];
  const paramSymbols: symbol[] = [];

  for (let i = 0; i < paramCount; i++) {
    const param = createLambdaParam<unknown>(i);
    params.push(param);

    // 获取参数的 Symbol ID
    const meta = getProxyMetadata(param);
    if (meta?.rootVariable) {
      paramSymbols.push(meta.rootVariable);
    }
  }

  return { params, paramSymbols };
}

/**
 * 从表达式中提取 AST 和依赖
 */
function extractBodyAstAndDeps(bodyExpr: unknown): { bodyAst: ASTNode; bodyDeps: Set<symbol> } {
  const meta =
    (typeof bodyExpr === "object" || typeof bodyExpr === "function") && bodyExpr !== null
      ? getProxyMetadata(bodyExpr)
      : undefined;

  if (meta?.ast) {
    // Proxy 表达式：使用其 AST 和依赖
    return {
      bodyAst: meta.ast,
      bodyDeps: meta.dependencies ?? new Set<symbol>(),
    };
  } else {
    // 普通对象、数组或原始值：使用 serializeArgumentToAST 转换
    // 并收集其中可能包含的 Proxy 变量依赖
    const bodyDeps = new Set<symbol>();
    collectDepsFromArgs([bodyExpr], bodyDeps);
    return {
      bodyAst: serializeArgumentToAST(bodyExpr),
      bodyDeps,
    };
  }
}

/**
 * 创建箭头函数 AST
 * 使用占位符参数名，在代码生成时再分配实际参数名
 */
function createArrowFunctionAst(bodyAst: ASTNode, paramCount: number, paramSymbols: symbol[]): ASTNode {
  const paramIdentifiers = Array.from({ length: paramCount }, (_, i) => ({
    type: "Identifier" as const,
    // 使用占位符，在 generate 时会被替换为唯一参数名
    name: `$$VAR_${paramSymbols[i]?.description}$$`,
  }));

  return {
    type: "ArrowFunctionExpr",
    params: paramIdentifiers,
    body: bodyAst,
  };
}

/**
 * 过滤掉 lambda 参数依赖，只保留外部闭包变量
 */
function filterClosureDeps(bodyDeps: Set<symbol>, paramSymbols: symbol[]): Set<symbol> {
  const closureDeps = new Set<symbol>();
  for (const dep of bodyDeps) {
    if (!paramSymbols.includes(dep)) {
      closureDeps.add(dep);
    }
  }
  return closureDeps;
}
