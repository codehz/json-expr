/**
 * JavaScript 表达式解析器
 * 将表达式字符串解析为 AST，支持常见的运算符和语法
 */

// AST 节点类型
export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | ConditionalExpr
  | MemberExpr
  | CallExpr
  | ArrayExpr
  | ObjectExpr;

export interface NumberLiteral {
  type: "NumberLiteral";
  value: number;
  raw: string;
}

export interface StringLiteral {
  type: "StringLiteral";
  value: string;
  quote: "'" | '"' | "`";
}

export interface BooleanLiteral {
  type: "BooleanLiteral";
  value: boolean;
}

export interface NullLiteral {
  type: "NullLiteral";
}

export interface Identifier {
  type: "Identifier";
  name: string;
}

export interface BinaryExpr {
  type: "BinaryExpr";
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryExpr {
  type: "UnaryExpr";
  operator: string;
  argument: ASTNode;
  prefix: boolean;
}

export interface ConditionalExpr {
  type: "ConditionalExpr";
  test: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}

export interface MemberExpr {
  type: "MemberExpr";
  object: ASTNode;
  property: ASTNode;
  computed: boolean;
  optional: boolean;
}

export interface CallExpr {
  type: "CallExpr";
  callee: ASTNode;
  arguments: ASTNode[];
  optional: boolean;
}

export interface ArrayExpr {
  type: "ArrayExpr";
  elements: ASTNode[];
}

export interface ObjectExpr {
  type: "ObjectExpr";
  properties: ObjectProperty[];
}

export interface ObjectProperty {
  key: ASTNode;
  value: ASTNode;
  computed: boolean;
  shorthand: boolean;
}

// 运算符优先级（从低到高）
const PRECEDENCE: Record<string, number> = {
  "||": 1,
  "??": 1,
  "&&": 2,
  "|": 3,
  "^": 4,
  "&": 5,
  "==": 6,
  "!=": 6,
  "===": 6,
  "!==": 6,
  "<": 7,
  ">": 7,
  "<=": 7,
  ">=": 7,
  in: 7,
  instanceof: 7,
  "<<": 8,
  ">>": 8,
  ">>>": 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10,
  "**": 11,
};

// 右结合运算符
const RIGHT_ASSOCIATIVE = new Set(["**"]);

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

    if (ch === "!" || ch === "~" || ch === "+" || ch === "-") {
      this.advance();
      this.skipWhitespace();
      const argument = this.parseUnary();
      return {
        type: "UnaryExpr",
        operator: ch,
        argument,
        prefix: true,
      };
    }

    if (this.matchKeyword("typeof")) {
      this.skipWhitespace();
      const argument = this.parseUnary();
      return {
        type: "UnaryExpr",
        operator: "typeof",
        argument,
        prefix: true,
      };
    }

    if (this.matchKeyword("void")) {
      this.skipWhitespace();
      const argument = this.parseUnary();
      return {
        type: "UnaryExpr",
        operator: "void",
        argument,
        prefix: true,
      };
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

    // 括号表达式
    if (ch === "(") {
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

    // 标识符
    if (this.isIdentifierStart(ch)) {
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

  private parseString(): StringLiteral {
    const quote = this.peek() as "'" | '"' | "`";
    this.advance();

    let value = "";
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === "\\") {
        this.advance();
        const escaped = this.peek();
        switch (escaped) {
          case "n":
            value += "\n";
            break;
          case "r":
            value += "\r";
            break;
          case "t":
            value += "\t";
            break;
          case "\\":
            value += "\\";
            break;
          case "'":
            value += "'";
            break;
          case '"':
            value += '"';
            break;
          case "`":
            value += "`";
            break;
          default:
            value += escaped;
        }
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

  private peekOperator(): string | null {
    // 按长度排序，先匹配长的运算符
    const ops = [
      ">>>",
      "===",
      "!==",
      "instanceof",
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

    for (const op of ops) {
      if (this.source.startsWith(op, this.pos)) {
        // 对于 "in" 和 "instanceof"，确保后面不是标识符字符
        if (op === "in" || op === "instanceof") {
          const nextChar = this.source[this.pos + op.length];
          if (nextChar && this.isIdentifierPart(nextChar)) {
            continue;
          }
        }
        return op;
      }
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
    return /[0-9]/.test(ch);
  }

  private isHexDigit(ch: string): boolean {
    return /[0-9a-fA-F]/.test(ch);
  }

  private isIdentifierStart(ch: string): boolean {
    return /[a-zA-Z_$]/.test(ch);
  }

  private isIdentifierPart(ch: string): boolean {
    return /[a-zA-Z0-9_$]/.test(ch);
  }
}

/**
 * 解析 JavaScript 表达式为 AST
 */
export function parse(source: string): ASTNode {
  return new Parser(source).parse();
}

/**
 * 从 AST 生成规范化的代码
 */
export function generate(node: ASTNode): string {
  switch (node.type) {
    case "NumberLiteral":
      return node.raw;

    case "StringLiteral":
      // 使用双引号，转义必要的字符
      return JSON.stringify(node.value);

    case "BooleanLiteral":
      return node.value ? "true" : "false";

    case "NullLiteral":
      return "null";

    case "Identifier":
      return node.name;

    case "BinaryExpr": {
      const left = wrapIfNeeded(node.left, node, "left");
      const right = wrapIfNeeded(node.right, node, "right");
      return `${left}${node.operator}${right}`;
    }

    case "UnaryExpr":
      if (node.prefix) {
        const arg = wrapIfNeeded(node.argument, node, "argument");
        // 对于关键字运算符（typeof, void）需要空格
        if (node.operator === "typeof" || node.operator === "void") {
          return `${node.operator} ${arg}`;
        }
        return `${node.operator}${arg}`;
      }
      return generate(node.argument) + node.operator;

    case "ConditionalExpr": {
      const test = generate(node.test);
      const consequent = generate(node.consequent);
      const alternate = generate(node.alternate);
      return `${test}?${consequent}:${alternate}`;
    }

    case "MemberExpr": {
      const object = wrapIfNeeded(node.object, node, "object");
      if (node.computed) {
        const property = generate(node.property);
        return node.optional ? `${object}?.[${property}]` : `${object}[${property}]`;
      }
      const property = generate(node.property);
      return node.optional ? `${object}?.${property}` : `${object}.${property}`;
    }

    case "CallExpr": {
      const callee = wrapIfNeeded(node.callee, node, "callee");
      const args = node.arguments.map(generate).join(",");
      return node.optional ? `${callee}?.(${args})` : `${callee}(${args})`;
    }

    case "ArrayExpr":
      return `[${node.elements.map(generate).join(",")}]`;

    case "ObjectExpr": {
      const props = node.properties.map((prop) => {
        if (prop.shorthand) {
          return generate(prop.key);
        }
        const key = prop.computed ? `[${generate(prop.key)}]` : generate(prop.key);
        return `${key}:${generate(prop.value)}`;
      });
      return `{${props.join(",")}}`;
    }

    default: {
      const unknownNode = node as { type?: string };
      const nodeType = unknownNode.type ?? "unknown";
      throw new Error(`Unknown node type: ${nodeType}`);
    }
  }
}

/**
 * 判断是否需要括号包裹，并生成代码
 */
function wrapIfNeeded(
  child: ASTNode,
  parent: ASTNode,
  position: "left" | "right" | "argument" | "object" | "callee"
): string {
  const code = generate(child);

  if (needsParens(child, parent, position)) {
    return `(${code})`;
  }
  return code;
}

/**
 * 判断子节点是否需要括号
 */
function needsParens(child: ASTNode, parent: ASTNode, position: string): boolean {
  // 条件表达式在二元表达式中需要括号
  if (child.type === "ConditionalExpr" && parent.type === "BinaryExpr") {
    return true;
  }

  // 二元表达式嵌套时根据优先级判断
  if (child.type === "BinaryExpr" && parent.type === "BinaryExpr") {
    const childPrec = PRECEDENCE[child.operator] || 0;
    const parentPrec = PRECEDENCE[parent.operator] || 0;

    if (childPrec < parentPrec) {
      return true;
    }

    // 相同优先级时，右侧需要括号（除了右结合运算符）
    if (childPrec === parentPrec && position === "right") {
      if (!RIGHT_ASSOCIATIVE.has(parent.operator)) {
        return true;
      }
    }
  }

  // 一元表达式作为二元表达式右侧且运算符是 ** 时需要括号
  if (child.type === "UnaryExpr" && parent.type === "BinaryExpr") {
    if (parent.operator === "**" && position === "left") {
      return true;
    }
  }

  return false;
}

/**
 * 转换 AST 中的标识符
 */
export function transformIdentifiers(node: ASTNode, transform: (name: string) => string): ASTNode {
  switch (node.type) {
    case "Identifier":
      return { ...node, name: transform(node.name) };

    case "BinaryExpr":
      return {
        ...node,
        left: transformIdentifiers(node.left, transform),
        right: transformIdentifiers(node.right, transform),
      };

    case "UnaryExpr":
      return {
        ...node,
        argument: transformIdentifiers(node.argument, transform),
      };

    case "ConditionalExpr":
      return {
        ...node,
        test: transformIdentifiers(node.test, transform),
        consequent: transformIdentifiers(node.consequent, transform),
        alternate: transformIdentifiers(node.alternate, transform),
      };

    case "MemberExpr":
      return {
        ...node,
        object: transformIdentifiers(node.object, transform),
        // 只有 computed 属性需要转换
        property: node.computed ? transformIdentifiers(node.property, transform) : node.property,
      };

    case "CallExpr":
      return {
        ...node,
        callee: transformIdentifiers(node.callee, transform),
        arguments: node.arguments.map((arg) => transformIdentifiers(arg, transform)),
      };

    case "ArrayExpr":
      return {
        ...node,
        elements: node.elements.map((el) => transformIdentifiers(el, transform)),
      };

    case "ObjectExpr":
      return {
        ...node,
        properties: node.properties.map((prop) => ({
          ...prop,
          key: prop.computed ? transformIdentifiers(prop.key, transform) : prop.key,
          value: transformIdentifiers(prop.value, transform),
        })),
      };

    default:
      return node;
  }
}

/**
 * 收集 AST 中所有使用的标识符名称
 */
export function collectIdentifiers(node: ASTNode): Set<string> {
  const identifiers = new Set<string>();

  function visit(n: ASTNode): void {
    switch (n.type) {
      case "Identifier":
        identifiers.add(n.name);
        break;

      case "BinaryExpr":
        visit(n.left);
        visit(n.right);
        break;

      case "UnaryExpr":
        visit(n.argument);
        break;

      case "ConditionalExpr":
        visit(n.test);
        visit(n.consequent);
        visit(n.alternate);
        break;

      case "MemberExpr":
        visit(n.object);
        if (n.computed) {
          visit(n.property);
        }
        break;

      case "CallExpr":
        visit(n.callee);
        n.arguments.forEach(visit);
        break;

      case "ArrayExpr":
        n.elements.forEach(visit);
        break;

      case "ObjectExpr":
        n.properties.forEach((prop) => {
          if (prop.computed) {
            visit(prop.key);
          }
          visit(prop.value);
        });
        break;
    }
  }

  visit(node);
  return identifiers;
}
