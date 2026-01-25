/**
 * JavaScript 表达式解析器
 * 将表达式字符串解析为 AST，支持常见的运算符和语法
 */

import type {
  ASTNode,
  ArrayExpr,
  ArrowFunctionExpr,
  Identifier,
  NumberLiteral,
  ObjectExpr,
  ObjectProperty,
  StringLiteral,
} from "./ast-types";
import { PRECEDENCE, RIGHT_ASSOCIATIVE } from "./ast-types";

class Parser {
  private pos = 0;
  private source: string;

  constructor(source: string) {
    this.source = source;
  }

  parse(): ASTNode {
    this.skipWhitespace();
    const node = this.parseExpression();
    this.skipWhitespace();
    if (this.pos < this.source.length) {
      throw new Error(`Unexpected token at position ${this.pos}: ${this.source.slice(this.pos, this.pos + 10)}`);
    }
    return node;
  }

  private parseExpression(): ASTNode {
    return this.parseConditional();
  }

  private parseConditional(): ASTNode {
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

  private parseBinary(minPrec: number): ASTNode {
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

  private parseUnary(): ASTNode {
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

  private parsePostfix(): ASTNode {
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

  private parsePrimary(): ASTNode {
    this.skipWhitespace();
    const ch = this.peek();

    // 数字
    if (this.isDigit(ch) || (ch === "." && this.isDigit(this.peekAt(1)))) {
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
    if (this.isIdentifierStart(ch)) {
      const arrowFunc = this.tryParseSingleParamArrowFunction();
      if (arrowFunc) return arrowFunc;

      return this.parseIdentifier();
    }

    throw new Error(`Unexpected character at position ${this.pos}: ${ch}`);
  }

  private parseNumber(): NumberLiteral {
    const start = this.pos;

    // 处理十六进制、八进制、二进制
    if (this.peek() === "0") {
      const next = this.peekAt(1)?.toLowerCase();
      if (next === "x" || next === "o" || next === "b") {
        this.advance();
        this.advance();
        while (this.isHexDigit(this.peek())) {
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
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // 小数部分
    if (this.peek() === "." && this.isDigit(this.peekAt(1))) {
      this.advance();
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    // 指数部分
    if (this.peek()?.toLowerCase() === "e") {
      this.advance();
      if (this.peek() === "+" || this.peek() === "-") {
        this.advance();
      }
      while (this.isDigit(this.peek())) {
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

  private static readonly ESCAPE_CHARS: Record<string, string> = {
    n: "\n",
    r: "\r",
    t: "\t",
    "\\": "\\",
    "'": "'",
    '"': '"',
    "`": "`",
  };

  private parseString(): StringLiteral {
    const quote = this.peek() as "'" | '"' | "`";
    this.advance();

    let value = "";
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === "\\") {
        this.advance();
        const escaped = this.peek();
        value += Parser.ESCAPE_CHARS[escaped] ?? escaped;
        this.advance();
      } else {
        value += this.peek();
        this.advance();
      }
    }

    this.expect(quote);
    return { type: "StringLiteral", value, quote };
  }

  private parseArray(): ArrayExpr {
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

  private parseObject(): ObjectExpr {
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

  private parseObjectProperty(): ObjectProperty {
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

  private parseIdentifier(): Identifier {
    const start = this.pos;
    while (this.isIdentifierPart(this.peek())) {
      this.advance();
    }
    const name = this.source.slice(start, this.pos);
    if (!name) {
      throw new Error(`Expected identifier at position ${this.pos}`);
    }
    return { type: "Identifier", name };
  }

  /**
   * 尝试解析带括号的箭头函数: (a, b) => expr
   * 使用回溯机制
   */
  private tryParseArrowFunction(): ArrowFunctionExpr | null {
    const savedPos = this.pos;

    try {
      this.expect("(");
      this.skipWhitespace();

      const params: Identifier[] = [];

      // 解析参数列表
      while (this.peek() !== ")") {
        if (!this.isIdentifierStart(this.peek())) {
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
  private tryParseSingleParamArrowFunction(): ArrowFunctionExpr | null {
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

  private parseArguments(): ASTNode[] {
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

  // Operators sorted by length (longest first) to ensure correct matching
  private static readonly OPERATORS = [
    // 10 chars
    "instanceof",
    // 3 chars
    ">>>",
    "===",
    "!==",
    // 2 chars
    "&&",
    "||",
    "??",
    "==",
    "!=",
    "<=",
    ">=",
    "<<",
    ">>",
    "**",
    "in",
    // 1 char
    "+",
    "-",
    "*",
    "/",
    "%",
    "<",
    ">",
    "&",
    "|",
    "^",
  ];

  private static readonly KEYWORD_OPERATORS = new Set(["in", "instanceof"]);

  private peekOperator(): string | null {
    for (const op of Parser.OPERATORS) {
      if (!this.source.startsWith(op, this.pos)) continue;

      // Keyword operators must not be followed by identifier characters
      if (Parser.KEYWORD_OPERATORS.has(op)) {
        const nextChar = this.source[this.pos + op.length];
        if (nextChar && this.isIdentifierPart(nextChar)) continue;
      }

      return op;
    }
    return null;
  }

  private matchKeyword(keyword: string): boolean {
    if (this.source.startsWith(keyword, this.pos)) {
      const nextChar = this.source[this.pos + keyword.length];
      if (!nextChar || !this.isIdentifierPart(nextChar)) {
        this.pos += keyword.length;
        return true;
      }
    }
    return false;
  }

  private peek(): string {
    return this.source[this.pos] || "";
  }

  private peekAt(offset: number): string {
    return this.source[this.pos + offset] || "";
  }

  private advance(): string {
    return this.source[this.pos++] || "";
  }

  private expect(ch: string): void {
    if (this.peek() !== ch) {
      throw new Error(`Expected '${ch}' at position ${this.pos}, got '${this.peek()}'`);
    }
    this.advance();
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.advance();
    }
  }

  private isDigit(ch: string): boolean {
    const code = ch.charCodeAt(0);
    return code >= 48 && code <= 57; // 0-9
  }

  private isHexDigit(ch: string): boolean {
    const code = ch.charCodeAt(0);
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
  }

  private isIdentifierStart(ch: string): boolean {
    const code = ch.charCodeAt(0);
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 36;
  }

  private isIdentifierPart(ch: string): boolean {
    const code = ch.charCodeAt(0);
    return (
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 95 ||
      code === 36
    );
  }
}

/**
 * 解析 JavaScript 表达式为 AST
 */
export function parse(source: string): ASTNode {
  return new Parser(source).parse();
}
