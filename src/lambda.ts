// lambda.ts
import { transformIdentifiers, type ASTNode } from "./parser";
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
  lambdaParamIndices.set(proxy as object, index);

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

  // 3. 从 bodyExpr 中提取 AST 和依赖
  //    支持返回 Proxy 表达式、普通对象/数组、或原始值
  let bodyAst: ASTNode;
  let bodyDeps: Set<symbol>;

  const meta =
    (typeof bodyExpr === "object" || typeof bodyExpr === "function") && bodyExpr !== null
      ? getProxyMetadata(bodyExpr as object)
      : undefined;

  if (meta?.ast) {
    // Proxy 表达式：使用其 AST 和依赖
    bodyAst = meta.ast;
    bodyDeps = meta.dependencies ?? new Set<symbol>();
  } else {
    // 普通对象、数组或原始值：使用 serializeArgumentToAST 转换
    // 并收集其中可能包含的 Proxy 变量依赖
    bodyAst = serializeArgumentToAST(bodyExpr);
    bodyDeps = new Set<symbol>();
    collectDepsFromArgs([bodyExpr], bodyDeps);
  }

  // 4. 将参数占位符标识符转换为实际参数名 (_0, _1, _2...)
  const transformedBodyAst = transformIdentifiers(bodyAst, (name) => {
    for (let i = 0; i < paramSymbols.length; i++) {
      const sym = paramSymbols[i];
      if (!sym) continue;
      // 占位符格式：$$VAR_lambda_param_N_INDEX$$
      const placeholder = `$$VAR_${sym.description}$$`;
      if (name === placeholder) {
        return `_${i}`;
      }
    }
    return name;
  });

  // 5. 构造完整的箭头函数 AST
  const paramIdentifiers = params.map((_, i) => ({ type: "Identifier" as const, name: `_${i}` }));
  const arrowFunctionAst: ASTNode = {
    type: "ArrowFunctionExpr",
    params: paramIdentifiers,
    body: transformedBodyAst,
  };

  // 6. 过滤掉 lambda 参数依赖，只保留外部闭包变量
  const closureDeps = new Set<symbol>();
  for (const dep of bodyDeps) {
    if (!paramSymbols.includes(dep)) {
      closureDeps.add(dep);
    }
  }

  // 7. 返回包含 lambda AST 的 Proxy
  const lambdaProxy = createProxyExpressionWithAST<(...args: Args) => R>(arrowFunctionAst, closureDeps);

  // 8. 设置额外的 lambda 元数据（标记为 lambda 类型）
  const existingMeta = getProxyMetadata(lambdaProxy as object);
  if (existingMeta) {
    setProxyMetadata(lambdaProxy as object, {
      ...existingMeta,
      type: "expression", // 保持为 expression，但 AST 包含箭头函数
    });
  }

  return lambdaProxy as Lambda<Args, R>;
}
