import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "../../index";

describe("compile 单元测试", () => {
  describe("编译输出格式", () => {
    test("基本结构: [变量名数组, ...表达式]", () => {
      const x = variable<number>();
      const y = variable<number>();

      const sum = expr({ x, y })("x + y");
      const result = compile(sum, { x, y });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(["x", "y"]);
      expect(typeof result[1]).toBe("string");
    });

    test("变量占位符替换", () => {
      const x = variable<number>();
      const y = variable<number>();

      const sum = expr({ x, y })("x + y");
      const result = compile(sum, { x, y });

      // 变量被替换为 $[0], $[1] 等
      expect(result[1]).toBe("$[0]+$[1]");
    });

    test("变量顺序与声明顺序一致", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();

      const expr1 = expr({ a, b, c })("c + b + a");
      const result = compile(expr1, { a, b, c });

      expect(result[0]).toEqual(["a", "b", "c"]);
    });

    test("相似变量名正确区分", () => {
      const x = variable<number>();
      const xy = variable<number>();

      // xy 不应该被 x 的替换影响
      const e = expr({ xy, x })("xy + x");
      const result = compile(e, { xy, x });

      expect(result[0]).toEqual(["xy", "x"]);
      expect(result[1]).toBe("$[0]+$[1]");
    });
  });

  describe("错误检测", () => {
    test("未定义的变量抛出错误", () => {
      const x = variable<number>();
      const y = variable<number>();

      // 未定义的变量 z 会导致编译时抛出错误
      const sum = expr({ x, y })("x + y + z");

      expect(() => {
        compile(sum, { x, y });
      }).toThrow("Undefined variable(s): z");
    });
  });

  describe("引用计数内联", () => {
    test("单引用子表达式被内联", () => {
      const x = variable<number>();
      const y = variable<number>();

      const sum = expr({ x, y })("x + y");
      const product = expr({ x, y })("x * y");
      const result = expr({ sum, product })("sum + product");

      const compiled = compile(result, { x, y });
      expect(compiled.length).toBe(2); // [变量名, 表达式]
      expect(compiled[0]).toEqual(["x", "y"]);
    });

    test("多引用子表达式推迟为独立编译", () => {
      const x = variable<number>();

      const base = expr({ x })("x + 1");
      const result = expr({ base })("base * base");

      const compiled = compile(result, { x });
      expect(compiled.length).toBe(3); // [var, base编译, 结果编译]
      expect(compiled[0]).toEqual(["x"]);
      expect(compiled[1]).toBe("$[0]+1");
      expect(compiled[2]).toBe("$[1]*$[1]");
    });
  });

  describe("AST 规范化", () => {
    test("输出不包含多余空格", () => {
      const x = variable<number>();
      const y = variable<number>();

      // 原始表达式有空格
      const e = expr({ x, y })("x + y * 2");
      const result = compile(e, { x, y });

      // 输出应该是规范化的
      expect(result[1]).toBe("$[0]+$[1]*2");
    });

    test("保留必要的括号", () => {
      const x = variable<number>();
      const y = variable<number>();

      const e = expr({ x, y })("(x + y) * 2");
      const result = compile(e, { x, y });

      // 括号应该被保留以保持正确的运算顺序
      expect(result[1]).toBe("($[0]+$[1])*2");
    });
  });

  describe("支持直接传入对象/数组", () => {
    test("支持对象中包含 Proxy", () => {
      const x = variable<number>();
      const y = variable<number>();
      const sum = expr({ x, y })("x + y");

      const result = compile({ sum, x, constant: 1 }, { x, y });

      expect(result[0]).toEqual(["x", "y"]);
      expect(result[1]).toBe("{sum:$[0]+$[1],x:$[0],constant:1}");
    });

    test("支持对象中包含带 deferred 子表达式的 Proxy", () => {
      const input = variable<{ fallbackTargetX: number }>();
      const testExpr = expr({
        fallbackTargetX: input.fallbackTargetX,
      })("fallbackTargetX >= 0 ? fallbackTargetX : -1");

      const compiled = compile({ testExpr }, { input });

      expect(compiled[0]).toEqual(["input"]);
      expect(evaluate<{ testExpr: number }>(compiled, { input: { fallbackTargetX: 3 } })).toEqual({ testExpr: 3 });
      expect(evaluate<{ testExpr: number }>(compiled, { input: { fallbackTargetX: -2 } })).toEqual({ testExpr: -1 });
    });

    test("支持数组中包含 Proxy", () => {
      const x = variable<number[]>();
      const result = compile([x, x.at(0), 42], { x });

      expect(result[0]).toEqual(["x"]);
      expect(result[1]).toBe("[$[0],$[0].at(0),42]");
    });

    test("支持数组中包含带 deferred 子表达式的 Proxy", () => {
      const input = variable<{ fallbackTargetX: number }>();
      const testExpr = expr({
        fallbackTargetX: input.fallbackTargetX,
      })("fallbackTargetX >= 0 ? fallbackTargetX : -1");

      const compiled = compile([{ testExpr }], { input });

      expect(evaluate<[{ testExpr: number }]>(compiled, { input: { fallbackTargetX: 4 } })).toEqual([{ testExpr: 4 }]);
      expect(evaluate<[{ testExpr: number }]>(compiled, { input: { fallbackTargetX: -4 } })).toEqual([
        { testExpr: -1 },
      ]);
    });

    test("支持深层嵌套对象/数组中包含带 deferred 子表达式的 Proxy", () => {
      const input = variable<{ fallbackTargetX: number }>();
      const testExpr = expr({
        fallbackTargetX: input.fallbackTargetX,
      })("fallbackTargetX >= 0 ? fallbackTargetX : -1");

      const compiled = compile({ a: [testExpr] }, { input });

      expect(evaluate<{ a: number[] }>(compiled, { input: { fallbackTargetX: 8 } })).toEqual({ a: [8] });
      expect(evaluate<{ a: number[] }>(compiled, { input: { fallbackTargetX: -8 } })).toEqual({ a: [-1] });
    });

    test("支持多个嵌套 Proxy 的 deferred 名称隔离", () => {
      const left = variable<number>();
      const right = variable<number>();

      const leftBase = expr({ left })("left + 1");
      const leftExpr = expr({ base: leftBase })("base * base");

      const rightBase = expr({ right })("right + 2");
      const rightExpr = expr({ base: rightBase })("base * base");

      const compiled = compile({ leftExpr, rightExpr }, { left, right });

      expect(evaluate<{ leftExpr: number; rightExpr: number }>(compiled, { left: 2, right: 3 })).toEqual({
        leftExpr: 9,
        rightExpr: 25,
      });
    });

    test("支持直接传入 root variable", () => {
      const x = variable<number>();
      const result = compile(x, { x });

      expect(result[0]).toEqual(["x"]);
      expect(result[1]).toBe("$[0]");
    });

    test("支持原始值", () => {
      const result = compile(123, {});
      expect(result[1]).toBe("123");
    });
  });
});
