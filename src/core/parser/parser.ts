/**
 * Parser 主类 - 整合所有解析功能
 */

import type { ASTNode } from "../../types/ast-types";
import { ExpressionParser } from "./expression-parser";

/**
 * Parser 类 - 完整的 JavaScript 表达式解析器
 */
export class Parser extends ExpressionParser {
  /**
   * 解析表达式字符串为 AST
   */
  parse(): ASTNode {
    this.skipWhitespace();
    const node = this.parseExpression();
    this.skipWhitespace();
    if (this.pos < this.source.length) {
      throw new Error(`Unexpected token at position ${this.pos}: ${this.source.slice(this.pos, this.pos + 10)}`);
    }
    return node;
  }
}
