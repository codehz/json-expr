import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { compile, evaluate, expr, variable } from "./index";

describe("集成测试：编译优化", () => {
  describe("内联优化", () => {
    test("单次引用的表达式被内联", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const sum = expr({ x, y })("x + y");
      const product = expr({ x, y })("x * y");
      const result = expr({ sum, product })("sum + product");

      // 默认开启内联优化
      const optimized = compile(result, { x, y });
      // 内联后只剩一个表达式
      expect(optimized.length).toBe(2); // [变量名, 表达式]
      expect(optimized[0]).toEqual(["x", "y"]);

      // 禁用内联
      const unoptimized = compile(result, { x, y }, { inline: false });
      // 未内联有 4 个元素
      expect(unoptimized.length).toBe(4); // [变量名, sum, product, result]

      // 两者执行结果一致
      const values = { x: 2, y: 3 };
      const resultOptimized = evaluate<number>(optimized, values);
      const resultUnoptimized = evaluate<number>(unoptimized, values);
      expect(resultOptimized).toBe(11); // 2+3 + 2*3 = 5+6 = 11
      expect(resultUnoptimized).toBe(11);
    });

    test("多次引用的表达式处理", () => {
      const x = variable(z.number());

      // sum 被引用两次
      const sum = expr({ x })("x + 1");
      const result = expr({ sum })("sum * sum");

      const optimized = compile(result, { x });
      const unoptimized = compile(result, { x }, { inline: false });

      // 执行结果正确
      const valueOptimized = evaluate<number>(optimized, { x: 2 });
      const valueUnoptimized = evaluate<number>(unoptimized, { x: 2 });
      expect(valueOptimized).toBe(9); // (2+1)*(2+1) = 3*3 = 9
      expect(valueUnoptimized).toBe(9);
    });

    test("部分内联：混合单次和多次引用", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const a = expr({ x })("x + 1"); // 被引用一次
      const b = expr({ y })("y * 2"); // 被引用两次
      const result = expr({ a, b })("a + b * b");

      const optimized = compile(result, { x, y });
      const unoptimized = compile(result, { x, y }, { inline: false });

      // a 被内联，b 不被内联
      expect(optimized.length).toBeLessThan(unoptimized.length);

      // 执行结果一致
      const values = { x: 1, y: 2 };
      expect(evaluate<number>(optimized, values)).toBe(evaluate<number>(unoptimized, values));
      // (1+1) + (2*2)*(2*2) = 2 + 4*4 = 2 + 16 = 18
      expect(evaluate<number>(optimized, values)).toBe(18);
    });
  });

  describe("复杂表达式优化", () => {
    test("深层嵌套表达式优化", () => {
      const x = variable(z.number());

      const e1 = expr({ x })("x + 1");
      const e2 = expr({ e1 })("e1 * 2");
      const e3 = expr({ e2 })("e2 - 3");
      const e4 = expr({ e3 })("e3 / 2");

      const optimized = compile(e4, { x });
      const unoptimized = compile(e4, { x }, { inline: false });

      // 所有表达式都只被引用一次，应该完全内联
      expect(optimized.length).toBe(2);
      expect(unoptimized.length).toBe(5);

      // 执行结果一致
      const values = { x: 5 };
      const expected = ((5 + 1) * 2 - 3) / 2; // (6*2-3)/2 = 9/2 = 4.5
      expect(evaluate<number>(optimized, values)).toBe(expected);
      expect(evaluate<number>(unoptimized, values)).toBe(expected);
    });

    test("分支共享的表达式", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      // base 被两个分支共享
      const base = expr({ x, y })("x + y");
      const left = expr({ base })("base * 2");
      const right = expr({ base })("base * 3");
      const result = expr({ left, right })("left + right");

      const optimized = compile(result, { x, y });
      const unoptimized = compile(result, { x, y }, { inline: false });

      // base 被引用两次，不应被内联
      // left 和 right 各被引用一次，应该被内联
      expect(optimized.length).toBeLessThan(unoptimized.length);

      // 执行结果一致
      const values = { x: 1, y: 2 };
      // base = 3, left = 6, right = 9, result = 15
      expect(evaluate<number>(optimized, values)).toBe(15);
      expect(evaluate<number>(unoptimized, values)).toBe(15);
    });
  });

  describe("优化正确性验证", () => {
    test("各种数值范围", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const e = expr({ x, y })("x * y + x / y");
      const optimized = compile(e, { x, y });
      const unoptimized = compile(e, { x, y }, { inline: false });

      const testCases = [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: -5, y: 3 },
        { x: 100, y: 0.01 },
        { x: Number.MAX_SAFE_INTEGER, y: 1 },
        { x: Number.MIN_SAFE_INTEGER, y: -1 },
      ];

      for (const values of testCases) {
        const expected = values.x * values.y + values.x / values.y;
        expect(evaluate<number>(optimized, values)).toBe(expected);
        expect(evaluate<number>(unoptimized, values)).toBe(expected);
      }
    });

    test("特殊数值处理", () => {
      const x = variable(z.number());

      const e = expr({ x })("x + 1");
      const compiled = compile(e, { x });

      expect(evaluate<number>(compiled, { x: Infinity })).toBe(Infinity);
      expect(evaluate<number>(compiled, { x: -Infinity })).toBe(-Infinity);
      expect(Number.isNaN(evaluate<number>(compiled, { x: NaN }))).toBe(true);
    });
  });
});
