/**
 * 基本类型解析器 - 负责解析字面量、标识符、数组、对象等基本类型
 */

import type {
  ASTNode,
  ArrayExpr,
  Identifier,
  NumberLiteral,
  ObjectExpr,
  ObjectProperty,
  StringLiteral,
} from "../../types/ast-types";
import { ESCAPE_CHARS } from "./constants";
import { Tokenizer } from "./tokenizer";
import { isDigit, isHexDigit, isIdentifierPart } from "./utils";

/**
 * PrimaryParser 类 - 继承 Tokenizer，提供基本类型的解析功能
 */
export class PrimaryParser extends Tokenizer {
  /**
   * 解析数字字面量
   */
  protected parseNumber(): NumberLiteral {
    const start = this.pos;

    // 处理十六进制、八进制、二进制
    if (this.peek() === "0") {
      const next = this.peekAt(1)?.toLowerCase();
      if (next === "x" || next === "o" || next === "b") {
        this.advance();
        this.advance();
        while (isHexDigit(this.peek())) {
          this.advance();
        }
        const raw = this.source.slice(start, this.pos);
        return {
          type: "NumberLiteral",
          value: Number(raw),
          raw,
        };
      }
    }

    // 整数部分
    while (isDigit(this.peek())) {
      this.advance();
    }

    // 小数部分
    if (this.peek() === "." && isDigit(this.peekAt(1))) {
      this.advance();
      while (isDigit(this.peek())) {
        this.advance();
      }
    }

    // 指数部分
    if (this.peek()?.toLowerCase() === "e") {
      this.advance();
      if (this.peek() === "+" || this.peek() === "-") {
        this.advance();
      }
      while (isDigit(this.peek())) {
        this.advance();
      }
    }

    const raw = this.source.slice(start, this.pos);
    return {
      type: "NumberLiteral",
      value: Number(raw),
      raw,
    };
  }

  /**
   * 解析字符串字面量
   */
  protected parseString(): StringLiteral {
    const quote = this.peek() as "'" | '"' | "`";
    this.advance();

    let value = "";
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === "\\") {
        this.advance();
        const escaped = this.peek();
        value += ESCAPE_CHARS[escaped] ?? escaped;
        this.advance();
      } else {
        value += this.peek();
        this.advance();
      }
    }

    this.expect(quote);
    return { type: "StringLiteral", value, quote };
  }

  /**
   * 解析数组字面量
   */
  protected parseArray(): ArrayExpr {
    this.expect("[");
    const elements: ASTNode[] = [];

    this.skipWhitespace();
    while (this.peek() !== "]") {
      elements.push(this.parseExpression());
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.advance();
        this.skipWhitespace();
      } else {
        break;
      }
    }

    this.expect("]");
    return { type: "ArrayExpr", elements };
  }

  /**
   * 解析对象字面量
   */
  protected parseObject(): ObjectExpr {
    this.expect("{");
    const properties: ObjectProperty[] = [];

    this.skipWhitespace();
    while (this.peek() !== "}") {
      const prop = this.parseObjectProperty();
      properties.push(prop);
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.advance();
        this.skipWhitespace();
      } else {
        break;
      }
    }

    this.expect("}");
    return { type: "ObjectExpr", properties };
  }

  /**
   * 解析对象属性
   */
  protected parseObjectProperty(): ObjectProperty {
    this.skipWhitespace();
    let key: ASTNode;
    let computed = false;

    if (this.peek() === "[") {
      this.advance();
      this.skipWhitespace();
      key = this.parseExpression();
      this.skipWhitespace();
      this.expect("]");
      computed = true;
    } else if (this.peek() === '"' || this.peek() === "'") {
      key = this.parseString();
    } else {
      key = this.parseIdentifier();
    }

    this.skipWhitespace();
    if (this.peek() === ":") {
      this.advance();
      this.skipWhitespace();
      const value = this.parseExpression();
      return { key, value, computed, shorthand: false };
    }

    // Shorthand property
    if (key.type !== "Identifier") {
      throw new Error("Shorthand property must be an identifier");
    }
    return { key, value: key, computed: false, shorthand: true };
  }

  /**
   * 解析标识符
   */
  protected parseIdentifier(): Identifier {
    const start = this.pos;
    while (isIdentifierPart(this.peek())) {
      this.advance();
    }
    const name = this.source.slice(start, this.pos);
    if (!name) {
      throw new Error(`Expected identifier at position ${this.pos}`);
    }
    return { type: "Identifier", name };
  }

  /**
   * 解析表达式 - 需要在子类中实现
   */
  protected parseExpression(): ASTNode {
    throw new Error("parseExpression must be implemented in subclass");
  }
}
