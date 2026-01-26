/**
 * JavaScript 表达式解析器
 * 将表达式字符串解析为 AST，支持常见的运算符和语法
 */

import type { ASTNode } from "../../types/ast-types";
import { Parser } from "./parser";

/**
 * 解析 JavaScript 表达式为 AST
 */
export function parse(source: string): ASTNode {
  return new Parser(source).parse();
}

// 导出所有公共类型和常量
export { ArrowFunctionParser } from "./arrow-function-parser";
export * from "./constants";
export { ExpressionParser } from "./expression-parser";
export { Parser } from "./parser";
export { PrimaryParser } from "./primary-parser";
export { Tokenizer } from "./tokenizer";
export * from "./utils";
