import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "./index";
import { compileAndEvaluate } from "./test-helper";

describe("集成测试：编译优化", () => {
  describe("自动内联优化", () => {
    test("嵌套表达式自动内联", () => {
      const x = variable<number>();
      const y = variable<number>();

      const sum = expr({ x, y })("x + y");
      const product = expr({ x, y })("x * y");
      const result = expr({ sum, product })("sum + product");

      // 新的 Proxy 系统自动内联所有子表达式
      const compiled = compile(result, { x, y });

      // 内联后只剩一个表达式
      expect(compiled.length).toBe(2); // [变量名, 表达式]
      expect(compiled[0]).toEqual(["x", "y"]);

      // 执行结果正确
      const values = { x: 2, y: 3 };
      const evalResult = compileAndEvaluate<number>(result, { x, y }, values);
      expect(evalResult).toBe(11); // 2+3 + 2*3 = 5+6 = 11
    });

    test("重复引用的表达式处理", () => {
      const x = variable<number>();

      // sum 被引用两次（在源码中内联）
      const sum = expr({ x })("x + 1");
      const result = expr({ sum })("sum * sum");

      const value = compileAndEvaluate<number>(result, { x }, { x: 2 });
      expect(value).toBe(9); // (2+1)*(2+1) = 3*3 = 9
    });
  });

  describe("复杂表达式优化", () => {
    test("深层嵌套表达式优化", () => {
      const x = variable<number>();

      const e1 = expr({ x })("x + 1");
      const e2 = expr({ e1 })("e1 * 2");
      const e3 = expr({ e2 })("e2 - 3");
      const e4 = expr({ e3 })("e3 / 2");

      const compiled = compile(e4, { x });

      // 所有表达式都被内联，只有一个最终表达式
      expect(compiled.length).toBe(2);

      // 执行结果正确
      const values = { x: 5 };
      const expected = ((5 + 1) * 2 - 3) / 2; // (6*2-3)/2 = 9/2 = 4.5
      expect(compileAndEvaluate<number>(e4, { x }, values)).toBe(expected);
    });

    test("分支表达式", () => {
      const x = variable<number>();
      const y = variable<number>();

      // base 用于两个不同的表达式
      const base = expr({ x, y })("x + y");
      const left = expr({ base })("base * 2");
      const right = expr({ base })("base * 3");
      const result = expr({ left, right })("left + right");

      // 执行结果正确
      const values = { x: 1, y: 2 };
      // base = 3, left = 6, right = 9, result = 15
      expect(compileAndEvaluate<number>(result, { x, y }, values)).toBe(15);
    });
  });

  describe("优化正确性验证", () => {
    test("各种数值范围", () => {
      const x = variable<number>();
      const y = variable<number>();

      const e = expr({ x, y })("x * y + x / y");
      const compiled = compile(e, { x, y });

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
        expect(evaluate<number>(compiled, values)).toBe(expected);
      }
    });

    test("特殊数值处理", () => {
      const x = variable<number>();

      const e = expr({ x })("x + 1");
      const compiled = compile(e, { x });

      expect(evaluate<number>(compiled, { x: Infinity })).toBe(Infinity);
      expect(evaluate<number>(compiled, { x: -Infinity })).toBe(-Infinity);
      expect(Number.isNaN(evaluate<number>(compiled, { x: NaN }))).toBe(true);
    });
  });
});
