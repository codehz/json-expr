/**
 * 箭头函数解析器 - 负责解析箭头函数表达式
 */

import type { ArrowFunctionExpr, Identifier } from "../../types/ast-types";
import { PrimaryParser } from "./primary-parser";
import { isIdentifierStart } from "./utils";

/**
 * ArrowFunctionParser 类 - 继承 PrimaryParser，添加箭头函数解析功能
 */
export class ArrowFunctionParser extends PrimaryParser {
  /**
   * 尝试解析带括号的箭头函数: (a, b) => expr
   * 使用回溯机制
   */
  protected tryParseArrowFunction(): ArrowFunctionExpr | null {
    const savedPos = this.pos;

    try {
      this.expect("(");
      this.skipWhitespace();

      const params: Identifier[] = [];

      // 解析参数列表
      while (this.peek() !== ")") {
        if (!isIdentifierStart(this.peek())) {
          throw new Error("Expected identifier");
        }
        params.push(this.parseIdentifier());
        this.skipWhitespace();
        if (this.peek() === ",") {
          this.advance();
          this.skipWhitespace();
        } else {
          break;
        }
      }

      this.expect(")");
      this.skipWhitespace();

      // 检查 =>
      if (this.source.slice(this.pos, this.pos + 2) !== "=>") {
        throw new Error("Expected =>");
      }
      this.pos += 2;
      this.skipWhitespace();

      // 解析函数体
      const body = this.parseExpression();

      return {
        type: "ArrowFunctionExpr",
        params,
        body,
      };
    } catch {
      // 回溯
      this.pos = savedPos;
      return null;
    }
  }

  /**
   * 尝试解析单参数无括号的箭头函数: a => expr
   * 使用回溯机制
   */
  protected tryParseSingleParamArrowFunction(): ArrowFunctionExpr | null {
    const savedPos = this.pos;

    try {
      const param = this.parseIdentifier();
      this.skipWhitespace();

      // 检查 =>
      if (this.source.slice(this.pos, this.pos + 2) !== "=>") {
        throw new Error("Expected =>");
      }
      this.pos += 2;
      this.skipWhitespace();

      // 解析函数体
      const body = this.parseExpression();

      return {
        type: "ArrowFunctionExpr",
        params: [param],
        body,
      };
    } catch {
      // 回溯
      this.pos = savedPos;
      return null;
    }
  }
}
