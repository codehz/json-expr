/**
 * 词法分析器 - 负责源代码的逐字符扫描和标记识别
 */

import { KEYWORD_OPERATORS, OPERATORS } from "./constants";
import { isIdentifierPart } from "./utils";

/**
 * Tokenizer 类 - 提供词法分析的基础功能
 */
export class Tokenizer {
  protected pos = 0;
  protected source: string;

  constructor(source: string) {
    this.source = source;
  }

  /**
   * 查看当前位置的字符，不移动位置
   */
  protected peek(): string {
    return this.source[this.pos] || "";
  }

  /**
   * 查看指定偏移量位置的字符，不移动位置
   */
  protected peekAt(offset: number): string {
    return this.source[this.pos + offset] || "";
  }

  /**
   * 前进一个字符并返回该字符
   */
  protected advance(): string {
    return this.source[this.pos++] || "";
  }

  /**
   * 期望当前字符是指定字符，否则抛出错误
   */
  protected expect(ch: string): void {
    if (this.peek() !== ch) {
      throw new Error(`Expected '${ch}' at position ${this.pos}, got '${this.peek()}'`);
    }
    this.advance();
  }

  /**
   * 跳过空白字符
   */
  protected skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.advance();
    }
  }

  /**
   * 尝试匹配并消费运算符
   * 返回匹配到的运算符，如果没有匹配则返回 null
   */
  protected peekOperator(): string | null {
    for (const op of OPERATORS) {
      if (!this.source.startsWith(op, this.pos)) continue;

      // Keyword operators must not be followed by identifier characters
      if (KEYWORD_OPERATORS.has(op)) {
        const nextChar = this.source[this.pos + op.length];
        if (nextChar && isIdentifierPart(nextChar)) continue;
      }

      return op;
    }
    return null;
  }

  /**
   * 尝试匹配并消费关键字
   * 如果匹配成功则移动位置并返回 true，否则返回 false
   */
  protected matchKeyword(keyword: string): boolean {
    if (this.source.startsWith(keyword, this.pos)) {
      const nextChar = this.source[this.pos + keyword.length];
      if (!nextChar || !isIdentifierPart(nextChar)) {
        this.pos += keyword.length;
        return true;
      }
    }
    return false;
  }
}
