import { countIdentifierReferences, transformIdentifiers } from "../core/generate";
import { parse } from "../core/parser";
import { getProxyMetadata } from "../proxy/proxy-metadata";
import { createProxyExpressionWithAST } from "../proxy/proxy-variable";
import type { Proxify } from "../types";
import type { ASTNode, Placeholder } from "../types/ast-types";
import type { InferExpressionResult, ValidateExpression } from "../types/type-parser";
import { getVariableId } from "./variable";

/**
 * 创建表达式
 * 返回 Proxy Expression，可以继续链式调用
 *
 * @template TContext - 表达式上下文类型
 * @param context - 包含 Variable 或 Proxy Expression 的上下文对象
 * @returns 返回一个函数，该函数接收表达式源码字符串并返回 Proxy Expression
 *
 * 类型系统会：
 * 1. 验证表达式中使用的所有标识符都在 context 中定义
 * 2. 根据表达式和操作数类型自动推导返回类型
 *
 * @example
 * ```ts
 * const x = variable<number>();
 * const y = variable<number>();
 *
 * // 自动推导返回类型为 number
 * const sum = expr({ x, y })("x + y")
 *
 * // 自动推导返回类型为 boolean
 * const isPositive = expr({ sum })("sum > 0")
 *
 * // 编译错误：z 未在 context 中定义
 * // const invalid = expr({ x, y })("x + z")
 * ```
 */
export function expr<TContext extends Record<string, unknown>>(
  context: TContext
): <TSource extends string>(
  source: ValidateExpression<TSource, TContext> extends never ? never : TSource
) => Proxify<InferExpressionResult<TSource, TContext>> {
  return <TSource extends string>(source: ValidateExpression<TSource, TContext> extends never ? never : TSource) => {
    // 收集所有依赖的 Symbol
    const deps = new Set<symbol>();

    // 建立 变量名 -> Symbol 的映射
    const nameToId = new Map<string, symbol>();

    for (const [name, value] of Object.entries(context)) {
      // 检查是否是 Proxy variable（包括通过 variable() 创建的和 lambda 参数）
      let id = getVariableId(value);

      // 如果 getVariableId 返回 undefined，尝试从 ProxyMetadata 获取 rootVariable
      // 这用于支持 lambda 参数（它们没有注册到 variableIds 中）
      if (!id && (typeof value === "object" || typeof value === "function") && value !== null) {
        const meta = getProxyMetadata(value);
        if (meta?.type === "variable" && meta.rootVariable) {
          id = meta.rootVariable;
        }
      }

      if (id) {
        deps.add(id);
        nameToId.set(name, id);
      } else {
        // 也可能是另一个 Proxy expression（注意：Proxy 包装函数，typeof 返回 'function'）
        const meta =
          (typeof value === "object" || typeof value === "function") && value !== null
            ? getProxyMetadata(value)
            : undefined;
        if (meta?.dependencies) {
          for (const dep of meta.dependencies) {
            deps.add(dep);
          }
        }
      }
    }

    // 建立变量名到子表达式 AST 的映射（用于 Proxy expression）
    const nameToExprAST = new Map<string, ASTNode>();
    for (const [name, value] of Object.entries(context)) {
      // 注意：Proxy 包装函数，typeof 返回 'function'
      if ((typeof value === "object" || typeof value === "function") && value !== null) {
        // 跳过已经在 nameToId 中的变量
        if (nameToId.has(name)) continue;

        const meta = getProxyMetadata(value);
        if (meta?.ast) {
          nameToExprAST.set(name, meta.ast);
        }
      }
    }

    // 解析用户输入的字符串为 AST
    const ast = parse(source);

    // 统计每个标识符的引用次数，用于决定是否内联
    const refCounts = new Map<string, number>();
    countIdentifierReferences(ast, refCounts);

    // 收集推迟编译的子表达式 AST（因引用次数 > 1 而未内联）
    const deferredAsts = new Map<string, ASTNode>();

    // 在 AST 级别进行标识符替换
    const transformedAst = transformIdentifiers(ast, (name): string | ASTNode => {
      // 检查是否是 context 中的变量
      const id = nameToId.get(name);
      if (id) {
        // 返回占位符节点
        return { type: "Placeholder", id } satisfies Placeholder;
      }

      // 检查是否是子表达式
      const exprAST = nameToExprAST.get(name);
      if (exprAST) {
        // 引用计数 > 1 则推迟编译，否则内联
        const rc = refCounts.get(name) ?? 0;
        if (rc <= 1) {
          return exprAST;
        }
        deferredAsts.set(name, exprAST);
        return name;
      }

      // 保持原样（可能是全局对象如 Math, JSON 等）
      return name;
    });

    return createProxyExpressionWithAST<InferExpressionResult<TSource, TContext>>(
      transformedAst,
      deps,
      deferredAsts.size > 0 ? deferredAsts : undefined
    );
  };
}
