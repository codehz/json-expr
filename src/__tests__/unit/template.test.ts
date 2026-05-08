import { describe, expect, test } from "bun:test";
import { generate } from "../../core/generate";
import { expr, t, variable } from "../../index";
import { getProxyMetadata } from "../../proxy/proxy-metadata";
import { compileAndEvaluate } from "./test-helper";

describe("模板标签 单元测试", () => {
  test("从模板创建字符串表达式", () => {
    const name = variable<string>();
    const greeting = t`Hello, ${name}!`;

    const meta = getProxyMetadata(greeting);
    expect(meta?.type).toBe("expression");
    expect(meta?.ast).toBeDefined();
    if (meta?.ast) {
      const source = generate(meta.ast);
      expect(source).toContain("Hello");
    }
  });

  test("编译简单模板", () => {
    const name = variable<string>();
    const greeting = t`Hello, ${name}!`;

    const result = compileAndEvaluate(greeting, { name }, { name: "World" });
    expect(result).toBe("Hello, World!");
  });

  test("支持多重插值", () => {
    const first = variable<string>();
    const last = variable<string>();
    const fullName = t`${first} ${last}`;

    const result = compileAndEvaluate(fullName, { first, last }, { first: "John", last: "Doe" });
    expect(result).toBe("John Doe");
  });

  test("支持数字插值", () => {
    const count = variable<number>();
    const message = t`You have ${count} items`;

    const result = compileAndEvaluate(message, { count }, { count: 5 });
    expect(result).toBe("You have 5 items");
  });

  test("支持表达式插值", () => {
    const x = variable<number>();
    const doubled = expr({ x })("x * 2");
    const message = t`Double: ${doubled}`;

    const result = compileAndEvaluate(message, { x }, { x: 21 });
    expect(result).toBe("Double: 42");
  });

  test("支持纯静态模板", () => {
    const message = t`Hello, World!`;

    const result = compileAndEvaluate(message, {}, {});
    expect(result).toBe("Hello, World!");
  });

  test("转义静态部分中的反引号", () => {
    const name = variable<string>();
    // Note: The backtick in the string should be escaped
    const code = t`Code: \`${name}\``;

    const result = compileAndEvaluate(code, { name }, { name: "test" });
    expect(result).toBe("Code: `test`");
  });

  test("处理静态部分中的美元符号", () => {
    const amount = variable<number>();
    // 在 tagged template 中，\\$ 会被解析为 \$（字面的反斜杠+美元符号）
    // 如果只需要普通的美元符号，直接使用 $（只有 ${ 才是插值语法）
    const price = t`Price: $${amount}`;

    const result = compileAndEvaluate(price, { amount }, { amount: 99 });
    expect(result).toBe("Price: $99");
  });

  test("支持代理方法结果插值", () => {
    interface Formatter {
      bold(text: string): string;
    }
    const fmt = variable<Formatter>();
    const name = variable<string>();
    const message = t`Hello, ${fmt.bold(name)}!`;

    const result = compileAndEvaluate(
      message,
      { fmt, name },
      {
        fmt: { bold: (t: string) => `**${t}**` },
        name: "World",
      }
    );
    expect(result).toBe("Hello, **World**!");
  });

  test("支持数组插值", () => {
    const items = variable<string[]>();
    const list = t`Items: ${items}`;

    const result = compileAndEvaluate(list, { items }, { items: ["a", "b"] });
    expect(result).toBe("Items: a,b");
  });
});
