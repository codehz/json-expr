/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, lambda, variable, type ProxyExpression } from "./index";

// 辅助类型：将 Proxy 表达式转换为可编译类型
// 由于 Proxy 类型系统与 TypeScript 内置数组类型的兼容性问题，需要使用类型断言
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type Compilable<T> = ProxyExpression<T> & any;

describe("lambda 函数", () => {
  describe("基础功能", () => {
    test("单参数 lambda + expr", () => {
      const numbers = variable<number[]>();
      const doubled = numbers.map(lambda<[number], number>((n) => expr({ n })("n * 2")));

      const compiled = compile(doubled as Compilable<number[]>, { numbers });
      expect(compiled[0]).toEqual(["numbers"]);
      // 表达式包含箭头函数
      expect(compiled[1]).toContain("=>");

      const result = evaluate(compiled, { numbers: [1, 2, 3] });
      expect(result).toEqual([2, 4, 6]);
    });

    test("多参数 lambda + expr", () => {
      const numbers = variable<number[]>();
      const sum = numbers.reduce(
        lambda<[number, number], number>((acc, val) => expr({ acc, val })("acc + val")),
        0
      );

      const compiled = compile(sum as Compilable<number>, { numbers });
      expect(compiled[0]).toEqual(["numbers"]);

      const result = evaluate(compiled, { numbers: [1, 2, 3, 4, 5] });
      expect(result).toBe(15);
    });

    test("lambda 访问属性", () => {
      const items = variable<{ value: number }[]>();
      const values = items.map(lambda<[{ value: number }], number>((item) => item.value));

      const compiled = compile(values as Compilable<number[]>, { items });
      const result = evaluate(compiled, { items: [{ value: 1 }, { value: 2 }, { value: 3 }] });
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe("闭包捕获", () => {
    test("lambda 捕获外部变量", () => {
      const numbers = variable<number[]>();
      const multiplier = variable<number>();

      const scaled = numbers.map(lambda<[number], number>((n) => expr({ n, multiplier })("n * multiplier")));

      const compiled = compile(scaled as Compilable<number[]>, { numbers, multiplier });
      expect(compiled[0]).toContain("numbers");
      expect(compiled[0]).toContain("multiplier");

      const result = evaluate(compiled, { numbers: [1, 2, 3], multiplier: 10 });
      expect(result).toEqual([10, 20, 30]);
    });

    test("lambda 同时捕获多个外部变量", () => {
      const numbers = variable<number[]>();
      const offset = variable<number>();
      const scale = variable<number>();

      const transformed = numbers.map(
        lambda<[number], number>((n) => expr({ n, offset, scale })("(n + offset) * scale"))
      );

      const compiled = compile(transformed as Compilable<number[]>, { numbers, offset, scale });

      const result = evaluate(compiled, { numbers: [1, 2, 3], offset: 5, scale: 2 });
      expect(result).toEqual([12, 14, 16]); // (1+5)*2=12, (2+5)*2=14, (3+5)*2=16
    });
  });

  describe("数组方法", () => {
    test("filter", () => {
      const numbers = variable<number[]>();
      const threshold = variable<number>();

      const filtered = numbers.filter(lambda<[number], boolean>((n) => expr({ n, threshold })("n > threshold")));

      const compiled = compile(filtered as Compilable<number[]>, { numbers, threshold });
      const result = evaluate(compiled, { numbers: [1, 5, 3, 8, 2, 7], threshold: 4 });
      expect(result).toEqual([5, 8, 7]);
    });

    test("find", () => {
      const items = variable<{ id: number; name: string }[]>();
      const targetId = variable<number>();

      const found = items.find(
        lambda<[{ id: number; name: string }], boolean>((item) => expr({ item, targetId })("item.id === targetId"))
      );

      const compiled = compile(found as Compilable<{ id: number; name: string } | undefined>, { items, targetId });
      const result = evaluate(compiled, {
        items: [
          { id: 1, name: "a" },
          { id: 2, name: "b" },
          { id: 3, name: "c" },
        ],
        targetId: 2,
      });
      expect(result).toEqual({ id: 2, name: "b" });
    });

    test("some", () => {
      const numbers = variable<number[]>();
      const hasPositive = numbers.some(lambda<[number], boolean>((n) => expr({ n })("n > 0")));

      const compiled = compile(hasPositive as Compilable<boolean>, { numbers });
      expect(evaluate<boolean>(compiled, { numbers: [-1, -2, 3] })).toBe(true);
      expect(evaluate<boolean>(compiled, { numbers: [-1, -2, -3] })).toBe(false);
    });

    test("every", () => {
      const numbers = variable<number[]>();
      const allPositive = numbers.every(lambda<[number], boolean>((n) => expr({ n })("n > 0")));

      const compiled = compile(allPositive as Compilable<boolean>, { numbers });
      expect(evaluate<boolean>(compiled, { numbers: [1, 2, 3] })).toBe(true);
      expect(evaluate<boolean>(compiled, { numbers: [1, -2, 3] })).toBe(false);
    });

    test("sort", () => {
      const numbers = variable<number[]>();

      const sorted = numbers.toSorted(lambda<[number, number], number>((a, b) => expr({ a, b })("a - b")) as any);

      const compiled = compile(sorted as Compilable<number[]>, { numbers });
      const result = evaluate(compiled, { numbers: [3, 1, 4, 1, 5, 9, 2, 6] });
      expect(result).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    });
  });

  describe("复杂场景", () => {
    test("带索引参数的 map", () => {
      const items = variable<string[]>();
      // 使用非 shorthand 语法以保持明确的属性名
      const indexed = items.map(
        lambda<[string, number], { item: string; index: number }>(
          (item, index) => expr({ item, index })("{ item: item, index: index }") as any
        )
      );

      const compiled = compile(indexed as Compilable<{ item: string; index: number }[]>, { items });
      const result = evaluate(compiled, { items: ["a", "b", "c"] });
      expect(result).toEqual([
        { item: "a", index: 0 },
        { item: "b", index: 1 },
        { item: "c", index: 2 },
      ]);
    });

    test("reduce 计算加权平均", () => {
      const values = variable<{ value: number; weight: number }[]>();

      // 求加权和
      const weightedSum = values.reduce(
        lambda<[number, { value: number; weight: number }], number>((acc, item) =>
          expr({ acc, item })("acc + item.value * item.weight")
        ),
        0
      );

      // 求权重和
      const totalWeight = values.reduce(
        lambda<[number, { value: number; weight: number }], number>((acc, item) =>
          expr({ acc, item })("acc + item.weight")
        ),
        0
      );

      // 计算平均
      const average = expr({ weightedSum, totalWeight })("weightedSum / totalWeight");

      const compiled = compile(average, { values });
      const result = evaluate(compiled, {
        values: [
          { value: 10, weight: 1 },
          { value: 20, weight: 2 },
          { value: 30, weight: 3 },
        ],
      });
      // (10*1 + 20*2 + 30*3) / (1+2+3) = 140/6 ≈ 23.33
      expect(result).toBeCloseTo(23.333333, 4);
    });

    test("链式方法调用", () => {
      const numbers = variable<number[]>();
      const threshold = variable<number>();

      const result = numbers
        .filter(lambda<[number], boolean>((n) => expr({ n, threshold })("n > threshold")))
        .map(lambda<[number], number>((n) => expr({ n })("n * 2")));

      const compiled = compile(result as Compilable<number[]>, { numbers, threshold });
      const evaluated = evaluate(compiled, { numbers: [1, 5, 3, 8, 2, 7], threshold: 4 });
      expect(evaluated).toEqual([10, 16, 14]); // [5, 8, 7] * 2
    });
  });

  describe("错误处理", () => {
    test("lambda body 必须返回 Proxy 表达式", () => {
      expect(() => {
        // @ts-expect-error - 故意传入非 Proxy 值测试错误处理
        lambda<[number], number>(() => 42);
      }).toThrow("Lambda body must return a Proxy expression");
    });
  });
});

describe("parser 箭头函数支持", () => {
  test("解析单参数箭头函数", () => {
    const numbers = variable<number[]>();
    // 直接使用生成的箭头函数源码
    const result = numbers.map(lambda<[number], number>((n) => expr({ n })("n * 2")));

    const compiled = compile(result as Compilable<number[]>, { numbers });
    const exprStr = compiled[1] as string;
    expect(exprStr).toMatch(/_0=>/);
  });

  test("解析多参数箭头函数", () => {
    const numbers = variable<number[]>();
    const result = numbers.reduce(
      lambda<[number, number], number>((acc, val) => expr({ acc, val })("acc + val")),
      0
    );

    const compiled = compile(result as Compilable<number>, { numbers });
    const exprStr = compiled[1] as string;
    expect(exprStr).toMatch(/\(_0,_1\)=>/);
  });
});
