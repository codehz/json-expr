import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, t, variable } from "./index";
import { getProxyMetadata } from "./proxy-metadata";

describe("Tagged template t", () => {
  test("should create string expression from template", () => {
    const name = variable<string>();
    const greeting = t`Hello, ${name}!`;

    const meta = getProxyMetadata(greeting as object);
    expect(meta?.type).toBe("expression");
    expect(meta?.source).toContain("Hello");
  });

  test("should compile simple template", () => {
    const name = variable<string>();
    const greeting = t`Hello, ${name}!`;

    const compiled = compile(greeting, { name });
    const result = evaluate(compiled, { name: "World" });
    expect(result).toBe("Hello, World!");
  });

  test("should support multiple interpolations", () => {
    const first = variable<string>();
    const last = variable<string>();
    const fullName = t`${first} ${last}`;

    const compiled = compile(fullName, { first, last });
    const result = evaluate(compiled, { first: "John", last: "Doe" });
    expect(result).toBe("John Doe");
  });

  test("should support number interpolation", () => {
    const count = variable<number>();
    const message = t`You have ${count} items`;

    const compiled = compile(message, { count });
    const result = evaluate(compiled, { count: 5 });
    expect(result).toBe("You have 5 items");
  });

  test("should support expression interpolation", () => {
    const x = variable<number>();
    const doubled = expr({ x })("x * 2");
    const message = t`Double: ${doubled}`;

    const compiled = compile(message, { x });
    const result = evaluate(compiled, { x: 21 });
    expect(result).toBe("Double: 42");
  });

  test("should support static-only template", () => {
    const message = t`Hello, World!`;

    const compiled = compile(message, {});
    const result = evaluate(compiled, {});
    expect(result).toBe("Hello, World!");
  });

  test("should escape backticks in static parts", () => {
    const name = variable<string>();
    // Note: The backtick in the string should be escaped
    const code = t`Code: \`${name}\``;

    const compiled = compile(code, { name });
    const result = evaluate(compiled, { name: "test" });
    expect(result).toBe("Code: `test`");
  });

  test("should handle dollar signs in static parts", () => {
    const amount = variable<number>();
    // 在 tagged template 中，\\$ 会被解析为 \$（字面的反斜杠+美元符号）
    // 如果只需要普通的美元符号，直接使用 $（只有 ${ 才是插值语法）
    const price = t`Price: $${amount}`;

    const compiled = compile(price, { amount });
    const result = evaluate(compiled, { amount: 99 });
    expect(result).toBe("Price: $99");
  });

  test("should support proxy method result interpolation", () => {
    interface Formatter {
      bold(text: string): string;
    }
    const fmt = variable<Formatter>();
    const name = variable<string>();
    const message = t`Hello, ${fmt.bold(name)}!`;

    const compiled = compile(message, { fmt, name });
    const result = evaluate(compiled, {
      fmt: { bold: (t: string) => `**${t}**` },
      name: "World",
    });
    expect(result).toBe("Hello, **World**!");
  });

  test("should support array interpolation", () => {
    const items = variable<string[]>();
    const list = t`Items: ${items}`;

    const compiled = compile(list, { items });
    const result = evaluate(compiled, { items: ["a", "b"] });
    expect(result).toBe("Items: a,b");
  });
});
