import { expect, test } from "bun:test";
import { z } from "zod";
import { compile, constant, evaluate, expr, variable } from "./index";

test("constant: 数字常量", () => {
  const PI = constant(3.14159);
  const compiled = compile(PI, {});
  const result = evaluate<number>(compiled, {});
  expect(result).toBe(3.14159);
});

test("constant: 字符串常量", () => {
  const greeting = constant("Hello, World!");
  const compiled = compile(greeting, {});
  const result = evaluate<string>(compiled, {});
  expect(result).toBe("Hello, World!");
});

test("constant: 布尔常量", () => {
  const flag = constant(true);
  const compiled = compile(flag, {});
  const result = evaluate<boolean>(compiled, {});
  expect(result).toBe(true);
});

test("constant: null 常量", () => {
  const nullVal = constant(null);
  const compiled = compile(nullVal, {});
  const result = evaluate<null>(compiled, {});
  expect(result).toBe(null);
});

test("constant: 数组常量", () => {
  const arr = constant([1, 2, 3]);
  const compiled = compile(arr, {});
  const result = evaluate<number[]>(compiled, {});
  expect(result).toEqual([1, 2, 3]);
});

test("constant: 对象常量", () => {
  const config = constant({ maxRetries: 3, timeout: 5000 });
  const compiled = compile(config, {});
  const result = evaluate<{ maxRetries: number; timeout: number }>(compiled, {});
  expect(result).toEqual({ maxRetries: 3, timeout: 5000 });
});

test("constant: 在表达式中使用常量", () => {
  const PI = constant(3.14159);
  const radius = variable(z.number());
  const area = expr({ PI, radius })("PI * radius * radius");

  const compiled = compile(area, { radius });
  const result = evaluate<number>(compiled, { radius: 2 });
  expect(result).toBeCloseTo(12.56636, 4);
});

test("constant: 多个常量组合", () => {
  const a = constant(10);
  const b = constant(20);
  const sum = expr({ a, b })("a + b");

  const compiled = compile(sum, {});
  const result = evaluate<number>(compiled, {});
  expect(result).toBe(30);
});

test("constant: 常量与变量混合", () => {
  const multiplier = constant(2);
  const x = variable(z.number());
  const doubled = expr({ multiplier, x })("multiplier * x");

  const compiled = compile(doubled, { x });
  const result = evaluate<number>(compiled, { x: 5 });
  expect(result).toBe(10);
});

test("constant: 嵌套对象常量", () => {
  const nested = constant({
    level1: {
      level2: {
        value: 42,
      },
    },
  });
  const compiled = compile(nested, {});
  const result = evaluate<{ level1: { level2: { value: number } } }>(compiled, {});
  expect(result.level1.level2.value).toBe(42);
});

test("constant: source 应为 JSON 字符串", () => {
  const num = constant(42);
  expect(num.source).toBe("42");

  const str = constant("test");
  expect(str.source).toBe('"test"');

  const obj = constant({ a: 1 });
  expect(num._tag).toBe("expression");
  expect(JSON.parse(obj.source)).toEqual({ a: 1 });
});
