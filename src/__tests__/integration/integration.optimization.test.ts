import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "../../index";
import { compileAndEvaluate } from "../unit/test-helper";

describe("集成测试：编译优化", () => {
  describe("引用计数内联优化", () => {
    test("单次引用子表达式仍被内联", () => {
      const x = variable<number>();
      const y = variable<number>();

      const sum = expr({ x, y })("x + y");
      const product = expr({ x, y })("x * y");
      const result = expr({ sum, product })("sum + product");

      const compiled = compile(result, { x, y });

      // 单次引用仍内联，只有一个表达式
      expect(compiled.length).toBe(2); // [变量名, 表达式]
      expect(compiled[0]).toEqual(["x", "y"]);

      const values = { x: 2, y: 3 };
      const evalResult = compileAndEvaluate<number>(result, { x, y }, values);
      expect(evalResult).toBe(11); // 2+3 + 2*3 = 5+6 = 11
    });

    test("多次引用子表达式推迟为独立编译", () => {
      const x = variable<number>();

      const sum = expr({ x })("x + 1");
      const result = expr({ sum })("sum * sum");

      const compiled = compile(result, { x });

      // sum 被引用 2 次，应推迟编译为独立表达式
      expect(compiled.length).toBe(3); // [变量名, sum表达式, 结果表达式]
      expect(compiled[0]).toEqual(["x"]);
      // sum 的编译结果
      expect(compiled[1]).toBe("$[0]+1");
      // 结果引用 $[1]（sum 的编译索引）
      expect(compiled[2]).toBe("$[1]*$[1]");

      const value = compileAndEvaluate<number>(result, { x }, { x: 2 });
      expect(value).toBe(9); // (2+1)*(2+1) = 3*3 = 9
    });

    test("多次引用 (3+ 次) 推迟为单次编译", () => {
      const x = variable<number>();

      const triple = expr({ x })("x * 3");
      const result = expr({ triple })("triple + triple + triple");

      const compiled = compile(result, { x });

      // triple 被引用 3 次，推迟编译为独立表达式
      expect(compiled.length).toBe(3);
      expect(compiled[0]).toEqual(["x"]);
      expect(compiled[1]).toBe("$[0]*3");
      expect(compiled[2]).toBe("$[1]+$[1]+$[1]");

      const value = compileAndEvaluate<number>(result, { x }, { x: 3 });
      expect(value).toBe(27); // 9+9+9
    });

    test("混用：单引用内联 + 多引用推迟", () => {
      const x = variable<number>();
      const y = variable<number>();

      // base 被后面多处引用
      const base = expr({ x, y })("x + y");
      // 在 product 中 base 只引用 1 次 → 内联
      const product = expr({ base })("base * 2");
      // 在 result 中 product 引用 1 次，base 引用 2 次
      const result = expr({ base, product })("base * base + product");

      const compiled = compile(result, { x, y });

      // base 被引用 2 次 → 推迟；product 引用 1 次 → 内联
      expect(compiled.length).toBe(3);
      expect(compiled[0]).toEqual(["x", "y"]);
      expect(compiled[1]).toBe("$[0]+$[1]"); // base
      // product 在创建时已将 base 内联为 x + y，故在 result 中 product 内联后
      // base 的外部引用用 $[2]，product 内部的 base 仍为 $[0]+$[1]
      expect(compiled[2]).toBe("$[2]*$[2]+($[0]+$[1])*2");

      const values = { x: 1, y: 2 };
      expect(compileAndEvaluate<number>(result, { x, y }, values)).toBe(15);
      // base = 3, product = base*2 = 6, result = 3*3 + 6 = 15
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

      // 单次引用全内联，只有一个最终表达式
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

    test("带短路运算符的推迟表达式", () => {
      const x = variable<number>();
      const y = variable<number>();

      const cond = expr({ x, y })("x > 0 && y > 0");
      const result = expr({ cond })("cond ? cond : false");

      const compiled = compile(result, { x, y });

      // cond 被引用 2 次 → 推迟，各自产生控制流节点
      // 包含: 变量名 + cond短路编译(4节点) + 三元编译(6节点)
      expect(compiled.length).toBeGreaterThan(3);
      expect(compiled[0]).toEqual(["x", "y"]);

      expect(compileAndEvaluate<boolean>(result, { x, y }, { x: 1, y: 2 })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { x, y }, { x: 0, y: 2 })).toBe(false);
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

    test("推迟表达式在求值时只计算一次", () => {
      const counter = variable<number>();

      // 构造一个会被引用多次的复杂表达式
      const expensive = expr({ counter })("counter + 1");
      const result = expr({ expensive })("expensive + expensive + expensive");

      // compile 的结果中有独立编译的 expensive 和一个使用 $[N] 引用的 result
      const compiled = compile(result, { counter });
      expect(compiled.length).toBe(3);

      // 验证编译结构中 expensive 只编译一次 (作为 $[1])
      expect(compiled[1]).toBe("$[0]+1");
      expect(compiled[2]).toBe("$[1]+$[1]+$[1]");

      // 通过调用 evaluate 多次验证
      expect(evaluate<number>(compiled, { counter: 0 })).toBe(3); // (0+1)+(0+1)+(0+1)
      expect(evaluate<number>(compiled, { counter: 5 })).toBe(18); // (5+1)+(5+1)+(5+1)
      expect(evaluate<number>(compiled, { counter: -1 })).toBe(0);
    });

    test("多次执行相同 compiled data 结果一致", () => {
      const x = variable<number>();
      const base = expr({ x })("x * x");
      const result = expr({ base })("base + base");

      const compiled = compile(result, { x });

      for (let i = -5; i <= 5; i++) {
        const expected = i * i + i * i;
        expect(evaluate<number>(compiled, { x: i })).toBe(expected);
      }
    });
  });
});
