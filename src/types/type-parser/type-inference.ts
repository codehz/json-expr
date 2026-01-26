import type {
  ASTArray,
  ASTBinary,
  ASTBoolean,
  ASTCall,
  ASTComputedMember,
  ASTIdentifier,
  ASTMemberAccess,
  ASTNumber,
  ASTObject,
  ASTParen,
  ASTString,
  ASTTernary,
  ASTUnary,
} from "./ast-types";
import type { GlobalTypeMap } from "./utils";

// ============================================================================
// 类型推导
// ============================================================================

/** 推导数组元素类型 */
type InferArrayElements<Elements extends unknown[], TypeMap, Result extends unknown[] = []> = Elements extends [
  infer First,
  ...infer Rest,
]
  ? InferArrayElements<Rest, TypeMap, [...Result, InferTypeFromAST<First, TypeMap>]>
  : Result;

/** 推导对象属性类型 */
type InferObjectProperties<Props, TypeMap> = {
  [K in keyof Props]: InferTypeFromAST<Props[K], TypeMap>;
};

/** 从 AST 推导类型 */
export type InferTypeFromAST<AST, TypeMap> = AST extends ASTNumber
  ? number
  : AST extends ASTString
    ? string
    : AST extends ASTBoolean
      ? boolean
      : AST extends ASTArray<infer Elements>
        ? InferArrayElements<Elements, TypeMap>
        : AST extends ASTObject<infer Props>
          ? InferObjectProperties<Props, TypeMap>
          : AST extends ASTIdentifier<infer Name>
            ? Name extends keyof GlobalTypeMap
              ? GlobalTypeMap[Name]
              : Name extends keyof TypeMap
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
                      : AST extends ASTComputedMember<infer Obj, infer _Index>
                        ? InferComputedMemberType<InferTypeFromAST<Obj, TypeMap>>
                        : AST extends ASTCall<infer Callee, infer __Args>
                          ? InferCallType<InferTypeFromAST<Callee, TypeMap>>
                          : unknown;

/** 一元运算符类型推导 */
type InferUnaryType<Op extends string, __Operand> = Op extends "!"
  ? boolean
  : Op extends "-" | "+"
    ? number
    : Op extends "typeof"
      ? string
      : Op extends "~"
        ? number
        : unknown;

/** 二元运算符类型推导 */
type InferBinaryType<Op extends string, Left, Right> = Op extends "+"
  ? Left extends string
    ? Right extends string
      ? string
      : string | number
    : Right extends string
      ? string | number
      : Left extends bigint
        ? Right extends bigint
          ? bigint
          : unknown
        : Left extends number
          ? Right extends number
            ? number
            : number | string
          : unknown
  : Op extends "-" | "*" | "/" | "%" | "**"
    ? Left extends bigint
      ? Right extends bigint
        ? bigint
        : unknown
      : number
    : Op extends "&" | "|" | "^" | "<<" | ">>" | ">>>"
      ? Left extends bigint
        ? Right extends bigint
          ? bigint
          : unknown
        : number
      : Op extends "<" | ">" | "<=" | ">=" | "==" | "!=" | "===" | "!==" | "in" | "instanceof"
        ? boolean
        : Op extends "&&"
          ? Left extends false
            ? Left
            : Right
          : Op extends "||"
            ? Left extends true
              ? Left
              : Right
            : Op extends "??"
              ? Left extends null | undefined
                ? Right
                : Exclude<Left, null | undefined> | Right
              : unknown;

/** 成员访问类型推导 - 分布式处理联合类型，跳过 null/undefined */
type InferMemberType<Obj, Prop extends string> = Prop extends keyof NonNullable<Obj> ? NonNullable<Obj>[Prop] : unknown;

/** 计算属性访问类型推导 */
type InferComputedMemberType<Obj> = Obj extends readonly (infer T)[]
  ? T
  : Obj extends { [index: number]: infer T }
    ? T
    : Obj extends Record<string, infer V>
      ? V
      : unknown;

/** 函数调用类型推导 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InferCallType<Callee> = Callee extends (...args: any[]) => infer R ? R : unknown;
