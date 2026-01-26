import { describe, expect, test } from "bun:test";
import { compile, expr, variable } from "../../index";
import { compileAndEvaluate } from "../unit/test-helper";

describe("短路求值测试", () => {
  describe("逻辑或 (||)", () => {
    test("短路: 左边为 true 时跳过右边", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();

      const result = expr({ a, b })("a || b");
      const compiled = compile(result, { a, b });

      // 验证编译结果包含控制流节点
      expect(compiled.some((e) => Array.isArray(e))).toBe(true);

      // 验证执行结果
      expect(compileAndEvaluate<boolean>(result, { a, b }, { a: true, b: false })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b }, { a: false, b: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b }, { a: false, b: false })).toBe(false);
    });

    test("短路: 返回第一个 truthy 值", () => {
      const a = variable<number>();
      const b = variable<number>();

      const result = expr({ a, b })("a || b");

      expect(compileAndEvaluate<number>(result, { a, b }, { a: 5, b: 10 })).toBe(5);
      expect(compileAndEvaluate<number>(result, { a, b }, { a: 0, b: 10 })).toBe(10);
    });
  });

  describe("逻辑与 (&&)", () => {
    test("短路: 左边为 false 时跳过右边", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();

      const result = expr({ a, b })("a && b");
      const compiled = compile(result, { a, b });

      expect(compiled.some((e) => Array.isArray(e))).toBe(true);

      expect(compileAndEvaluate<boolean>(result, { a, b }, { a: true, b: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b }, { a: true, b: false })).toBe(false);
      expect(compileAndEvaluate<boolean>(result, { a, b }, { a: false, b: true })).toBe(false);
    });

    test("短路: 返回第一个 falsy 值或最后一个值", () => {
      const a = variable<number>();
      const b = variable<number>();

      const result = expr({ a, b })("a && b");

      expect(compileAndEvaluate<number>(result, { a, b }, { a: 5, b: 10 })).toBe(10);
      expect(compileAndEvaluate<number>(result, { a, b }, { a: 0, b: 10 })).toBe(0);
    });
  });

  describe("空值合并 (??)", () => {
    test("短路: 左边非 null/undefined 时跳过右边", () => {
      const a = variable<number | null>();
      const b = variable<number>();

      const result = expr({ a, b })("a ?? b");
      const compiled = compile(result, { a, b });

      expect(compiled.some((e) => Array.isArray(e))).toBe(true);

      expect(compileAndEvaluate<number>(result, { a, b }, { a: 5, b: 10 })).toBe(5);
      expect(compileAndEvaluate<number>(result, { a, b }, { a: null, b: 10 })).toBe(10);
      expect(compileAndEvaluate<number>(result, { a, b }, { a: 0, b: 10 })).toBe(0); // 0 不是 null
    });
  });

  describe("三元表达式 (?:)", () => {
    test("短路: 只执行对应分支", () => {
      const cond = variable<boolean>();
      const x = variable<number>();
      const y = variable<number>();

      const result = expr({ cond, x, y })("cond ? x * 2 : y * 3");
      const compiled = compile(result, { cond, x, y });

      expect(compiled.some((e) => Array.isArray(e))).toBe(true);

      expect(compileAndEvaluate<number>(result, { cond, x, y }, { cond: true, x: 5, y: 10 })).toBe(10);
      expect(compileAndEvaluate<number>(result, { cond, x, y }, { cond: false, x: 5, y: 10 })).toBe(30);
    });
  });

  describe("嵌套控制流", () => {
    test("(a || b) && c", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();

      const orExpr = expr({ a, b })("a || b");
      const result = expr({ orExpr, c })("orExpr && c");

      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: true, b: false, c: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: false, b: true, c: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: true, b: false, c: false })).toBe(false);
      expect(compileAndEvaluate<boolean>(result, { a, b, c }, { a: false, b: false, c: true })).toBe(false);
    });

    test("a ? b || c : d && e", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();
      const d = variable<boolean>();
      const e = variable<boolean>();

      const result = expr({ a, b, c, d, e })("a ? b || c : d && e");

      // a=true: b || c
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: true, b: true, c: false, d: true, e: true })
      ).toBe(true);
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: true, b: false, c: true, d: true, e: true })
      ).toBe(true);

      // a=false: d && e
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: false, b: true, c: true, d: true, e: true })
      ).toBe(true);
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: false, b: true, c: true, d: false, e: true })
      ).toBe(false);
    });

    test("嵌套三元表达式: a ? (b ? c : d) : e", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<number>();
      const d = variable<number>();
      const e = variable<number>();

      const result = expr({ a, b, c, d, e })("a ? (b ? c : d) : e");

      // a=true, b=true: c
      expect(compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: true, b: true, c: 1, d: 2, e: 3 })).toBe(1);
      // a=true, b=false: d
      expect(compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: true, b: false, c: 1, d: 2, e: 3 })).toBe(2);
      // a=false: e
      expect(compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: false, b: true, c: 1, d: 2, e: 3 })).toBe(3);
      expect(compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: false, b: false, c: 1, d: 2, e: 3 })).toBe(3);
    });

    test("深度嵌套三元表达式: a ? b ? c ? 1 : 2 : 3 : 4", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();

      const result = expr({ a, b, c })("a ? b ? c ? 1 : 2 : 3 : 4");

      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: true, b: true, c: true })).toBe(1);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: true, b: true, c: false })).toBe(2);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: true, b: false, c: true })).toBe(3);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: true, b: false, c: false })).toBe(3);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: false, b: true, c: true })).toBe(4);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: false, b: false, c: false })).toBe(4);
    });

    test("链式逻辑或: a || b || c || d", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();
      const d = variable<number>();

      const result = expr({ a, b, c, d })("a || b || c || d");

      // 第一个 truthy 值应该被返回
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 1, b: 2, c: 3, d: 4 })).toBe(1);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 0, b: 2, c: 3, d: 4 })).toBe(2);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 0, b: 0, c: 3, d: 4 })).toBe(3);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 0, b: 0, c: 0, d: 4 })).toBe(4);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 0, b: 0, c: 0, d: 0 })).toBe(0);
    });

    test("链式逻辑与: a && b && c && d", () => {
      const a = variable<number>();
      const b = variable<number>();
      const c = variable<number>();
      const d = variable<number>();

      const result = expr({ a, b, c, d })("a && b && c && d");

      // 第一个 falsy 值或最后一个值应该被返回
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 1, b: 2, c: 3, d: 4 })).toBe(4);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 0, b: 2, c: 3, d: 4 })).toBe(0);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 1, b: 0, c: 3, d: 4 })).toBe(0);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 1, b: 2, c: 0, d: 4 })).toBe(0);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 1, b: 2, c: 3, d: 0 })).toBe(0);
    });

    test("链式空值合并: a ?? b ?? c ?? d", () => {
      const a = variable<number | null>();
      const b = variable<number | null>();
      const c = variable<number | null>();
      const d = variable<number>();

      const result = expr({ a, b, c, d })("a ?? b ?? c ?? d");

      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 1, b: 2, c: 3, d: 4 })).toBe(1);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: null, b: 2, c: 3, d: 4 })).toBe(2);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: null, b: null, c: 3, d: 4 })).toBe(3);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: null, b: null, c: null, d: 4 })).toBe(4);
      // 0 不是 null，应该返回 0
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: 0, b: 2, c: 3, d: 4 })).toBe(0);
    });

    test("混合运算符: (a || b) && (c || d)", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();
      const d = variable<boolean>();

      const result = expr({ a, b, c, d })("(a || b) && (c || d)");

      expect(compileAndEvaluate<boolean>(result, { a, b, c, d }, { a: true, b: false, c: true, d: false })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b, c, d }, { a: false, b: true, c: false, d: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b, c, d }, { a: false, b: false, c: true, d: true })).toBe(false);
      expect(compileAndEvaluate<boolean>(result, { a, b, c, d }, { a: true, b: true, c: false, d: false })).toBe(false);
    });

    test("混合运算符: a && b || c && d", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();
      const d = variable<boolean>();

      const result = expr({ a, b, c, d })("a && b || c && d");

      // (a && b) || (c && d)
      expect(compileAndEvaluate<boolean>(result, { a, b, c, d }, { a: true, b: true, c: false, d: false })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b, c, d }, { a: false, b: true, c: true, d: true })).toBe(true);
      expect(compileAndEvaluate<boolean>(result, { a, b, c, d }, { a: false, b: false, c: false, d: false })).toBe(
        false
      );
      expect(compileAndEvaluate<boolean>(result, { a, b, c, d }, { a: true, b: false, c: true, d: false })).toBe(false);
    });

    test("三元表达式内嵌套逻辑运算: a ? b && c : d || e", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();
      const d = variable<boolean>();
      const e = variable<boolean>();

      const result = expr({ a, b, c, d, e })("a ? b && c : d || e");

      // a=true: b && c
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: true, b: true, c: true, d: false, e: false })
      ).toBe(true);
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: true, b: true, c: false, d: true, e: true })
      ).toBe(false);
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: true, b: false, c: true, d: true, e: true })
      ).toBe(false);

      // a=false: d || e
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: false, b: true, c: true, d: true, e: false })
      ).toBe(true);
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: false, b: true, c: true, d: false, e: true })
      ).toBe(true);
      expect(
        compileAndEvaluate<boolean>(result, { a, b, c, d, e }, { a: false, b: true, c: true, d: false, e: false })
      ).toBe(false);
    });

    test("逻辑运算作为三元条件: (a && b) ? c : d", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<number>();
      const d = variable<number>();

      const result = expr({ a, b, c, d })("(a && b) ? c : d");

      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: true, b: true, c: 1, d: 2 })).toBe(1);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: true, b: false, c: 1, d: 2 })).toBe(2);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: false, b: true, c: 1, d: 2 })).toBe(2);
      expect(compileAndEvaluate<number>(result, { a, b, c, d }, { a: false, b: false, c: 1, d: 2 })).toBe(2);
    });

    test("复杂嵌套: (a || b) ? (c && d) : (e ?? f)", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();
      const d = variable<boolean>();
      const e = variable<boolean | null>();
      const f = variable<boolean>();

      const result = expr({ a, b, c, d, e, f })("(a || b) ? (c && d) : (e ?? f)");

      // 条件为 true: c && d
      expect(
        compileAndEvaluate<boolean>(
          result,
          { a, b, c, d, e, f },
          { a: true, b: false, c: true, d: true, e: null, f: false }
        )
      ).toBe(true);
      expect(
        compileAndEvaluate<boolean>(
          result,
          { a, b, c, d, e, f },
          { a: false, b: true, c: false, d: true, e: null, f: false }
        )
      ).toBe(false);

      // 条件为 false: e ?? f
      expect(
        compileAndEvaluate<boolean>(
          result,
          { a, b, c, d, e, f },
          { a: false, b: false, c: true, d: true, e: true, f: false }
        )
      ).toBe(true);
      expect(
        compileAndEvaluate<boolean>(
          result,
          { a, b, c, d, e, f },
          { a: false, b: false, c: true, d: true, e: null, f: true }
        )
      ).toBe(true);
      expect(
        compileAndEvaluate<boolean>(
          result,
          { a, b, c, d, e, f },
          { a: false, b: false, c: true, d: true, e: null, f: false }
        )
      ).toBe(false);
    });

    test("多层嵌套三元: a ? (b ? (c ? 1 : 2) : (d ? 3 : 4)) : (e ? 5 : 6)", () => {
      const a = variable<boolean>();
      const b = variable<boolean>();
      const c = variable<boolean>();
      const d = variable<boolean>();
      const e = variable<boolean>();

      const result = expr({ a, b, c, d, e })("a ? (b ? (c ? 1 : 2) : (d ? 3 : 4)) : (e ? 5 : 6)");

      // a=true, b=true
      expect(
        compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: true, b: true, c: true, d: false, e: false })
      ).toBe(1);
      expect(
        compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: true, b: true, c: false, d: false, e: false })
      ).toBe(2);

      // a=true, b=false
      expect(
        compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: true, b: false, c: false, d: true, e: false })
      ).toBe(3);
      expect(
        compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: true, b: false, c: false, d: false, e: false })
      ).toBe(4);

      // a=false
      expect(
        compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: false, b: false, c: false, d: false, e: true })
      ).toBe(5);
      expect(
        compileAndEvaluate<number>(result, { a, b, c, d, e }, { a: false, b: false, c: false, d: false, e: false })
      ).toBe(6);
    });

    test("空值合并与逻辑或混合: (a ?? b) || c", () => {
      const a = variable<number | null>();
      const b = variable<number>();
      const c = variable<number>();

      const result = expr({ a, b, c })("(a ?? b) || c");

      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: 5, b: 10, c: 20 })).toBe(5);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: null, b: 10, c: 20 })).toBe(10);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: null, b: 0, c: 20 })).toBe(20);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: 0, b: 10, c: 20 })).toBe(20); // 0 非 null 但 falsy
    });

    test("空值合并与逻辑与混合: (a ?? b) && c", () => {
      const a = variable<number | null>();
      const b = variable<number>();
      const c = variable<number>();

      const result = expr({ a, b, c })("(a ?? b) && c");

      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: 5, b: 10, c: 20 })).toBe(20);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: null, b: 10, c: 20 })).toBe(20);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: null, b: 0, c: 20 })).toBe(0);
      expect(compileAndEvaluate<number>(result, { a, b, c }, { a: 0, b: 10, c: 20 })).toBe(0); // 0 非 null 但 falsy
    });
  });
  describe("编译输出结构验证", () => {
    test("|| 生成正确的控制流结构", () => {
      const a = variable<number>();
      const b = variable<number>();

      const result = expr({ a, b })("a || b");
      const compiled = compile(result, { a, b });

      // 应该生成: $[0], ["br", "$[2]", 1], $[1], ["phi"]
      // 偏移量为 1，因为只需跳过 $[1] 一条指令
      expect(compiled[0]).toEqual(["a", "b"]);
      expect(compiled[1]).toBe("$[0]"); // 左操作数
      expect(compiled[2]).toEqual(["br", "$[2]", 1]); // 如果 $[2] 为 true，跳过 1 条
      expect(compiled[3]).toBe("$[1]"); // 右操作数
      expect(compiled[4]).toEqual(["phi"]); // phi 节点
    });

    test("&& 生成正确的控制流结构", () => {
      const a = variable<number>();
      const b = variable<number>();

      const result = expr({ a, b })("a && b");
      const compiled = compile(result, { a, b });

      expect(compiled[0]).toEqual(["a", "b"]);
      expect(compiled[1]).toBe("$[0]");
      expect(compiled[2]).toEqual(["br", "!$[2]", 1]); // 如果 !$[2] 为 true，跳过 1 条
      expect(compiled[3]).toBe("$[1]");
      expect(compiled[4]).toEqual(["phi"]);
    });

    test("?? 生成正确的控制流结构", () => {
      const a = variable<number | null>();
      const b = variable<number>();

      const result = expr({ a, b })("a ?? b");
      const compiled = compile(result, { a, b });

      expect(compiled[0]).toEqual(["a", "b"]);
      expect(compiled[1]).toBe("$[0]");
      expect(compiled[2]).toEqual(["br", "$[2]!=null", 1]); // 如果非 null，跳过 1 条
      expect(compiled[3]).toBe("$[1]");
      expect(compiled[4]).toEqual(["phi"]);
    });

    test("三元表达式生成正确的控制流结构", () => {
      const cond = variable<boolean>();
      const x = variable<number>();
      const y = variable<number>();

      const result = expr({ cond, x, y })("cond ? x : y");
      const compiled = compile(result, { cond, x, y });

      // 结构: $[0] (cond), ["br", "$[3]", offset], $[2] (else), ["jmp", offset], $[1] (then), ["phi"]
      expect(compiled[0]).toEqual(["cond", "x", "y"]);
      expect(compiled[1]).toBe("$[0]"); // 条件
      expect(compiled[2]![0]).toBe("br"); // 条件跳转
      expect(compiled[4]![0]).toBe("jmp"); // 无条件跳转
      expect(compiled[compiled.length - 1]).toEqual(["phi"]); // phi 节点
    });
  });
});
