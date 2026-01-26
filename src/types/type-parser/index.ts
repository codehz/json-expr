// ============================================================================
// 类型解析器 - 统一导出
// ============================================================================

// 工具类型
export type { GlobalTypeMap, IsDigit, IsIdentifierChar, IsIdentifierStart, ReservedWords, TrimStart } from "./utils";

// 上下文相关
export type { ContextTypeMap, ExtractType, FindUndefinedIdentifiers } from "./context";

// 标识符提取
export type { ExtractIdentifiers, ParseIdentifier } from "./identifiers";

// AST 类型
export type {
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
  ASTUnknown,
  ParseError,
  ParseResult,
} from "./ast-types";

// 解析器
export type { ParseExpression } from "./expression-parser";

// 类型推导
export type { InferTypeFromAST } from "./type-inference";

// ============================================================================
// 主要导出类型
// ============================================================================

import type { ContextTypeMap, FindUndefinedIdentifiers } from "./context";
import type { ParseExpression } from "./expression-parser";
import type { ExtractIdentifiers } from "./identifiers";
import type { InferTypeFromAST } from "./type-inference";

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
