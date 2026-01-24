import type { ASTNode, BinaryExpr, StringLiteral } from "./parser";
import { collectDepsFromArgs, createProxyExpressionWithAST, serializeArgumentToAST } from "./proxy-variable";
import type { Proxify } from "./types";

/**
 * Tagged template 函数，用于创建包含变量的字符串表达式
 *
 * @example
 * ```ts
 * const name = variable<string>();
 * const count = variable<number>();
 *
 * const greeting = t`Hello, ${name}!`;
 * const message = t`You have ${count} items.`;
 *
 * const compiled = compile(greeting, { name });
 * const result = evaluate(compiled, { name: "Alice" }); // => "Hello, Alice!"
 * ```
 */
export function t(strings: TemplateStringsArray, ...values: unknown[]): Proxify<string> {
  // 收集所有依赖
  const deps = new Set<symbol>();
  collectDepsFromArgs(values, deps);

  // 构建字符串拼接表达式的各个 AST 节点
  const parts: ASTNode[] = [];

  for (let i = 0; i < strings.length; i++) {
    const str = strings[i]!;
    // 添加静态字符串部分（作为字符串字面量 AST 节点）
    if (str.length > 0) {
      parts.push({
        type: "StringLiteral",
        value: str,
        quote: '"',
      } as StringLiteral);
    }

    if (i < values.length) {
      // 序列化插值部分为 AST
      const ast = serializeArgumentToAST(values[i]);
      parts.push(ast);
    }
  }

  // 如果没有任何部分，返回空字符串
  if (parts.length === 0) {
    const emptyStringAst: StringLiteral = {
      type: "StringLiteral",
      value: "",
      quote: '"',
    };
    return createProxyExpressionWithAST<string>(emptyStringAst, deps);
  }

  // 如果只有一个部分，直接返回
  if (parts.length === 1) {
    return createProxyExpressionWithAST<string>(parts[0]!, deps);
  }

  // 用 + 连接所有部分
  let resultAst = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    resultAst = {
      type: "BinaryExpr",
      operator: "+",
      left: resultAst,
      right: parts[i]!,
    } as BinaryExpr;
  }

  return createProxyExpressionWithAST<string>(resultAst, deps);
}
