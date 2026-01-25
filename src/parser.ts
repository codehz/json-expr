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
  | ObjectExpr
  | ArrowFunctionExpr;

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

export interface ArrowFunctionExpr {
  type: "ArrowFunctionExpr";
  params: Identifier[];
  body: ASTNode;
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

// 内置构造函数列表
const BUILTIN_CONSTRUCTORS = new Set([
  "Date",
  "RegExp",
  "URL",
  "URLSearchParams",
  "Map",
  "Set",
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
  "ArrayBuffer",
  "DataView",
]);

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

/**
 * 代码生成上下文
 * 用于在嵌套 lambda 中分配唯一参数名
 */
interface GenerateContext {
  /** lambda 参数计数器，用于生成唯一参数名 */
  lambdaParamCounter: number;
  /** 占位符到实际参数名的映射 */
  paramMapping: Map<string, string>;
}

/**
 * 创建新的生成上下文
 */
function createGenerateContext(): GenerateContext {
  return {
    lambdaParamCounter: 0,
    paramMapping: new Map(),
  };
}

/**
 * 从 AST 生成规范化的代码
 */
export function generate(node: ASTNode): string {
  const ctx = createGenerateContext();
  return generateWithContext(node, ctx);
}

/**
 * 带上下文的代码生成
 */
function generateWithContext(node: ASTNode, ctx: GenerateContext): string {
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

    case "Identifier": {
      // 检查是否是 lambda 参数占位符
      const mappedName = ctx.paramMapping.get(node.name);
      return mappedName ?? node.name;
    }

    case "BinaryExpr": {
      const left = wrapIfNeededWithContext(node.left, node, "left", ctx);
      const right = wrapIfNeededWithContext(node.right, node, "right", ctx);
      // 关键字运算符需要空格
      if (node.operator === "in" || node.operator === "instanceof") {
        return `${left} ${node.operator} ${right}`;
      }
      return `${left}${node.operator}${right}`;
    }

    case "UnaryExpr":
      if (node.prefix) {
        const arg = wrapIfNeededWithContext(node.argument, node, "argument", ctx);
        // 对于关键字运算符（typeof, void）需要空格
        if (node.operator === "typeof" || node.operator === "void") {
          return `${node.operator} ${arg}`;
        }
        return `${node.operator}${arg}`;
      }
      return generateWithContext(node.argument, ctx) + node.operator;

    case "ConditionalExpr": {
      const test = wrapIfNeededWithContext(node.test, node, "test", ctx);
      const consequent = wrapIfNeededWithContext(node.consequent, node, "consequent", ctx);
      const alternate = wrapIfNeededWithContext(node.alternate, node, "alternate", ctx);
      return `${test}?${consequent}:${alternate}`;
    }

    case "MemberExpr": {
      const object = wrapIfNeededWithContext(node.object, node, "object", ctx);
      const property = generateWithContext(node.property, ctx);
      return node.computed
        ? `${object}${node.optional ? "?." : ""}[${property}]`
        : `${object}${node.optional ? "?." : "."}${property}`;
    }

    case "CallExpr": {
      const callee = wrapIfNeededWithContext(node.callee, node, "callee", ctx);
      const args = node.arguments.map((arg) => generateWithContext(arg, ctx)).join(",");
      const isNew = node.callee.type === "Identifier" && BUILTIN_CONSTRUCTORS.has(node.callee.name);
      return `${isNew ? "new " : ""}${callee}${node.optional ? "?." : ""}(${args})`;
    }

    case "ArrayExpr":
      return `[${node.elements.map((el) => generateWithContext(el, ctx)).join(",")}]`;

    case "ObjectExpr": {
      const props = node.properties.map((prop) => {
        if (prop.shorthand) {
          return generateWithContext(prop.key, ctx);
        }
        const key = prop.computed ? `[${generateWithContext(prop.key, ctx)}]` : generateWithContext(prop.key, ctx);
        return `${key}:${generateWithContext(prop.value, ctx)}`;
      });
      return `{${props.join(",")}}`;
    }

    case "ArrowFunctionExpr": {
      // 为每个参数分配唯一的参数名
      const paramNames: string[] = [];
      for (const param of node.params) {
        const uniqueName = `_${ctx.lambdaParamCounter++}`;
        paramNames.push(uniqueName);
        // 建立占位符到实际参数名的映射
        ctx.paramMapping.set(param.name, uniqueName);
      }

      const paramsStr = paramNames.length === 1 ? paramNames[0]! : `(${paramNames.join(",")})`;
      const body =
        node.body.type === "ObjectExpr"
          ? `(${generateWithContext(node.body, ctx)})`
          : generateWithContext(node.body, ctx);

      // 清理参数映射（可选，防止污染外层作用域）
      // 注意：由于我们使用唯一的参数名，不清理也不会冲突
      // 但为了语义清晰，在函数体生成完成后移除映射
      for (const param of node.params) {
        ctx.paramMapping.delete(param.name);
      }

      return `${paramsStr}=>${body}`;
    }

    default: {
      const unknownNode = node as { type?: string };
      const nodeType = unknownNode.type ?? "unknown";
      throw new Error(`Unknown node type: ${nodeType}`);
    }
  }
}

/**
 * 判断是否需要括号包裹，并生成代码（带上下文版本）
 */
function wrapIfNeededWithContext(
  child: ASTNode,
  parent: ASTNode,
  position: "left" | "right" | "argument" | "object" | "callee" | "test" | "consequent" | "alternate",
  ctx: GenerateContext
): string {
  const code = generateWithContext(child, ctx);

  if (needsParens(child, parent, position)) {
    return `(${code})`;
  }
  return code;
}

/**
 * 判断子节点是否需要括号
 */
function needsParens(child: ASTNode, parent: ASTNode, position: string): boolean {
  switch (parent.type) {
    case "BinaryExpr": {
      if (child.type === "ConditionalExpr" || child.type === "UnaryExpr") return true;
      if (child.type === "BinaryExpr") {
        const childPrec = PRECEDENCE[child.operator] ?? 0;
        const parentPrec = PRECEDENCE[parent.operator] ?? 0;
        if (childPrec < parentPrec) return true;
        if (childPrec === parentPrec && position === "right" && !RIGHT_ASSOCIATIVE.has(parent.operator)) return true;
      }
      return false;
    }

    case "UnaryExpr":
      return position === "argument" && (child.type === "BinaryExpr" || child.type === "ConditionalExpr");

    case "MemberExpr":
    case "CallExpr": {
      if (position !== "object" && position !== "callee") return false;
      if (["BinaryExpr", "ConditionalExpr", "UnaryExpr", "ArrowFunctionExpr", "ObjectExpr"].includes(child.type)) {
        return true;
      }
      // 处理 (42).toString() 这种整数紧跟点号的情况
      if (child.type === "NumberLiteral" && parent.type === "MemberExpr" && !parent.computed) {
        return !child.raw.includes(".") && !child.raw.includes("e") && !child.raw.includes("x");
      }
      return false;
    }

    case "ConditionalExpr":
      return position === "test" && child.type === "ConditionalExpr";

    default:
      return false;
  }
}

/**
 * 转换 AST 中的标识符
 * 回调函数可以返回：
 * - string: 替换标识符名称
 * - ASTNode: 内联该 AST 节点（用于子表达式内联）
 */
export function transformIdentifiers(node: ASTNode, transform: (name: string) => string | ASTNode): ASTNode {
  switch (node.type) {
    case "Identifier": {
      const result = transform(node.name);
      // 如果返回 ASTNode，直接内联；否则替换名称
      return typeof result === "string" ? { ...node, name: result } : result;
    }

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

    case "ArrowFunctionExpr": {
      // 箭头函数：参数名不转换，只转换函数体中的非参数标识符
      const paramNames = new Set(node.params.map((p) => p.name));
      return {
        ...node,
        body: transformIdentifiers(node.body, (name) => (paramNames.has(name) ? name : transform(name))),
      };
    }

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

      case "ArrowFunctionExpr": {
        // 箭头函数：收集参数名和函数体中的标识符
        // 但从闭包角度，只需收集非参数的自由变量
        const paramNames = new Set(n.params.map((p) => p.name));
        const bodyIdentifiers = collectIdentifiers(n.body);
        for (const id of bodyIdentifiers) {
          if (!paramNames.has(id)) {
            identifiers.add(id);
          }
        }
        break;
      }
    }
  }

  visit(node);
  return identifiers;
}
