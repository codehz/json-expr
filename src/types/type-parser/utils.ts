// ============================================================================
// 工具类型
// ============================================================================

/** 去除字符串两端空白 */
export type TrimStart<S extends string> = S extends ` ${infer Rest}` | `\t${infer Rest}` | `\n${infer Rest}`
  ? TrimStart<Rest>
  : S;

/** 是否是字母或下划线 */
export type IsIdentifierStart<C extends string> = C extends
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
export type IsIdentifierChar<C extends string> =
  IsIdentifierStart<C> extends true
    ? true
    : C extends "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
      ? true
      : false;

/** 是否是数字 */
export type IsDigit<C extends string> = C extends "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  ? true
  : false;

/** 全局类型映射 */
export interface GlobalTypeMap {
  Math: Math;
  JSON: JSON;
  Number: NumberConstructor;
  String: StringConstructor;
  Boolean: BooleanConstructor;
  Array: ArrayConstructor;
  Object: ObjectConstructor;
  Date: DateConstructor;
  RegExp: RegExpConstructor;
  undefined: undefined;
  NaN: number;
  Infinity: number;
  parseInt: typeof globalThis.parseInt;
  parseFloat: typeof globalThis.parseFloat;
  isNaN: typeof globalThis.isNaN;
  isFinite: typeof globalThis.isFinite;
}

/** JS保留字和全局对象 */
export type ReservedWords =
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
  | keyof GlobalTypeMap;
