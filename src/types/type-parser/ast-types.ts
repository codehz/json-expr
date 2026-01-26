// ============================================================================
// AST 节点类型
// ============================================================================

export interface ASTNumber {
  type: "number";
}

export interface ASTString {
  type: "string";
}

export interface ASTBoolean {
  type: "boolean";
}

export interface ASTIdentifier<Name extends string = string> {
  type: "identifier";
  name: Name;
}

export interface ASTBinary<Op extends string = string, Left = unknown, Right = unknown> {
  type: "binary";
  op: Op;
  left: Left;
  right: Right;
}

export interface ASTUnary<Op extends string = string, Operand = unknown> {
  type: "unary";
  op: Op;
  operand: Operand;
}

export interface ASTTernary<Cond = unknown, Then = unknown, Else = unknown> {
  type: "ternary";
  condition: Cond;
  then: Then;
  else: Else;
}

export interface ASTParen<Inner = unknown> {
  type: "paren";
  inner: Inner;
}

export interface ASTMemberAccess<Obj = unknown, Prop extends string = string> {
  type: "member";
  object: Obj;
  property: Prop;
}

export interface ASTComputedMember<Obj = unknown, Index = unknown> {
  type: "computed";
  object: Obj;
  index: Index;
}

export interface ASTCall<Callee = unknown, Args extends unknown[] = unknown[]> {
  type: "call";
  callee: Callee;
  args: Args;
}

export interface ASTUnknown {
  type: "unknown";
}

export interface ASTArray<Elements extends unknown[] = unknown[]> {
  type: "array";
  elements: Elements;
}

export interface ASTObject<Props extends Record<string, unknown> = Record<string, unknown>> {
  type: "object";
  properties: Props;
}

/** 解析结果：[AST, 剩余字符串] */
export type ParseResult<T, Rest extends string> = { ast: T; rest: Rest };

export type ParseError = { error: true };
