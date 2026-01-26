/**
 * 表达式解析器 - 负责解析各种表达式（二元运算、一元运算、条件表达式等）
 */

import type { ASTNode } from "../../types/ast-types";
import { PRECEDENCE, RIGHT_ASSOCIATIVE } from "../../types/ast-types";
import { ArrowFunctionParser } from "./arrow-function-parser";
import { isDigit, isIdentifierStart } from "./utils";

/**
 * ExpressionParser 类 - 继承 ArrowFunctionParser，实现完整的表达式解析功能
 */
export class ExpressionParser extends ArrowFunctionParser {
  /**
   * 解析表达式的入口
   */
  protected override parseExpression(): ASTNode {
    return this.parseConditional();
  }

  /**
   * 解析条件（三元）表达式: test ? consequent : alternate
   */
  protected parseConditional(): ASTNode {
    let node = this.parseBinary(0);

    this.skipWhitespace();
    if (this.peek() === "?") {
      this.advance();
      this.skipWhitespace();
      const consequent = this.parseExpression();
      this.skipWhitespace();
      this.expect(":");
      this.skipWhitespace();
      const alternate = this.parseExpression();
      node = {
        type: "ConditionalExpr",
        test: node,
        consequent,
        alternate,
      };
    }

    return node;
  }

  /**
   * 解析二元表达式，使用优先级爬升算法
   */
  protected parseBinary(minPrec: number): ASTNode {
    let left = this.parseUnary();

    while (true) {
      this.skipWhitespace();
      const op = this.peekOperator();
      if (!op || PRECEDENCE[op] === undefined || PRECEDENCE[op] < minPrec) {
        break;
      }

      this.pos += op.length;
      this.skipWhitespace();

      const nextMinPrec = RIGHT_ASSOCIATIVE.has(op) ? PRECEDENCE[op] : PRECEDENCE[op] + 1;

      const right = this.parseBinary(nextMinPrec);

      left = {
        type: "BinaryExpr",
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * 解析一元表达式
   */
  protected parseUnary(): ASTNode {
    this.skipWhitespace();
    const ch = this.peek();

    // Single-character unary operators
    if (ch === "!" || ch === "~" || ch === "+" || ch === "-") {
      this.advance();
      this.skipWhitespace();
      return {
        type: "UnaryExpr",
        operator: ch,
        argument: this.parseUnary(),
        prefix: true,
      };
    }

    // Keyword unary operators
    for (const keyword of ["typeof", "void"] as const) {
      if (this.matchKeyword(keyword)) {
        this.skipWhitespace();
        return {
          type: "UnaryExpr",
          operator: keyword,
          argument: this.parseUnary(),
          prefix: true,
        };
      }
    }

    return this.parsePostfix();
  }

  /**
   * 解析后缀表达式（成员访问、函数调用、可选链等）
   */
  protected parsePostfix(): ASTNode {
    let node = this.parsePrimary();

    while (true) {
      this.skipWhitespace();
      const ch = this.peek();

      if (ch === ".") {
        this.advance();
        this.skipWhitespace();
        const property = this.parseIdentifier();
        node = {
          type: "MemberExpr",
          object: node,
          property,
          computed: false,
          optional: false,
        };
      } else if (ch === "[") {
        this.advance();
        this.skipWhitespace();
        const property = this.parseExpression();
        this.skipWhitespace();
        this.expect("]");
        node = {
          type: "MemberExpr",
          object: node,
          property,
          computed: true,
          optional: false,
        };
      } else if (ch === "(") {
        this.advance();
        const args = this.parseArguments();
        this.expect(")");
        node = {
          type: "CallExpr",
          callee: node,
          arguments: args,
          optional: false,
        };
      } else if (ch === "?" && this.peekAt(1) === ".") {
        this.advance();
        this.advance();
        this.skipWhitespace();
        if (this.peek() === "[") {
          this.advance();
          this.skipWhitespace();
          const property = this.parseExpression();
          this.skipWhitespace();
          this.expect("]");
          node = {
            type: "MemberExpr",
            object: node,
            property,
            computed: true,
            optional: true,
          };
        } else if (this.peek() === "(") {
          this.advance();
          const args = this.parseArguments();
          this.expect(")");
          node = {
            type: "CallExpr",
            callee: node,
            arguments: args,
            optional: true,
          };
        } else {
          const property = this.parseIdentifier();
          node = {
            type: "MemberExpr",
            object: node,
            property,
            computed: false,
            optional: true,
          };
        }
      } else {
        break;
      }
    }

    return node;
  }

  /**
   * 解析基本表达式（字面量、标识符、括号表达式、箭头函数等）
   */
  protected parsePrimary(): ASTNode {
    this.skipWhitespace();
    const ch = this.peek();

    // 数字
    if (isDigit(ch) || (ch === "." && isDigit(this.peekAt(1)))) {
      return this.parseNumber();
    }

    // 字符串
    if (ch === '"' || ch === "'" || ch === "`") {
      return this.parseString();
    }

    // 数组
    if (ch === "[") {
      return this.parseArray();
    }

    // 对象
    if (ch === "{") {
      return this.parseObject();
    }

    // 括号表达式或箭头函数参数列表
    if (ch === "(") {
      const arrowFunc = this.tryParseArrowFunction();
      if (arrowFunc) return arrowFunc;

      this.advance();
      this.skipWhitespace();
      const expr = this.parseExpression();
      this.skipWhitespace();
      this.expect(")");
      return expr;
    }

    // 关键字字面量
    if (this.matchKeyword("true")) {
      return { type: "BooleanLiteral", value: true };
    }
    if (this.matchKeyword("false")) {
      return { type: "BooleanLiteral", value: false };
    }
    if (this.matchKeyword("null")) {
      return { type: "NullLiteral" };
    }
    if (this.matchKeyword("undefined")) {
      return { type: "Identifier", name: "undefined" };
    }

    // 标识符（可能是单参数箭头函数）
    if (isIdentifierStart(ch)) {
      const arrowFunc = this.tryParseSingleParamArrowFunction();
      if (arrowFunc) return arrowFunc;

      return this.parseIdentifier();
    }

    throw new Error(`Unexpected character at position ${this.pos}: ${ch}`);
  }

  /**
   * 解析函数调用参数列表
   */
  protected parseArguments(): ASTNode[] {
    const args: ASTNode[] = [];
    this.skipWhitespace();
    while (this.peek() !== ")") {
      args.push(this.parseExpression());
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.advance();
        this.skipWhitespace();
      } else {
        break;
      }
    }
    return args;
  }
}
