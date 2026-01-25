/**
 * AST 节点类型定义
 */

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

// AST 节点类型定义
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

// 运算符优先级（从低到高）
export const PRECEDENCE: Record<string, number> = {
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
export const RIGHT_ASSOCIATIVE = new Set(["**"]);

// 内置构造函数列表
export const BUILTIN_CONSTRUCTORS = new Set([
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
