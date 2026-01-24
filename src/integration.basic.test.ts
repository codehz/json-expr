import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "./index";

describe("集成测试：基础表达式", () => {
  describe("变量与表达式组合", () => {
    test("多层嵌套表达式", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();

      const layer1 = expr({ a, b })("a + b");
      const layer2 = expr({ layer1, c })("layer1 * c");
      const layer3 = expr({ layer2 })("layer2 + 1");

      const compiled = compile(layer3, { a, b, c });

      expect(compiled[0]).toEqual(["a", "b", "c"]);
      expect(evaluate<number>(compiled, { a: 2, b: 3, c: 4 })).toBe(21); // (2+3)*4+1
    });

    test("链式计算", () => {
      const x = variable<number>();

      const expr1 = expr({ x })("x + 1");
      const expr2 = expr({ expr1 })("expr1 * 2");
      const expr3 = expr({ expr2 })("expr2 - 3");

      const compiled = compile(expr3, { x });
      expect(evaluate<number>(compiled, { x: 5 })).toBe(9); // ((5+1)*2)-3
    });

    test("引用不存在的变量保留在表达式中", () => {
      const x = variable<number>();

      const expr1 = expr({ x })("x + 1");
      const expr2 = expr({ expr1 })("expr1 * 2");
      // 错误：引用 expr3 而不是 expr2
      // 新 Proxy 系统中，未定义的引用会保留在表达式中
      const expr3 = expr({ expr2 })("expr3 - 3");

      // expr3 保留在表达式中，不会被替换
      const compiled = compile(expr3, { x });
      expect(compiled[0]).toEqual(["x"]);
      expect((compiled[1] as string).includes("expr3")).toBe(true);
    });
  });

  describe("运算符优先级", () => {
    test("乘法优先于加法", () => {
      const p = variable<number>();
      const q = variable<number>();

      const calc = expr({ p, q })("p + q * 2");
      const compiled = compile(calc, { p, q });
      expect(evaluate<number>(compiled, { p: 10, q: 5 })).toBe(20); // 10 + 5*2
    });

    test("括号改变优先级", () => {
      const p = variable<number>();
      const q = variable<number>();

      const calc = expr({ p, q })("(p + q) * 2");
      const compiled = compile(calc, { p, q });
      expect(evaluate<number>(compiled, { p: 10, q: 5 })).toBe(30); // (10+5)*2
    });

    test("复杂运算符组合", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();

      const calc = expr({ a, b, c })("a * b + c / 2 - a % b");
      const compiled = compile(calc, { a, b, c });
      // 2*3 + 10/2 - 2%3 = 6 + 5 - 2 = 9
      expect(evaluate<number>(compiled, { a: 2, b: 3, c: 10 })).toBe(9);
    });
  });

  describe("类型混合", () => {
    test("字符串拼接", () => {
      const a = variable<string>();
      const b = variable<string>();

      const combined = expr({ a, b })("a + b");
      const compiled = compile(combined, { a, b });
      expect(evaluate<string>(compiled, { a: "Hello", b: "World" })).toBe("HelloWorld");
    });

    test("数字与字符串混合拼接", () => {
      const str = variable<string>();
      const num = variable<number>();

      const combined = expr({ str, num })('str + ": " + num');
      // 类型系统可能推导为联合类型，但实际运行时是 string
      const compiled = compile(combined as unknown as import("./types").Proxify<string>, { str, num });
      expect(evaluate<string>(compiled, { str: "Count", num: 42 })).toBe("Count: 42");
    });
  });

  describe("一元运算符", () => {
    test("负号", () => {
      const x = variable<number>();
      const negated = expr({ x })("-x");
      const compiled = compile(negated, { x });
      expect(evaluate<number>(compiled, { x: 5 })).toBe(-5);
      expect(evaluate<number>(compiled, { x: -3 })).toBe(3);
    });

    test("逻辑非", () => {
      const flag = variable<boolean>();
      const notFlag = expr({ flag })("!flag");
      const compiled = compile(notFlag, { flag });
      expect(evaluate<boolean>(compiled, { flag: true })).toBe(false);
      expect(evaluate<boolean>(compiled, { flag: false })).toBe(true);
    });

    test("双重否定", () => {
      const flag = variable<boolean>();
      const doubleNot = expr({ flag })("!!flag");
      const compiled = compile(doubleNot, { flag });
      expect(evaluate<boolean>(compiled, { flag: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { flag: false })).toBe(false);
    });

    test("typeof 运算符", () => {
      const x = variable<number>();
      const typeExpr = expr({ x })("typeof x");
      const compiled = compile(typeExpr, { x });
      expect(evaluate<string>(compiled, { x: 42 })).toBe("number");
    });
  });

  describe("幂运算", () => {
    test("基础幂运算", () => {
      const base = variable<number>();
      const exp = variable<number>();

      const power = expr({ base, exp })("base ** exp");
      const compiled = compile(power, { base, exp });
      expect(evaluate<number>(compiled, { base: 2, exp: 10 })).toBe(1024);
    });

    test("幂运算右结合", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();

      // 2 ** 3 ** 2 = 2 ** 9 = 512 (右结合)
      const power = expr({ a, b, c })("a ** b ** c");
      const compiled = compile(power, { a, b, c });
      expect(evaluate<number>(compiled, { a: 2, b: 3, c: 2 })).toBe(512);
    });
  });

  describe("位运算", () => {
    test("按位与、或、异或", () => {
      const a = variable<number>();
      const b = variable<number>();

      const andExpr = expr({ a, b })("a & b");
      const orExpr = expr({ a, b })("a | b");
      const xorExpr = expr({ a, b })("a ^ b");

      const andCompiled = compile(andExpr, { a, b });
      const orCompiled = compile(orExpr, { a, b });
      const xorCompiled = compile(xorExpr, { a, b });

      // 5 = 0101, 3 = 0011
      expect(evaluate<number>(andCompiled, { a: 5, b: 3 })).toBe(1); // 0001
      expect(evaluate<number>(orCompiled, { a: 5, b: 3 })).toBe(7); // 0111
      expect(evaluate<number>(xorCompiled, { a: 5, b: 3 })).toBe(6); // 0110
    });

    test("按位取反", () => {
      const x = variable<number>();
      const notExpr = expr({ x })("~x");
      const compiled = compile(notExpr, { x });
      expect(evaluate<number>(compiled, { x: 5 })).toBe(-6); // ~5 = -6
    });

    test("位移运算", () => {
      const x = variable<number>();
      const n = variable<number>();

      const leftShift = expr({ x, n })("x << n");
      const rightShift = expr({ x, n })("x >> n");
      const unsignedRightShift = expr({ x, n })("x >>> n");

      const leftCompiled = compile(leftShift, { x, n });
      const rightCompiled = compile(rightShift, { x, n });
      const unsignedCompiled = compile(unsignedRightShift, { x, n });

      expect(evaluate<number>(leftCompiled, { x: 5, n: 2 })).toBe(20); // 5 << 2 = 20
      expect(evaluate<number>(rightCompiled, { x: 20, n: 2 })).toBe(5); // 20 >> 2 = 5
      expect(evaluate<number>(unsignedCompiled, { x: -1, n: 0 })).toBe(4294967295); // -1 >>> 0
    });
  });

  describe("数组和对象字面量", () => {
    test("数组字面量", () => {
      const a = variable<number>();
      const b = variable<number>();

      const arr = expr({ a, b })("[a, b, a + b]");
      const compiled = compile(arr, { a, b });
      expect(evaluate<number[]>(compiled, { a: 1, b: 2 })).toEqual([1, 2, 3]);
    });

    test("对象字面量", () => {
      const x = variable<number>();
      const y = variable<number>();

      const obj = expr({ x, y })("{ a: x, b: y, sum: x + y }");
      const compiled = compile(obj, { x, y });
      expect(evaluate<{ a: number; b: number; sum: number }>(compiled, { x: 1, y: 2 })).toEqual({
        a: 1,
        b: 2,
        sum: 3,
      });
    });

    test("嵌套数组和对象", () => {
      const a = variable<number>();
      const b = variable<string>();

      const nested = expr({ a, b })("{ arr: [a, a * 2], name: b }");
      const compiled = compile(nested, { a, b });
      expect(evaluate<{ arr: number[]; name: string }>(compiled, { a: 5, b: "test" })).toEqual({
        arr: [5, 10],
        name: "test",
      });
    });
  });
});
