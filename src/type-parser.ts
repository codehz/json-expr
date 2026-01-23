import type { z } from "zod";
import type { Expression, Variable } from "./types";

// ============================================================================
// 工具类型
// ============================================================================

/** 去除字符串两端空白 */
type TrimStart<S extends string> = S extends ` ${infer Rest}` | `\t${infer Rest}` | `\n${infer Rest}`
  ? TrimStart<Rest>
  : S;

type __TrimEnd<S extends string> = S extends `${infer Rest} ` | `${infer Rest}\t` | `${infer Rest}\n`
  ? __TrimEnd<Rest>
  : S;

type __Trim<S extends string> = TrimStart<__TrimEnd<S>>;

/** 字符串是否以某前缀开头 */
type _StartsWith<S extends string, Prefix extends string> = S extends `${Prefix}${string}` ? true : false;

/** 是否是字母或下划线 */
type IsIdentifierStart<C extends string> = C extends
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z"
  | "_"
  | "$"
  ? true
  : false;

/** 是否是标识符字符（字母、数字、下划线） */
type IsIdentifierChar<C extends string> =
  IsIdentifierStart<C> extends true
    ? true
    : C extends "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
      ? true
      : false;

/** 是否是数字 */
type IsDigit<C extends string> = C extends "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ? true : false;

/** 是否是运算符字符 */
type _IsOperatorChar<C extends string> = C extends
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "="
  | "!"
  | "<"
  | ">"
  | "&"
  | "|"
  | "^"
  | "~"
  | "?"
  ? true
  : false;

/** JS保留字和全局对象 */
type ReservedWords =
  | "true"
  | "false"
  | "null"
  | "undefined"
  | "if"
  | "else"
  | "for"
  | "while"
  | "do"
  | "switch"
  | "case"
  | "break"
  | "continue"
  | "return"
  | "function"
  | "var"
  | "let"
  | "const"
  | "class"
  | "new"
  | "this"
  | "typeof"
  | "instanceof"
  | "Math"
  | "Number"
  | "String"
  | "Boolean"
  | "Array"
  | "Object"
  | "Date"
  | "JSON"
  | "parseInt"
  | "parseFloat"
  | "isNaN"
  | "isFinite"
  | "NaN"
  | "Infinity";

// ============================================================================
// 标识符提取
// ============================================================================

/** 解析一个标识符，返回 [标识符, 剩余字符串] */
type ParseIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
  ? IsIdentifierChar<C> extends true
    ? ParseIdentifier<Rest, `${Acc}${C}`>
    : [Acc, S]
  : [Acc, S];

/** 跳过数字字面量 */
type SkipNumber<S extends string> = S extends `${infer C}${infer Rest}`
  ? C extends "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "."
    ? SkipNumber<Rest>
    : S
  : S;

/** 跳过字符串字面量（单引号） */
type SkipSingleQuoteString<S extends string> = S extends `'${infer Rest}` ? SkipSingleQuoteStringContent<Rest> : S;

type SkipSingleQuoteStringContent<S extends string> = S extends `\\'${infer Rest}`
  ? SkipSingleQuoteStringContent<Rest>
  : S extends `'${infer Rest}`
    ? Rest
    : S extends `${string}${infer Rest}`
      ? SkipSingleQuoteStringContent<Rest>
      : S;

/** 跳过字符串字面量（双引号） */
type SkipDoubleQuoteString<S extends string> = S extends `"${infer Rest}` ? SkipDoubleQuoteStringContent<Rest> : S;

type SkipDoubleQuoteStringContent<S extends string> = S extends `\\"${infer Rest}`
  ? SkipDoubleQuoteStringContent<Rest>
  : S extends `"${infer Rest}`
    ? Rest
    : S extends `${string}${infer Rest}`
      ? SkipDoubleQuoteStringContent<Rest>
      : S;

/** 跳过模板字符串 */
type SkipTemplateString<S extends string> = S extends `\`${infer Rest}` ? SkipTemplateStringContent<Rest> : S;

type SkipTemplateStringContent<S extends string> = S extends `\\\`${infer Rest}`
  ? SkipTemplateStringContent<Rest>
  : S extends `\`${infer Rest}`
    ? Rest
    : S extends `${string}${infer Rest}`
      ? SkipTemplateStringContent<Rest>
      : S;

/**
 * 从表达式字符串中提取所有标识符（排除保留字）
 * 返回标识符的联合类型
 */
type ExtractIdentifiers<S extends string, Collected extends string = never> = S extends ""
  ? Collected
  : TrimStart<S> extends `${infer Trimmed}`
    ? Trimmed extends ""
      ? Collected
      : Trimmed extends `'${string}`
        ? ExtractIdentifiers<SkipSingleQuoteString<Trimmed>, Collected>
        : Trimmed extends `"${string}`
          ? ExtractIdentifiers<SkipDoubleQuoteString<Trimmed>, Collected>
          : Trimmed extends `\`${string}`
            ? ExtractIdentifiers<SkipTemplateString<Trimmed>, Collected>
            : Trimmed extends `${infer First}${infer Rest}`
              ? IsIdentifierStart<First> extends true
                ? ParseIdentifier<Trimmed> extends [infer Id extends string, infer Remaining extends string]
                  ? Id extends ReservedWords
                    ? ExtractIdentifiers<Remaining, Collected>
                    : ExtractIdentifiers<Remaining, Collected | Id>
                  : Collected
                : IsDigit<First> extends true
                  ? ExtractIdentifiers<SkipNumber<Trimmed>, Collected>
                  : ExtractIdentifiers<Rest, Collected>
              : Collected
    : Collected;

// ============================================================================
// 上下文验证
// ============================================================================

/** 从 Variable 或 Expression 提取值类型 */
export type ExtractType<T> =
  T extends Variable<infer Schema> ? z.infer<Schema> : T extends Expression<unknown, infer R> ? R : never;

/** 从上下文对象构建类型映射 */
export type ContextTypeMap<TContext> = {
  [K in keyof TContext]: ExtractType<TContext[K]>;
};

/** 检查所有标识符是否都在上下文中定义 */
type _ValidateIdentifiers<Ids extends string, ContextKeys extends string> = Ids extends ContextKeys ? true : false;

/** 找出未定义的标识符 */
type FindUndefinedIdentifiers<Ids extends string, ContextKeys extends string> = Ids extends ContextKeys ? never : Ids;

// ============================================================================
// 类型推导 - AST 定义
// ============================================================================

// AST 节点类型
interface ASTNumber {
  type: "number";
}
interface ASTString {
  type: "string";
}
interface ASTBoolean {
  type: "boolean";
}
interface ASTIdentifier<Name extends string = string> {
  type: "identifier";
  name: Name;
}
interface ASTBinary<Op extends string = string, Left = unknown, Right = unknown> {
  type: "binary";
  op: Op;
  left: Left;
  right: Right;
}
interface ASTUnary<Op extends string = string, Operand = unknown> {
  type: "unary";
  op: Op;
  operand: Operand;
}
interface ASTTernary<Cond = unknown, Then = unknown, Else = unknown> {
  type: "ternary";
  condition: Cond;
  then: Then;
  else: Else;
}
interface ASTParen<Inner = unknown> {
  type: "paren";
  inner: Inner;
}
interface ASTMemberAccess<Obj = unknown, Prop extends string = string> {
  type: "member";
  object: Obj;
  property: Prop;
}
interface ASTCall<Callee = unknown, Args extends unknown[] = unknown[]> {
  type: "call";
  callee: Callee;
  args: Args;
}
interface ASTUnknown {
  type: "unknown";
}

// ============================================================================
// 表达式解析器
// ============================================================================

/** 运算符优先级（从低到高） */
// Level 1: || (逻辑或)
// Level 2: && (逻辑与)
// Level 3: | (位或)
// Level 4: ^ (位异或)
// Level 5: & (位与)
// Level 6: ==, !=, ===, !== (相等)
// Level 7: <, >, <=, >= (比较)
// Level 8: +, - (加减)
// Level 9: *, /, % (乘除)
// Level 10: 一元运算符
// Level 11: 成员访问、函数调用

/** 解析结果：[AST, 剩余字符串] */
type ParseResult<T, Rest extends string> = { ast: T; rest: Rest };
type ParseError = { error: true };

/** 解析三元表达式（最低优先级）- 右结合 */
type ParseTernary<S extends string> =
  ParseLogicalOr<TrimStart<S>> extends ParseResult<infer Left, infer Rest1>
    ? TrimStart<Rest1> extends `?${infer AfterQ}`
      ? ParseTernary<AfterQ> extends ParseResult<infer Then, infer Rest2>
        ? TrimStart<Rest2> extends `:${infer AfterColon}`
          ? ParseTernary<AfterColon> extends ParseResult<infer Else, infer Rest3>
            ? ParseResult<ASTTernary<Left, Then, Else>, Rest3>
            : ParseResult<Left, Rest1>
          : ParseResult<Left, Rest1>
        : ParseResult<Left, Rest1>
      : ParseResult<Left, Rest1>
    : ParseError;

/** 解析逻辑或 || */
type ParseLogicalOr<S extends string> =
  ParseLogicalAnd<TrimStart<S>> extends ParseResult<infer Left, infer Rest>
    ? ParseLogicalOrTail<Left, Rest>
    : ParseError;

type ParseLogicalOrTail<Left, S extends string> =
  TrimStart<S> extends `||${infer Rest}`
    ? ParseLogicalAnd<Rest> extends ParseResult<infer Right, infer Rest2>
      ? ParseLogicalOrTail<ASTBinary<"||", Left, Right>, Rest2>
      : ParseResult<Left, S>
    : ParseResult<Left, S>;

/** 解析逻辑与 && */
type ParseLogicalAnd<S extends string> =
  ParseEquality<TrimStart<S>> extends ParseResult<infer Left, infer Rest>
    ? ParseLogicalAndTail<Left, Rest>
    : ParseError;

type ParseLogicalAndTail<Left, S extends string> =
  TrimStart<S> extends `&&${infer Rest}`
    ? ParseEquality<Rest> extends ParseResult<infer Right, infer Rest2>
      ? ParseLogicalAndTail<ASTBinary<"&&", Left, Right>, Rest2>
      : ParseResult<Left, S>
    : ParseResult<Left, S>;

/** 解析相等性运算符 */
type ParseEquality<S extends string> =
  ParseComparison<TrimStart<S>> extends ParseResult<infer Left, infer Rest>
    ? ParseEqualityTail<Left, Rest>
    : ParseError;

type ParseEqualityTail<Left, S extends string> =
  TrimStart<S> extends `===${infer Rest}`
    ? ParseComparison<Rest> extends ParseResult<infer Right, infer Rest2>
      ? ParseEqualityTail<ASTBinary<"===", Left, Right>, Rest2>
      : ParseResult<Left, S>
    : TrimStart<S> extends `!==${infer Rest}`
      ? ParseComparison<Rest> extends ParseResult<infer Right, infer Rest2>
        ? ParseEqualityTail<ASTBinary<"!==", Left, Right>, Rest2>
        : ParseResult<Left, S>
      : TrimStart<S> extends `==${infer Rest}`
        ? Rest extends `=${string}`
          ? ParseResult<Left, S> // 排除 ===
          : ParseComparison<Rest> extends ParseResult<infer Right, infer Rest2>
            ? ParseEqualityTail<ASTBinary<"==", Left, Right>, Rest2>
            : ParseResult<Left, S>
        : TrimStart<S> extends `!=${infer Rest}`
          ? Rest extends `=${string}`
            ? ParseResult<Left, S> // 排除 !==
            : ParseComparison<Rest> extends ParseResult<infer Right, infer Rest2>
              ? ParseEqualityTail<ASTBinary<"!=", Left, Right>, Rest2>
              : ParseResult<Left, S>
          : ParseResult<Left, S>;

/** 解析比较运算符 */
type ParseComparison<S extends string> =
  ParseAdditive<TrimStart<S>> extends ParseResult<infer Left, infer Rest>
    ? ParseComparisonTail<Left, Rest>
    : ParseError;

type ParseComparisonTail<Left, S extends string> =
  TrimStart<S> extends `<=${infer Rest}`
    ? ParseAdditive<Rest> extends ParseResult<infer Right, infer Rest2>
      ? ParseComparisonTail<ASTBinary<"<=", Left, Right>, Rest2>
      : ParseResult<Left, S>
    : TrimStart<S> extends `>=${infer Rest}`
      ? ParseAdditive<Rest> extends ParseResult<infer Right, infer Rest2>
        ? ParseComparisonTail<ASTBinary<">=", Left, Right>, Rest2>
        : ParseResult<Left, S>
      : TrimStart<S> extends `<${infer Rest}`
        ? Rest extends `=${string}`
          ? ParseResult<Left, S> // 排除 <=
          : ParseAdditive<Rest> extends ParseResult<infer Right, infer Rest2>
            ? ParseComparisonTail<ASTBinary<"<", Left, Right>, Rest2>
            : ParseResult<Left, S>
        : TrimStart<S> extends `>${infer Rest}`
          ? Rest extends `=${string}`
            ? ParseResult<Left, S> // 排除 >=
            : ParseAdditive<Rest> extends ParseResult<infer Right, infer Rest2>
              ? ParseComparisonTail<ASTBinary<">", Left, Right>, Rest2>
              : ParseResult<Left, S>
          : ParseResult<Left, S>;

/** 解析加减运算符 */
type ParseAdditive<S extends string> =
  ParseMultiplicative<TrimStart<S>> extends ParseResult<infer Left, infer Rest>
    ? ParseAdditiveTail<Left, Rest>
    : ParseError;

type ParseAdditiveTail<Left, S extends string> =
  TrimStart<S> extends `+${infer Rest}`
    ? ParseMultiplicative<Rest> extends ParseResult<infer Right, infer Rest2>
      ? ParseAdditiveTail<ASTBinary<"+", Left, Right>, Rest2>
      : ParseResult<Left, S>
    : TrimStart<S> extends `-${infer Rest}`
      ? ParseMultiplicative<Rest> extends ParseResult<infer Right, infer Rest2>
        ? ParseAdditiveTail<ASTBinary<"-", Left, Right>, Rest2>
        : ParseResult<Left, S>
      : ParseResult<Left, S>;

/** 解析乘除运算符 */
type ParseMultiplicative<S extends string> =
  ParseUnary<TrimStart<S>> extends ParseResult<infer Left, infer Rest>
    ? ParseMultiplicativeTail<Left, Rest>
    : ParseError;

type ParseMultiplicativeTail<Left, S extends string> =
  TrimStart<S> extends `*${infer Rest}`
    ? ParseUnary<Rest> extends ParseResult<infer Right, infer Rest2>
      ? ParseMultiplicativeTail<ASTBinary<"*", Left, Right>, Rest2>
      : ParseResult<Left, S>
    : TrimStart<S> extends `/${infer Rest}`
      ? ParseUnary<Rest> extends ParseResult<infer Right, infer Rest2>
        ? ParseMultiplicativeTail<ASTBinary<"/", Left, Right>, Rest2>
        : ParseResult<Left, S>
      : TrimStart<S> extends `%${infer Rest}`
        ? ParseUnary<Rest> extends ParseResult<infer Right, infer Rest2>
          ? ParseMultiplicativeTail<ASTBinary<"%", Left, Right>, Rest2>
          : ParseResult<Left, S>
        : ParseResult<Left, S>;

/** 解析一元运算符 */
type ParseUnary<S extends string> =
  TrimStart<S> extends `!${infer Rest}`
    ? ParseUnary<Rest> extends ParseResult<infer Operand, infer Rest2>
      ? ParseResult<ASTUnary<"!", Operand>, Rest2>
      : ParseError
    : TrimStart<S> extends `-${infer Rest}`
      ? IsDigit<Rest extends `${infer C}${string}` ? C : ""> extends true
        ? ParsePostfix<S> // 负数字面量
        : ParseUnary<Rest> extends ParseResult<infer Operand, infer Rest2>
          ? ParseResult<ASTUnary<"-", Operand>, Rest2>
          : ParseError
      : TrimStart<S> extends `+${infer Rest}`
        ? ParseUnary<Rest> extends ParseResult<infer Operand, infer Rest2>
          ? ParseResult<ASTUnary<"+", Operand>, Rest2>
          : ParseError
        : ParsePostfix<S>;

/** 解析后缀运算符（成员访问、函数调用） */
type ParsePostfix<S extends string> =
  ParsePrimary<TrimStart<S>> extends ParseResult<infer Base, infer Rest> ? ParsePostfixTail<Base, Rest> : ParseError;

type ParsePostfixTail<Base, S extends string> =
  TrimStart<S> extends `.${infer Rest}`
    ? ParseIdentifier<TrimStart<Rest>> extends [infer Prop extends string, infer Rest2 extends string]
      ? Prop extends ""
        ? ParseResult<Base, S>
        : ParsePostfixTail<ASTMemberAccess<Base, Prop>, Rest2>
      : ParseResult<Base, S>
    : TrimStart<S> extends `[${infer Rest}`
      ? ParseTernary<Rest> extends ParseResult<infer _Index, infer Rest2>
        ? TrimStart<Rest2> extends `]${infer Rest3}`
          ? ParsePostfixTail<ASTMemberAccess<Base, "[computed]">, Rest3>
          : ParseResult<Base, S>
        : ParseResult<Base, S>
      : TrimStart<S> extends `(${infer Rest}`
        ? ParseCallArgs<Rest> extends { args: infer Args extends unknown[]; rest: infer Rest2 extends string }
          ? ParsePostfixTail<ASTCall<Base, Args>, Rest2>
          : ParseResult<Base, S>
        : ParseResult<Base, S>;

/** 解析函数调用参数 */
type ParseCallArgs<S extends string, Args extends unknown[] = []> =
  TrimStart<S> extends `)${infer Rest}`
    ? { args: Args; rest: Rest }
    : ParseTernary<S> extends ParseResult<infer Arg, infer Rest>
      ? TrimStart<Rest> extends `,${infer Rest2}`
        ? ParseCallArgs<Rest2, [...Args, Arg]>
        : TrimStart<Rest> extends `)${infer Rest2}`
          ? { args: [...Args, Arg]; rest: Rest2 }
          : { args: Args; rest: S }
      : { args: Args; rest: S };

/** 解析数字字面量，返回 [数字字符串, 剩余] */
type ParseNumberLiteral<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
  ? C extends "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "."
    ? ParseNumberLiteral<Rest, `${Acc}${C}`>
    : [Acc, S]
  : [Acc, S];

/** 解析主表达式 */
type ParsePrimary<S extends string> =
  TrimStart<S> extends `(${infer Rest}`
    ? ParseTernary<Rest> extends ParseResult<infer Inner, infer Rest2>
      ? TrimStart<Rest2> extends `)${infer Rest3}`
        ? ParseResult<ASTParen<Inner>, Rest3>
        : ParseError
      : ParseError
    : TrimStart<S> extends `true${infer Rest}`
      ? IsIdentifierChar<Rest extends `${infer C}${string}` ? C : ""> extends true
        ? ParseIdentifierPrimary<S>
        : ParseResult<ASTBoolean, Rest>
      : TrimStart<S> extends `false${infer Rest}`
        ? IsIdentifierChar<Rest extends `${infer C}${string}` ? C : ""> extends true
          ? ParseIdentifierPrimary<S>
          : ParseResult<ASTBoolean, Rest>
        : TrimStart<S> extends `${infer C}${infer __Rest}`
          ? IsDigit<C> extends true
            ? ParseNumberLiteral<TrimStart<S>> extends [infer __Num, infer Rest2 extends string]
              ? ParseResult<ASTNumber, Rest2>
              : ParseError
            : C extends "-"
              ? TrimStart<__Rest> extends `${infer C2}${string}`
                ? IsDigit<C2> extends true
                  ? ParseNumberLiteral<TrimStart<__Rest>> extends [infer __Num, infer Rest2 extends string]
                    ? ParseResult<ASTNumber, Rest2>
                    : ParseError
                  : ParseError
                : ParseError
              : C extends "'" | '"' | "`"
                ? ParseStringLiteral<TrimStart<S>> extends { rest: infer Rest2 extends string }
                  ? ParseResult<ASTString, Rest2>
                  : ParseError
                : IsIdentifierStart<C> extends true
                  ? ParseIdentifierPrimary<S>
                  : ParseError
          : ParseError;

type ParseIdentifierPrimary<S extends string> =
  ParseIdentifier<TrimStart<S>> extends [infer Name extends string, infer Rest extends string]
    ? Name extends ""
      ? ParseError
      : ParseResult<ASTIdentifier<Name>, Rest>
    : ParseError;

type ParseStringLiteral<S extends string> = S extends `'${infer __}`
  ? { rest: SkipSingleQuoteString<S> }
  : S extends `"${infer __}`
    ? { rest: SkipDoubleQuoteString<S> }
    : S extends `\`${infer __}`
      ? { rest: SkipTemplateString<S> }
      : never;

/** 解析表达式入口 */
export type ParseExpression<S extends string> =
  ParseTernary<S> extends ParseResult<infer AST, infer Rest>
    ? TrimStart<Rest> extends ""
      ? AST
      : ASTUnknown // 有剩余未解析的内容
    : ASTUnknown;

// ============================================================================
// 类型推导
// ============================================================================

/** 从 AST 推导类型 */
export type InferTypeFromAST<AST, TypeMap> = AST extends ASTNumber
  ? number
  : AST extends ASTString
    ? string
    : AST extends ASTBoolean
      ? boolean
      : AST extends ASTIdentifier<infer Name>
        ? Name extends keyof TypeMap
          ? TypeMap[Name]
          : unknown
        : AST extends ASTUnary<infer Op, infer __Operand>
          ? InferUnaryType<Op, InferTypeFromAST<__Operand, TypeMap>>
          : AST extends ASTBinary<infer Op, infer Left, infer Right>
            ? InferBinaryType<Op, InferTypeFromAST<Left, TypeMap>, InferTypeFromAST<Right, TypeMap>>
            : AST extends ASTTernary<infer __Cond, infer Then, infer Else>
              ? InferTypeFromAST<Then, TypeMap> | InferTypeFromAST<Else, TypeMap>
              : AST extends ASTParen<infer Inner>
                ? InferTypeFromAST<Inner, TypeMap>
                : AST extends ASTMemberAccess<infer Obj, infer Prop>
                  ? InferMemberType<InferTypeFromAST<Obj, TypeMap>, Prop>
                  : AST extends ASTCall<infer Callee, infer __Args>
                    ? InferCallType<InferTypeFromAST<Callee, TypeMap>>
                    : unknown;

/** 一元运算符类型推导 */
type InferUnaryType<Op extends string, __Operand> = Op extends "!" ? boolean : Op extends "-" | "+" ? number : unknown;

/** 二元运算符类型推导 */
type InferBinaryType<Op extends string, Left, Right> = Op extends "+"
  ? Left extends string
    ? Right extends string
      ? string
      : string | number
    : Right extends string
      ? string | number
      : Left extends number
        ? Right extends number
          ? number
          : number | string
        : unknown
  : Op extends "-" | "*" | "/" | "%"
    ? number
    : Op extends "<" | ">" | "<=" | ">=" | "==" | "!=" | "===" | "!=="
      ? boolean
      : Op extends "&&"
        ? Left extends false
          ? Left
          : Right
        : Op extends "||"
          ? Left extends true
            ? Left
            : Right
          : unknown;

/** 成员访问类型推导 */
type InferMemberType<Obj, Prop extends string> =
  Obj extends Record<string, unknown> ? (Prop extends keyof Obj ? Obj[Prop] : unknown) : unknown;

/** 函数调用类型推导 */
type InferCallType<Callee> = Callee extends (...args: unknown[]) => infer R ? R : unknown;

// ============================================================================
// 主要导出类型
// ============================================================================

/** 表达式验证结果 */
export type ValidateExpression<Source extends string, TContext> =
  ExtractIdentifiers<Source> extends infer Ids extends string
    ? keyof TContext extends infer Keys extends string
      ? FindUndefinedIdentifiers<Ids, Keys> extends never
        ? true
        : { error: "undefined_identifiers"; identifiers: FindUndefinedIdentifiers<Ids, Keys> }
      : { error: "invalid_context" }
    : { error: "parse_error" };

/** 从表达式推导返回类型 */
export type InferExpressionResult<Source extends string, TContext> = InferTypeFromAST<
  ParseExpression<Source>,
  ContextTypeMap<TContext>
>;

/** 验证并推导表达式类型 */
export type ExpressionType<Source extends string, TContext> =
  ValidateExpression<Source, TContext> extends true
    ? InferExpressionResult<Source, TContext>
    : ValidateExpression<Source, TContext>;
