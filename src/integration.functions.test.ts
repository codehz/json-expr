import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "./index";

describe("集成测试：函数调用", () => {
  describe("基础函数调用", () => {
    test("单参数函数", () => {
      // 定义单参数函数 double(x: number) => x * 2
      const double = variable<(x: number) => number>();
      const x = variable<number>();

      const doubleCallExpr = expr({ double, x })("double(x)");
      const doubleCompiled = compile(doubleCallExpr, { double, x });

      const result = evaluate<number>(doubleCompiled, {
        double: (n: number) => n * 2,
        x: 5,
      });
      expect(result).toBe(10);
    });
  });

  describe("多参数函数", () => {
    test("多参数函数调用", () => {
      // 定义多参数函数 add(a: number, b: number) => a + b
      const add = variable<(a: number, b: number) => number>();
      const a = variable<number>();
      const b = variable<number>();

      const addExpr = expr({ add, a, b })("add(a, b)");
      const addCompiled = compile(addExpr, { add, a, b });

      const result = evaluate<number>(addCompiled, {
        add: (x: number, y: number) => x + y,
        a: 7,
        b: 3,
      });
      expect(result).toBe(10);

      // 测试另外的值
      const result2 = evaluate<number>(addCompiled, {
        add: (x: number, y: number) => x + y,
        a: 100,
        b: 50,
      });
      expect(result2).toBe(150);
    });
  });

  describe("函数返回对象", () => {
    test("访问返回对象的属性", () => {
      // 定义返回对象的函数 getUser() => ({ name: string, age: number })
      const getUser = variable<() => { name: string; age: number }>();

      // 调用函数并访问返回对象的属性
      const userNameExpr = expr({ getUser })("getUser().name");
      const userNameCompiled = compile(userNameExpr, { getUser });

      const result = evaluate<string>(userNameCompiled, {
        getUser: () => ({ name: "Bob", age: 28 }),
      });
      expect(result).toBe("Bob");

      // 访问返回对象的 age 属性
      const userAgeExpr = expr({ getUser })("getUser().age");
      const userAgeCompiled = compile(userAgeExpr, { getUser });

      const ageResult = evaluate<number>(userAgeCompiled, {
        getUser: () => ({ name: "Bob", age: 28 }),
      });
      expect(ageResult).toBe(28);
    });
  });
});
