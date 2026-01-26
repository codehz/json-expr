/**
 * 解析器工具函数
 */

/**
 * 判断字符是否为数字 0-9
 */
export function isDigit(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 48 && code <= 57; // 0-9
}

/**
 * 判断字符是否为十六进制数字 0-9, A-F, a-f
 */
export function isHexDigit(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
}

/**
 * 判断字符是否可以作为标识符的开头（字母、下划线、$）
 */
export function isIdentifierStart(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 36;
}

/**
 * 判断字符是否可以作为标识符的一部分（字母、数字、下划线、$）
 */
export function isIdentifierPart(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 95 ||
    code === 36
  );
}
