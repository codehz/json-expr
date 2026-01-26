import type { IsDigit, IsIdentifierChar, IsIdentifierStart, ReservedWords, TrimStart } from "./utils";

// ============================================================================
// 标识符提取
// ============================================================================

/** 解析一个标识符，返回 [标识符, 剩余字符串] */
export type ParseIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
  ? IsIdentifierChar<C> extends true
    ? ParseIdentifier<Rest, `${Acc}${C}`>
    : [Acc, S]
  : [Acc, S];

/** 跳过数字字面量 */
export type SkipNumber<S extends string> = S extends `${infer C}${infer Rest}`
  ? C extends "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "."
    ? SkipNumber<Rest>
    : S
  : S;

/** 跳过字符串字面量（单引号） */
export type SkipSingleQuoteString<S extends string> = S extends `'${infer Rest}`
  ? SkipSingleQuoteStringContent<Rest>
  : S;

type SkipSingleQuoteStringContent<S extends string> = S extends `\\'${infer Rest}`
  ? SkipSingleQuoteStringContent<Rest>
  : S extends `'${infer Rest}`
    ? Rest
    : S extends `${string}${infer Rest}`
      ? SkipSingleQuoteStringContent<Rest>
      : S;

/** 跳过字符串字面量（双引号） */
export type SkipDoubleQuoteString<S extends string> = S extends `"${infer Rest}`
  ? SkipDoubleQuoteStringContent<Rest>
  : S;

type SkipDoubleQuoteStringContent<S extends string> = S extends `\\"${infer Rest}`
  ? SkipDoubleQuoteStringContent<Rest>
  : S extends `"${infer Rest}`
    ? Rest
    : S extends `${string}${infer Rest}`
      ? SkipDoubleQuoteStringContent<Rest>
      : S;

/** 跳过模板字符串 */
export type SkipTemplateString<S extends string> = S extends `\`${infer Rest}` ? SkipTemplateStringContent<Rest> : S;

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
export type ExtractIdentifiers<S extends string, Collected extends string = never> = S extends ""
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
