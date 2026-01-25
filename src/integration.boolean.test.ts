import { describe, expect, test } from "bun:test";
import { compile, compileAndEvaluate, evaluate, expr, variable } from "./index";

describe("集成测试：布尔表达式", () => {
  describe("比较运算符", () => {
    test("数值比较", () => {
      const x = variable<number>();
      const y = variable<number>();

      const tests = [
        { expr: "x < y", values: { x: 1, y: 2 }, expected: true },
        { expr: "x < y", values: { x: 2, y: 2 }, expected: false },
        { expr: "x <= y", values: { x: 2, y: 2 }, expected: true },
        { expr: "x > y", values: { x: 3, y: 2 }, expected: true },
        { expr: "x >= y", values: { x: 2, y: 2 }, expected: true },
      ];

      for (const t of tests) {
        const e = expr({ x, y })(t.expr);
        expect(compileAndEvaluate<boolean>(e, { x, y }, t.values)).toBe(t.expected);
      }
    });

    test("相等性比较", () => {
      const x = variable<number>();
      const y = variable<number>();

      const eqExpr = expr({ x, y })("x === y");
      const neqExpr = expr({ x, y })("x !== y");

      expect(compileAndEvaluate<boolean>(eqExpr, { x, y }, { x: 5, y: 5 })).toBe(true);
      expect(compileAndEvaluate<boolean>(eqExpr, { x, y }, { x: 5, y: 6 })).toBe(false);
      expect(compileAndEvaluate<boolean>(neqExpr, { x, y }, { x: 5, y: 6 })).toBe(true);
      expect(compileAndEvaluate<boolean>(neqExpr, { x, y }, { x: 5, y: 5 })).toBe(false);
    });

    test("宽松相等与严格相等", () => {
      const x = variable<number | string>();
      const y = variable<number | string>();

      const looseEq = expr({ x, y })("x == y");
      const strictEq = expr({ x, y })("x === y");

      // 宽松相等：数字和字符串可能相等
      expect(compileAndEvaluate<boolean>(looseEq, { x, y }, { x: "5", y: 5 })).toBe(true);
      // 严格相等：类型不同则不相等
      expect(compileAndEvaluate<boolean>(strictEq, { x, y }, { x: "5", y: 5 })).toBe(false);
    });

    test("字符串比较", () => {
      const a = variable<string>();
      const b = variable<string>();

      const ltExpr = expr({ a, b })("a < b");

      expect(compileAndEvaluate<boolean>(ltExpr, { a, b }, { a: "abc", b: "abd" })).toBe(true);
      expect(compileAndEvaluate<boolean>(ltExpr, { a, b }, { a: "abc", b: "abc" })).toBe(false);
      expect(compileAndEvaluate<boolean>(ltExpr, { a, b }, { a: "b", b: "a" })).toBe(false);
    });
  });

  describe("逻辑运算符", () => {
    test("逻辑与", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();

      const andExpr = expr({ a, b })("a && b");

      expect(compileAndEvaluate<boolean>(andExpr, { a, b }, { a: true, b: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(andExpr, { a, b }, { a: true, b: false })).toBe(false);
      expect(compileAndEvaluate<boolean>(andExpr, { a, b }, { a: false, b: true })).toBe(false);
      expect(compileAndEvaluate<boolean>(andExpr, { a, b }, { a: false, b: false })).toBe(false);
    });

    test("逻辑或", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();

      const orExpr = expr({ a, b })("a || b");

      expect(compileAndEvaluate<boolean>(orExpr, { a, b }, { a: true, b: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(orExpr, { a, b }, { a: true, b: false })).toBe(true);
      expect(compileAndEvaluate<boolean>(orExpr, { a, b }, { a: false, b: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(orExpr, { a, b }, { a: false, b: false })).toBe(false);
    });

    test("逻辑或返回值特性", () => {
      const a = variable<number>();
      const b = variable<number>();

      const orExpr = expr({ a, b })("a || b");

      // || 返回第一个 truthy 值或最后一个值
      expect(compileAndEvaluate<number>(orExpr, { a, b }, { a: 5, b: 10 })).toBe(5);
      expect(compileAndEvaluate<number>(orExpr, { a, b }, { a: 0, b: 10 })).toBe(10);
      expect(compileAndEvaluate<number>(orExpr, { a, b }, { a: 0, b: 0 })).toBe(0);
    });

    test("逻辑与返回值特性", () => {
      const a = variable<number>();
      const b = variable<number>();

      const andExpr = expr({ a, b })("a && b");

      // && 返回第一个 falsy 值或最后一个值
      expect(compileAndEvaluate<number>(andExpr, { a, b }, { a: 5, b: 10 })).toBe(10);
      expect(compileAndEvaluate<number>(andExpr, { a, b }, { a: 0, b: 10 })).toBe(0);
      expect(compileAndEvaluate<number>(andExpr, { a, b }, { a: 5, b: 0 })).toBe(0);
    });

    test("空值合并运算符", () => {
      const a = variable<number | null | undefined>();
      const b = variable<number>();

      const nullishExpr = expr({ a, b })("a ?? b");

      expect(compileAndEvaluate<number>(nullishExpr, { a, b }, { a: 5, b: 10 })).toBe(5);
      expect(compileAndEvaluate<number>(nullishExpr, { a, b }, { a: null, b: 10 })).toBe(10);
      expect(compileAndEvaluate<number>(nullishExpr, { a, b }, { a: undefined, b: 10 })).toBe(10);
      // 0 不是 null/undefined，所以返回 0
      expect(compileAndEvaluate<number>(nullishExpr, { a, b }, { a: 0, b: 10 })).toBe(0);
    });
  });

  describe("三元表达式", () => {
    test("基础三元表达式", () => {
      const cond = variable<boolean>();
      const x = variable<number>();
      const y = variable<number>();

      const ternary = expr({ cond, x, y })("cond ? x : y");

      expect(compileAndEvaluate<number>(ternary, { cond, x, y }, { cond: true, x: 1, y: 2 })).toBe(1);
      expect(compileAndEvaluate<number>(ternary, { cond, x, y }, { cond: false, x: 1, y: 2 })).toBe(2);
    });

    test("三元表达式中的复杂条件", () => {
      const age = variable<number>();

      const category = expr({ age })('age >= 18 ? "adult" : "minor"');

      expect(compileAndEvaluate<string>(category, { age }, { age: 25 })).toBe("adult");
      expect(compileAndEvaluate<string>(category, { age }, { age: 15 })).toBe("minor");
      expect(compileAndEvaluate<string>(category, { age }, { age: 18 })).toBe("adult");
    });

    test("嵌套三元表达式", () => {
      const score = variable<number>();

      const grade = expr({ score })('score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : "F"');

      expect(compileAndEvaluate<string>(grade, { score }, { score: 95 })).toBe("A");
      expect(compileAndEvaluate<string>(grade, { score }, { score: 85 })).toBe("B");
      expect(compileAndEvaluate<string>(grade, { score }, { score: 75 })).toBe("C");
      expect(compileAndEvaluate<string>(grade, { score }, { score: 65 })).toBe("F");
    });

    test("三元表达式与运算结合", () => {
      const x = variable<number>();
      const y = variable<number>();

      // 返回较大数的绝对值
      const absMax = expr({ x, y })("x > y ? (x > 0 ? x : -x) : (y > 0 ? y : -y)");

      expect(compileAndEvaluate<number>(absMax, { x, y }, { x: 5, y: 3 })).toBe(5); // x > y, x > 0, 返回 x
      expect(compileAndEvaluate<number>(absMax, { x, y }, { x: -5, y: 3 })).toBe(3); // x < y, y > 0, 返回 y
      expect(compileAndEvaluate<number>(absMax, { x, y }, { x: 2, y: -8 })).toBe(2); // x > y, x > 0, 返回 x
      expect(compileAndEvaluate<number>(absMax, { x, y }, { x: -2, y: -8 })).toBe(2); // x > y, x < 0, 返回 -x
    });
  });

  describe("复合布尔逻辑", () => {
    test("多变量布尔逻辑组合", () => {
      const x = variable<number>();
      const y = variable<number>();

      const isGreater = expr({ x, y })("x > y");
      const isEqual = expr({ x, y })("x === y");
      const combined = expr({ isGreater, isEqual })("isGreater || isEqual");

      expect(compileAndEvaluate<boolean>(combined, { x, y }, { x: 10, y: 5 })).toBe(true);
      expect(compileAndEvaluate<boolean>(combined, { x, y }, { x: 5, y: 5 })).toBe(true);
      expect(compileAndEvaluate<boolean>(combined, { x, y }, { x: 3, y: 7 })).toBe(false);
    });

    test("运算符优先级: && 优先于 ||", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();

      // a || b && c 等价于 a || (b && c)
      const result = expr({ a, b, c })("a || b && c");

      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: true, b: false, c: false })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: false, b: true, c: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: false, b: true, c: false })).toBe(false);
      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: false, b: false, c: true })).toBe(false);
    });

    test("括号改变逻辑运算优先级", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();

      // (a || b) && c
      const result = expr({ a, b, c })("(a || b) && c");

      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: true, b: false, c: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: true, b: false, c: false })).toBe(false);
      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: false, b: false, c: true })).toBe(false);
    });

    test("德摩根定律验证", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();

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
      const obj = variable<Record<string, number>>();
      const key = variable<string>();

      const hasKey = expr({ key, obj })("key in obj");

      expect(compileAndEvaluate<boolean>(hasKey, { key, obj }, { key: "a", obj: { a: 1, b: 2 } })).toBe(true);
      expect(compileAndEvaluate<boolean>(hasKey, { key, obj }, { key: "c", obj: { a: 1, b: 2 } })).toBe(false);
    });
  });
});
