/**
 * 解析器常量定义
 */

/**
 * 运算符列表，按长度排序（长的在前）以确保正确匹配
 */
export const OPERATORS = [
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
] as const;

/**
 * 关键字运算符（需要后面不能跟标识符字符）
 */
export const KEYWORD_OPERATORS = new Set(["in", "instanceof"]);

/**
 * 转义字符映射
 */
export const ESCAPE_CHARS: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  "\\": "\\",
  "'": "'",
  '"': '"',
  "`": "`",
};
