import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { compile, evaluate, expr, variable } from "./index";

describe("集成测试：布尔表达式", () => {
  describe("比较运算符", () => {
    test("数值比较", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const tests = [
        { expr: "x < y", values: { x: 1, y: 2 }, expected: true },
        { expr: "x < y", values: { x: 2, y: 2 }, expected: false },
        { expr: "x <= y", values: { x: 2, y: 2 }, expected: true },
        { expr: "x > y", values: { x: 3, y: 2 }, expected: true },
        { expr: "x >= y", values: { x: 2, y: 2 }, expected: true },
      ];

      for (const t of tests) {
        const e = expr({ x, y })(t.expr);
        const compiled = compile(e, { x, y });
        expect(evaluate<boolean>(compiled, t.values)).toBe(t.expected);
      }
    });

    test("相等性比较", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const eqExpr = expr({ x, y })("x === y");
      const neqExpr = expr({ x, y })("x !== y");

      const eqCompiled = compile(eqExpr, { x, y });
      const neqCompiled = compile(neqExpr, { x, y });

      expect(evaluate<boolean>(eqCompiled, { x: 5, y: 5 })).toBe(true);
      expect(evaluate<boolean>(eqCompiled, { x: 5, y: 6 })).toBe(false);
      expect(evaluate<boolean>(neqCompiled, { x: 5, y: 6 })).toBe(true);
      expect(evaluate<boolean>(neqCompiled, { x: 5, y: 5 })).toBe(false);
    });

    test("宽松相等与严格相等", () => {
      const x = variable(z.union([z.number(), z.string()]));
      const y = variable(z.union([z.number(), z.string()]));

      const looseEq = expr({ x, y })("x == y");
      const strictEq = expr({ x, y })("x === y");

      const looseCompiled = compile(looseEq, { x, y });
      const strictCompiled = compile(strictEq, { x, y });

      // 宽松相等：数字和字符串可能相等
      expect(evaluate<boolean>(looseCompiled, { x: "5", y: 5 })).toBe(true);
      // 严格相等：类型不同则不相等
      expect(evaluate<boolean>(strictCompiled, { x: "5", y: 5 })).toBe(false);
    });

    test("字符串比较", () => {
      const a = variable(z.string());
      const b = variable(z.string());

      const ltExpr = expr({ a, b })("a < b");
      const compiled = compile(ltExpr, { a, b });

      expect(evaluate<boolean>(compiled, { a: "abc", b: "abd" })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: "abc", b: "abc" })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: "b", b: "a" })).toBe(false);
    });
  });

  describe("逻辑运算符", () => {
    test("逻辑与", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());

      const andExpr = expr({ a, b })("a && b");
      const compiled = compile(andExpr, { a, b });

      expect(evaluate<boolean>(compiled, { a: true, b: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: true, b: false })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: false, b: true })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: false, b: false })).toBe(false);
    });

    test("逻辑或", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());

      const orExpr = expr({ a, b })("a || b");
      const compiled = compile(orExpr, { a, b });

      expect(evaluate<boolean>(compiled, { a: true, b: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: true, b: false })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: false })).toBe(false);
    });

    test("逻辑或返回值特性", () => {
      const a = variable(z.number());
      const b = variable(z.number());

      const orExpr = expr({ a, b })("a || b");
      const compiled = compile(orExpr, { a, b });

      // || 返回第一个 truthy 值或最后一个值
      expect(evaluate<number>(compiled, { a: 5, b: 10 })).toBe(5);
      expect(evaluate<number>(compiled, { a: 0, b: 10 })).toBe(10);
      expect(evaluate<number>(compiled, { a: 0, b: 0 })).toBe(0);
    });

    test("逻辑与返回值特性", () => {
      const a = variable(z.number());
      const b = variable(z.number());

      const andExpr = expr({ a, b })("a && b");
      const compiled = compile(andExpr, { a, b });

      // && 返回第一个 falsy 值或最后一个值
      expect(evaluate<number>(compiled, { a: 5, b: 10 })).toBe(10);
      expect(evaluate<number>(compiled, { a: 0, b: 10 })).toBe(0);
      expect(evaluate<number>(compiled, { a: 5, b: 0 })).toBe(0);
    });

    test("空值合并运算符", () => {
      const a = variable(z.union([z.number(), z.null(), z.undefined()]));
      const b = variable(z.number());

      const nullishExpr = expr({ a, b })("a ?? b");
      const compiled = compile(nullishExpr, { a, b });

      expect(evaluate<number>(compiled, { a: 5, b: 10 })).toBe(5);
      expect(evaluate<number>(compiled, { a: null, b: 10 })).toBe(10);
      expect(evaluate<number>(compiled, { a: undefined, b: 10 })).toBe(10);
      // 0 不是 null/undefined，所以返回 0
      expect(evaluate<number>(compiled, { a: 0, b: 10 })).toBe(0);
    });
  });

  describe("三元表达式", () => {
    test("基础三元表达式", () => {
      const cond = variable(z.boolean());
      const x = variable(z.number());
      const y = variable(z.number());

      const ternary = expr({ cond, x, y })("cond ? x : y");
      const compiled = compile(ternary, { cond, x, y });

      expect(evaluate<number>(compiled, { cond: true, x: 1, y: 2 })).toBe(1);
      expect(evaluate<number>(compiled, { cond: false, x: 1, y: 2 })).toBe(2);
    });

    test("三元表达式中的复杂条件", () => {
      const age = variable(z.number());

      const category = expr({ age })('age >= 18 ? "adult" : "minor"');
      const compiled = compile(category, { age });

      expect(evaluate<string>(compiled, { age: 25 })).toBe("adult");
      expect(evaluate<string>(compiled, { age: 15 })).toBe("minor");
      expect(evaluate<string>(compiled, { age: 18 })).toBe("adult");
    });

    test("嵌套三元表达式", () => {
      const score = variable(z.number());

      const grade = expr({ score })('score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : "F"');
      const compiled = compile(grade, { score });

      expect(evaluate<string>(compiled, { score: 95 })).toBe("A");
      expect(evaluate<string>(compiled, { score: 85 })).toBe("B");
      expect(evaluate<string>(compiled, { score: 75 })).toBe("C");
      expect(evaluate<string>(compiled, { score: 65 })).toBe("F");
    });

    test("三元表达式与运算结合", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      // 返回较大数的绝对值
      const absMax = expr({ x, y })("x > y ? (x > 0 ? x : -x) : (y > 0 ? y : -y)");
      const compiled = compile(absMax, { x, y });

      expect(evaluate<number>(compiled, { x: 5, y: 3 })).toBe(5); // x > y, x > 0, 返回 x
      expect(evaluate<number>(compiled, { x: -5, y: 3 })).toBe(3); // x < y, y > 0, 返回 y
      expect(evaluate<number>(compiled, { x: 2, y: -8 })).toBe(2); // x > y, x > 0, 返回 x
      expect(evaluate<number>(compiled, { x: -2, y: -8 })).toBe(2); // x > y, x < 0, 返回 -x
    });
  });

  describe("复合布尔逻辑", () => {
    test("多变量布尔逻辑组合", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const isGreater = expr({ x, y })("x > y");
      const isEqual = expr({ x, y })("x === y");
      const combined = expr({ isGreater, isEqual })("isGreater || isEqual");

      const compiled = compile(combined, { x, y });

      expect(evaluate<boolean>(compiled, { x: 10, y: 5 })).toBe(true);
      expect(evaluate<boolean>(compiled, { x: 5, y: 5 })).toBe(true);
      expect(evaluate<boolean>(compiled, { x: 3, y: 7 })).toBe(false);
    });

    test("运算符优先级: && 优先于 ||", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());

      // a || b && c 等价于 a || (b && c)
      const result = expr({ a, b, c })("a || b && c");
      const compiled = compile(result, { a, b, c });

      expect(evaluate<boolean>(compiled, { a: true, b: false, c: false })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: false })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: false, b: false, c: true })).toBe(false);
    });

    test("括号改变逻辑运算优先级", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());

      // (a || b) && c
      const result = expr({ a, b, c })("(a || b) && c");
      const compiled = compile(result, { a, b, c });

      expect(evaluate<boolean>(compiled, { a: true, b: false, c: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: true, b: false, c: false })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: false, b: false, c: true })).toBe(false);
    });

    test("德摩根定律验证", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());

      // !(a && b) 等价于 !a || !b
      const leftCompiled = compile(expr({ a, b })("!(a && b)"), { a, b });
      const rightCompiled = compile(expr({ a, b })("(!a) || (!b)"), { a, b });

      const testCases = [
        { a: true, b: true },
        { a: true, b: false },
        { a: false, b: true },
        { a: false, b: false },
      ];

      for (const values of testCases) {
        const leftResult = evaluate<boolean>(leftCompiled, values);
        const rightResult = evaluate<boolean>(rightCompiled, values);
        expect(leftResult).toBe(rightResult);
      }
    });
  });

  describe("in 运算符", () => {
    test("检查对象属性", () => {
      const obj = variable(z.record(z.string(), z.number()));
      const key = variable(z.string());

      const hasKey = expr({ key, obj })("key in obj");
      const compiled = compile(hasKey, { key, obj });

      expect(evaluate<boolean>(compiled, { key: "a", obj: { a: 1, b: 2 } })).toBe(true);
      expect(evaluate<boolean>(compiled, { key: "c", obj: { a: 1, b: 2 } })).toBe(false);
    });
  });
});
