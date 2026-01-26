import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "../../index";
import { compileAndEvaluate } from "../unit/test-helper";

describe("集成测试：基础表达式", () => {
  describe("变量与表达式组合", () => {
    test("多层嵌套表达式", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();

      const layer1 = expr({ a, b })("a + b");
      const layer2 = expr({ layer1, c })("layer1 * c");
      const layer3 = expr({ layer2 })("layer2 + 1");

      expect(compileAndEvaluate<number>(layer3, { a, b, c }, { a: 2, b: 3, c: 4 })).toBe(21); // (2+3)*4+1
    });

    test("链式计算", () => {
      const x = variable<number>();

      const expr1 = expr({ x })("x + 1");
      const expr2 = expr({ expr1 })("expr1 * 2");
      const expr3 = expr({ expr2 })("expr2 - 3");

      expect(compileAndEvaluate<number>(expr3, { x }, { x: 5 })).toBe(9); // ((5+1)*2)-3
    });

    test("引用不存在的变量抛出错误", () => {
      const x = variable<number>();

      const expr1 = expr({ x })("x + 1");
      const expr2 = expr({ expr1 })("expr1 * 2");
      // 错误：引用 expr3 而不是 expr2
      // 新实现会检测未定义变量并抛出错误
      const expr3 = expr({ expr2 })("expr3 - 3");

      // 编译时应该抛出未定义变量错误
      expect(() => compile(expr3, { x })).toThrow("Undefined variable(s): expr3");
    });
  });

  describe("运算符优先级", () => {
    test("乘法优先于加法", () => {
      const p = variable<number>();
      const q = variable<number>();

      const calc = expr({ p, q })("p + q * 2");
      expect(compileAndEvaluate<number>(calc, { p, q }, { p: 10, q: 5 })).toBe(20); // 10 + 5*2
    });

    test("括号改变优先级", () => {
      const p = variable<number>();
      const q = variable<number>();

      const calc = expr({ p, q })("(p + q) * 2");
      expect(compileAndEvaluate<number>(calc, { p, q }, { p: 10, q: 5 })).toBe(30); // (10+5)*2
    });

    test("复杂运算符组合", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();

      const calc = expr({ a, b, c })("a * b + c / 2 - a % b");
      // 2*3 + 10/2 - 2%3 = 6 + 5 - 2 = 9
      expect(compileAndEvaluate<number>(calc, { a, b, c }, { a: 2, b: 3, c: 10 })).toBe(9);
    });
  });

  describe("类型混合", () => {
    test("字符串拼接", () => {
      const a = variable<string>();
      const b = variable<string>();

      const combined = expr({ a, b })("a + b");
      expect(compileAndEvaluate<string>(combined, { a, b }, { a: "Hello", b: "World" })).toBe("HelloWorld");
    });

    test("数字与字符串混合拼接", () => {
      const str = variable<string>();
      const num = variable<number>();

      const combined = expr({ str, num })('str + ": " + num');
      // 类型系统可能推导为联合类型，但实际运行时是 string
      const compiled = compile(combined as unknown as import("../../types").Proxify<string>, { str, num });
      expect(evaluate<string>(compiled, { str: "Count", num: 42 })).toBe("Count: 42");
    });
  });

  describe("一元运算符", () => {
    test("负号", () => {
      const x = variable<number>();
      const negated = expr({ x })("-x");
      expect(compileAndEvaluate<number>(negated, { x }, { x: 5 })).toBe(-5);
      expect(compileAndEvaluate<number>(negated, { x }, { x: -3 })).toBe(3);
    });

    test("逻辑非", () => {
      const flag = variable<boolean>();
      const notFlag = expr({ flag })("!flag");
      expect(compileAndEvaluate<boolean>(notFlag, { flag }, { flag: true })).toBe(false);
      expect(compileAndEvaluate<boolean>(notFlag, { flag }, { flag: false })).toBe(true);
    });

    test("双重否定", () => {
      const flag = variable<boolean>();
      const doubleNot = expr({ flag })("!!flag");
      expect(compileAndEvaluate<boolean>(doubleNot, { flag }, { flag: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(doubleNot, { flag }, { flag: false })).toBe(false);
    });

    test("typeof 运算符", () => {
      const x = variable<number>();
      const typeExpr = expr({ x })("typeof x");
      expect(compileAndEvaluate<string>(typeExpr, { x }, { x: 42 })).toBe("number");
    });
  });

  describe("幂运算", () => {
    test("基础幂运算", () => {
      const base = variable<number>();
      const exp = variable<number>();

      const power = expr({ base, exp })("base ** exp");
      expect(compileAndEvaluate<number>(power, { base, exp }, { base: 2, exp: 10 })).toBe(1024);
    });

    test("幂运算右结合", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();

      // 2 ** 3 ** 2 = 2 ** 9 = 512 (右结合)
      const power = expr({ a, b, c })("a ** b ** c");
      expect(compileAndEvaluate<number>(power, { a, b, c }, { a: 2, b: 3, c: 2 })).toBe(512);
    });
  });

  describe("位运算", () => {
    test("按位与、或、异或", () => {
      const a = variable<number>();
      const b = variable<number>();

      const andExpr = expr({ a, b })("a & b");
      const orExpr = expr({ a, b })("a | b");
      const xorExpr = expr({ a, b })("a ^ b");

      // 5 = 0101, 3 = 0011
      expect(compileAndEvaluate<number>(andExpr, { a, b }, { a: 5, b: 3 })).toBe(1); // 0001
      expect(compileAndEvaluate<number>(orExpr, { a, b }, { a: 5, b: 3 })).toBe(7); // 0111
      expect(compileAndEvaluate<number>(xorExpr, { a, b }, { a: 5, b: 3 })).toBe(6); // 0110
    });

    test("按位取反", () => {
      const x = variable<number>();
      const notExpr = expr({ x })("~x");
      expect(compileAndEvaluate<number>(notExpr, { x }, { x: 5 })).toBe(-6); // ~5 = -6
    });

    test("位移运算", () => {
      const x = variable<number>();
      const n = variable<number>();

      const leftShift = expr({ x, n })("x << n");
      const rightShift = expr({ x, n })("x >> n");
      const unsignedRightShift = expr({ x, n })("x >>> n");

      expect(compileAndEvaluate<number>(leftShift, { x, n }, { x: 5, n: 2 })).toBe(20); // 5 << 2 = 20
      expect(compileAndEvaluate<number>(rightShift, { x, n }, { x: 20, n: 2 })).toBe(5); // 20 >> 2 = 5
      expect(compileAndEvaluate<number>(unsignedRightShift, { x, n }, { x: -1, n: 0 })).toBe(4294967295); // -1 >>> 0
    });
  });

  describe("数组和对象字面量", () => {
    test("数组字面量", () => {
      const a = variable<number>();
      const b = variable<number>();

      const arr = expr({ a, b })("[a, b, a + b]");
      expect(compileAndEvaluate<number[]>(arr, { a, b }, { a: 1, b: 2 })).toEqual([1, 2, 3]);
    });

    test("对象字面量", () => {
      const x = variable<number>();
      const y = variable<number>();

      const obj = expr({ x, y })("{ a: x, b: y, sum: x + y }");
      expect(compileAndEvaluate<{ a: number; b: number; sum: number }>(obj, { x, y }, { x: 1, y: 2 })).toEqual({
        a: 1,
        b: 2,
        sum: 3,
      });
    });

    test("嵌套数组和对象", () => {
      const a = variable<number>();
      const b = variable<string>();

      const nested = expr({ a, b })("{ arr: [a, a * 2], name: b }");
      expect(compileAndEvaluate<{ arr: number[]; name: string }>(nested, { a, b }, { a: 5, b: "test" })).toEqual({
        arr: [5, 10],
        name: "test",
      });
    });
  });
});
