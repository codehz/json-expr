import { describe, expect, test } from "bun:test";
import { compile, constant, evaluate, expr, variable } from "./index";
import { getProxyMetadata } from "./proxy-metadata";

describe("constant 单元测试", () => {
  describe("基本常量类型", () => {
    test("数字常量", () => {
      const PI = constant(3.14159);
      const compiled = compile(PI, {});
      const result = evaluate<number>(compiled, {});
      expect(result).toBe(3.14159);
    });

    test("字符串常量", () => {
      const greeting = constant("Hello, World!");
      const compiled = compile(greeting, {});
      const result = evaluate<string>(compiled, {});
      expect(result).toBe("Hello, World!");
    });

    test("布尔常量", () => {
      const flag = constant(true);
      const compiled = compile(flag, {});
      const result = evaluate<boolean>(compiled, {});
      expect(result).toBe(true);
    });

    test("null 常量", () => {
      const nullVal = constant(null);
      const compiled = compile(nullVal, {});
      const result = evaluate<null>(compiled, {});
      expect(result).toBe(null);
    });

    test("数组常量", () => {
      const arr = constant([1, 2, 3]);
      // Proxify<T[]> 返回代理数组，需要通过 expr 使用
      const wrapped = expr({ arr })("arr");
      const compiled = compile(wrapped, {});
      const result = evaluate<number[]>(compiled, {});
      expect(result).toEqual([1, 2, 3]);
    });

    test("对象常量", () => {
      const config = constant({ maxRetries: 3, timeout: 5000 });
      // Proxify<object> 返回代理对象，需要通过 expr 使用
      const wrapped = expr({ config })("config");
      const compiled = compile(wrapped, {});
      const result = evaluate<{ maxRetries: number; timeout: number }>(compiled, {});
      expect(result).toEqual({ maxRetries: 3, timeout: 5000 });
    });

    test("嵌套对象常量", () => {
      const nested = constant({
        level1: {
          level2: {
            value: 42,
          },
        },
      });
      // Proxify<object> 返回代理对象，需要通过 expr 使用
      const wrapped = expr({ nested })("nested");
      const compiled = compile(wrapped, {});
      const result = evaluate<{ level1: { level2: { value: number } } }>(compiled, {});
      expect(result.level1.level2.value).toBe(42);
    });
  });

  describe("常量在表达式中的使用", () => {
    test("在表达式中使用常量", () => {
      const PI = constant(3.14159);
      const radius = variable<number>();
      const area = expr({ PI, radius })("PI * radius * radius");

      const compiled = compile(area, { radius });
      const result = evaluate<number>(compiled, { radius: 2 });
      expect(result).toBeCloseTo(12.56636, 4);
    });

    test("多个常量组合", () => {
      const a = constant(10);
      const b = constant(20);
      const sum = expr({ a, b })("a + b");

      const compiled = compile(sum, {});
      const result = evaluate<number>(compiled, {});
      expect(result).toBe(30);
    });

    test("常量与变量混合", () => {
      const multiplier = constant(2);
      const x = variable<number>();
      const doubled = expr({ multiplier, x })("multiplier * x");

      const compiled = compile(doubled, { x });
      const result = evaluate<number>(compiled, { x: 5 });
      expect(result).toBe(10);
    });
  });

  describe("常量属性验证", () => {
    test("source 应为 JSON 字符串", () => {
      const num = constant(42);
      const numMeta = getProxyMetadata(num as object);
      expect(numMeta?.source).toBe("42");

      const str = constant("test");
      const strMeta = getProxyMetadata(str as object);
      expect(strMeta?.source).toBe('"test"');

      const obj = constant({ a: 1 });
      const objMeta = getProxyMetadata(obj as object);
      expect(numMeta?.type).toBe("expression");
      expect(JSON.parse(objMeta?.source ?? "{}")).toEqual({ a: 1 });
    });
  });
});
