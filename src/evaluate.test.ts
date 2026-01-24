import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "./index";

describe("evaluate 单元测试", () => {
  describe("缓存机制", () => {
    test("重复调用使用缓存的求值函数", () => {
      const x = variable<number>();
      const sum = expr({ x })("x + 1");
      const compiled = compile(sum, { x });

      // 多次调用应该返回正确结果
      expect(evaluate<number>(compiled, { x: 5 })).toBe(6);
      expect(evaluate<number>(compiled, { x: 10 })).toBe(11);
      expect(evaluate<number>(compiled, { x: 0 })).toBe(1);
      expect(evaluate<number>(compiled, { x: -5 })).toBe(-4);
    });
  });

  describe("错误处理", () => {
    test("缺少必需变量时抛出错误", () => {
      const x = variable<number>();
      const y = variable<number>();

      const sum = expr({ x, y })("x + y");
      const compiled = compile(sum, { x, y });

      expect(() => {
        evaluate<number>(compiled, { x: 2 });
      }).toThrow("Missing required variable: y");
    });

    test("缺少多个变量时报告第一个", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();

      const e = expr({ a, b, c })("a + b + c");
      const compiled = compile(e, { a, b, c });

      expect(() => {
        evaluate<number>(compiled, {});
      }).toThrow("Missing required variable:");
    });
  });

  describe("边界情况", () => {
    test("空变量列表", () => {
      // 常量表达式
      const e = expr({})("1 + 2");
      const compiled = compile(e, {});
      expect(evaluate<number>(compiled, {})).toBe(3);
    });

    test("undefined 和 null 值", () => {
      const x = variable<number | null | undefined>();
      const y = variable<number>();

      const e = expr({ x, y })("x ?? y");
      const compiled = compile(e, { x, y });

      expect(evaluate<number>(compiled, { x: null, y: 10 })).toBe(10);
      expect(evaluate<number>(compiled, { x: undefined, y: 10 })).toBe(10);
      expect(evaluate<number>(compiled, { x: 5, y: 10 })).toBe(5);
    });
  });
});
