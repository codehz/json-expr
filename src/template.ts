import { collectDepsFromArgs, createProxyExpressionWithSource, serializeArgument } from "./proxy-variable";
import type { Proxify } from "./types";

/**
 * 转义字符串字面量中的特殊字符
 */
function escapeStringLiteral(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Tagged template 函数，用于创建包含变量的字符串表达式
 *
 * @example
 * ```ts
 * const name = variable<string>();
 * const count = variable<number>();
 *
 * const greeting = t`Hello, ${name}!`;
 * const message = t`You have ${count} items.`;
 *
 * const compiled = compile(greeting, { name });
 * const result = evaluate(compiled, { name: "Alice" }); // => "Hello, Alice!"
 * ```
 */
export function t(strings: TemplateStringsArray, ...values: unknown[]): Proxify<string> {
  // 收集所有依赖
  const deps = new Set<symbol>();
  collectDepsFromArgs(values, deps);

  // 构建字符串拼接表达式的各个部分
  const parts: string[] = [];

  for (let i = 0; i < strings.length; i++) {
    const str = strings[i]!;
    // 添加静态字符串部分（作为字符串字面量）
    if (str.length > 0) {
      parts.push(`"${escapeStringLiteral(str)}"`);
    }

    if (i < values.length) {
      // 序列化插值部分
      const serialized = serializeArgument(values[i]);
      parts.push(serialized);
    }
  }

  // 如果没有任何部分，返回空字符串
  if (parts.length === 0) {
    return createProxyExpressionWithSource<string>('""', deps);
  }

  // 如果只有一个部分且是字符串字面量，直接返回
  if (parts.length === 1) {
    return createProxyExpressionWithSource<string>(parts[0]!, deps);
  }

  // 用 + 连接所有部分，加括号确保优先级
  const source = "(" + parts.join(" + ") + ")";

  return createProxyExpressionWithSource<string>(source, deps);
}
