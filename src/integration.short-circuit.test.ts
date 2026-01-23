import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { compile, evaluate, expr, variable } from "./index";

describe("短路求值测试", () => {
  describe("逻辑或 (||)", () => {
    test("短路: 左边为 true 时跳过右边", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());

      const result = expr({ a, b })("a || b");
      const compiled = compile(result, { a, b }, { shortCircuit: true });

      // 验证编译结果包含控制流节点
      expect(compiled.some((e) => Array.isArray(e))).toBe(true);

      // 验证执行结果
      expect(evaluate<boolean>(compiled, { a: true, b: false })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: false })).toBe(false);
    });

    test("短路: 返回第一个 truthy 值", () => {
      const a = variable(z.number());
      const b = variable(z.number());

      const result = expr({ a, b })("a || b");
      const compiled = compile(result, { a, b }, { shortCircuit: true });

      expect(evaluate<number>(compiled, { a: 5, b: 10 })).toBe(5);
      expect(evaluate<number>(compiled, { a: 0, b: 10 })).toBe(10);
    });
  });

  describe("逻辑与 (&&)", () => {
    test("短路: 左边为 false 时跳过右边", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());

      const result = expr({ a, b })("a && b");
      const compiled = compile(result, { a, b }, { shortCircuit: true });

      expect(compiled.some((e) => Array.isArray(e))).toBe(true);

      expect(evaluate<boolean>(compiled, { a: true, b: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: true, b: false })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: false, b: true })).toBe(false);
    });

    test("短路: 返回第一个 falsy 值或最后一个值", () => {
      const a = variable(z.number());
      const b = variable(z.number());

      const result = expr({ a, b })("a && b");
      const compiled = compile(result, { a, b }, { shortCircuit: true });

      expect(evaluate<number>(compiled, { a: 5, b: 10 })).toBe(10);
      expect(evaluate<number>(compiled, { a: 0, b: 10 })).toBe(0);
    });
  });

  describe("空值合并 (??)", () => {
    test("短路: 左边非 null/undefined 时跳过右边", () => {
      const a = variable(z.union([z.number(), z.null()]));
      const b = variable(z.number());

      const result = expr({ a, b })("a ?? b");
      const compiled = compile(result, { a, b }, { shortCircuit: true });

      expect(compiled.some((e) => Array.isArray(e))).toBe(true);

      expect(evaluate<number>(compiled, { a: 5, b: 10 })).toBe(5);
      expect(evaluate<number>(compiled, { a: null, b: 10 })).toBe(10);
      expect(evaluate<number>(compiled, { a: 0, b: 10 })).toBe(0); // 0 不是 null
    });
  });

  describe("三元表达式 (?:)", () => {
    test("短路: 只执行对应分支", () => {
      const cond = variable(z.boolean());
      const x = variable(z.number());
      const y = variable(z.number());

      const result = expr({ cond, x, y })("cond ? x * 2 : y * 3");
      const compiled = compile(result, { cond, x, y }, { shortCircuit: true });

      expect(compiled.some((e) => Array.isArray(e))).toBe(true);

      expect(evaluate<number>(compiled, { cond: true, x: 5, y: 10 })).toBe(10);
      expect(evaluate<number>(compiled, { cond: false, x: 5, y: 10 })).toBe(30);
    });
  });

  describe("嵌套控制流", () => {
    test("(a || b) && c", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());

      const orExpr = expr({ a, b })("a || b");
      const result = expr({ orExpr, c })("orExpr && c");
      const compiled = compile(result, { a, b, c }, { shortCircuit: true });

      expect(evaluate<boolean>(compiled, { a: true, b: false, c: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: true, b: false, c: false })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: false, b: false, c: true })).toBe(false);
    });

    test("a ? b || c : d && e", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());
      const d = variable(z.boolean());
      const e = variable(z.boolean());

      const result = expr({ a, b, c, d, e })("a ? b || c : d && e");
      const compiled = compile(result, { a, b, c, d, e }, { shortCircuit: true });

      // a=true: b || c
      expect(evaluate<boolean>(compiled, { a: true, b: true, c: false, d: true, e: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: true, b: false, c: true, d: true, e: true })).toBe(true);

      // a=false: d && e
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: true, d: true, e: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: true, d: false, e: true })).toBe(false);
    });

    test("嵌套三元表达式: a ? (b ? c : d) : e", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.number());
      const d = variable(z.number());
      const e = variable(z.number());

      const result = expr({ a, b, c, d, e })("a ? (b ? c : d) : e");
      const compiled = compile(result, { a, b, c, d, e }, { shortCircuit: true });

      // a=true, b=true: c
      expect(evaluate<number>(compiled, { a: true, b: true, c: 1, d: 2, e: 3 })).toBe(1);
      // a=true, b=false: d
      expect(evaluate<number>(compiled, { a: true, b: false, c: 1, d: 2, e: 3 })).toBe(2);
      // a=false: e
      expect(evaluate<number>(compiled, { a: false, b: true, c: 1, d: 2, e: 3 })).toBe(3);
      expect(evaluate<number>(compiled, { a: false, b: false, c: 1, d: 2, e: 3 })).toBe(3);
    });

    test("深度嵌套三元表达式: a ? b ? c ? 1 : 2 : 3 : 4", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());

      const result = expr({ a, b, c })("a ? b ? c ? 1 : 2 : 3 : 4");
      const compiled = compile(result, { a, b, c }, { shortCircuit: true });

      expect(evaluate<number>(compiled, { a: true, b: true, c: true })).toBe(1);
      expect(evaluate<number>(compiled, { a: true, b: true, c: false })).toBe(2);
      expect(evaluate<number>(compiled, { a: true, b: false, c: true })).toBe(3);
      expect(evaluate<number>(compiled, { a: true, b: false, c: false })).toBe(3);
      expect(evaluate<number>(compiled, { a: false, b: true, c: true })).toBe(4);
      expect(evaluate<number>(compiled, { a: false, b: false, c: false })).toBe(4);
    });

    test("链式逻辑或: a || b || c || d", () => {
      const a = variable(z.number());
      const b = variable(z.number());
      const c = variable(z.number());
      const d = variable(z.number());

      const result = expr({ a, b, c, d })("a || b || c || d");
      const compiled = compile(result, { a, b, c, d }, { shortCircuit: true });

      // 第一个 truthy 值应该被返回
      expect(evaluate<number>(compiled, { a: 1, b: 2, c: 3, d: 4 })).toBe(1);
      expect(evaluate<number>(compiled, { a: 0, b: 2, c: 3, d: 4 })).toBe(2);
      expect(evaluate<number>(compiled, { a: 0, b: 0, c: 3, d: 4 })).toBe(3);
      expect(evaluate<number>(compiled, { a: 0, b: 0, c: 0, d: 4 })).toBe(4);
      expect(evaluate<number>(compiled, { a: 0, b: 0, c: 0, d: 0 })).toBe(0);
    });

    test("链式逻辑与: a && b && c && d", () => {
      const a = variable(z.number());
      const b = variable(z.number());
      const c = variable(z.number());
      const d = variable(z.number());

      const result = expr({ a, b, c, d })("a && b && c && d");
      const compiled = compile(result, { a, b, c, d }, { shortCircuit: true });

      // 第一个 falsy 值或最后一个值应该被返回
      expect(evaluate<number>(compiled, { a: 1, b: 2, c: 3, d: 4 })).toBe(4);
      expect(evaluate<number>(compiled, { a: 0, b: 2, c: 3, d: 4 })).toBe(0);
      expect(evaluate<number>(compiled, { a: 1, b: 0, c: 3, d: 4 })).toBe(0);
      expect(evaluate<number>(compiled, { a: 1, b: 2, c: 0, d: 4 })).toBe(0);
      expect(evaluate<number>(compiled, { a: 1, b: 2, c: 3, d: 0 })).toBe(0);
    });

    test("链式空值合并: a ?? b ?? c ?? d", () => {
      const a = variable(z.union([z.number(), z.null()]));
      const b = variable(z.union([z.number(), z.null()]));
      const c = variable(z.union([z.number(), z.null()]));
      const d = variable(z.number());

      const result = expr({ a, b, c, d })("a ?? b ?? c ?? d");
      const compiled = compile(result, { a, b, c, d }, { shortCircuit: true });

      expect(evaluate<number>(compiled, { a: 1, b: 2, c: 3, d: 4 })).toBe(1);
      expect(evaluate<number>(compiled, { a: null, b: 2, c: 3, d: 4 })).toBe(2);
      expect(evaluate<number>(compiled, { a: null, b: null, c: 3, d: 4 })).toBe(3);
      expect(evaluate<number>(compiled, { a: null, b: null, c: null, d: 4 })).toBe(4);
      // 0 不是 null，应该返回 0
      expect(evaluate<number>(compiled, { a: 0, b: 2, c: 3, d: 4 })).toBe(0);
    });

    test("混合运算符: (a || b) && (c || d)", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());
      const d = variable(z.boolean());

      const result = expr({ a, b, c, d })("(a || b) && (c || d)");
      const compiled = compile(result, { a, b, c, d }, { shortCircuit: true });

      expect(evaluate<boolean>(compiled, { a: true, b: false, c: true, d: false })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: false, d: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: false, c: true, d: true })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: true, b: true, c: false, d: false })).toBe(false);
    });

    test("混合运算符: a && b || c && d", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());
      const d = variable(z.boolean());

      const result = expr({ a, b, c, d })("a && b || c && d");
      const compiled = compile(result, { a, b, c, d }, { shortCircuit: true });

      // (a && b) || (c && d)
      expect(evaluate<boolean>(compiled, { a: true, b: true, c: false, d: false })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: true, d: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: false, c: false, d: false })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: true, b: false, c: true, d: false })).toBe(false);
    });

    test("三元表达式内嵌套逻辑运算: a ? b && c : d || e", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());
      const d = variable(z.boolean());
      const e = variable(z.boolean());

      const result = expr({ a, b, c, d, e })("a ? b && c : d || e");
      const compiled = compile(result, { a, b, c, d, e }, { shortCircuit: true });

      // a=true: b && c
      expect(evaluate<boolean>(compiled, { a: true, b: true, c: true, d: false, e: false })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: true, b: true, c: false, d: true, e: true })).toBe(false);
      expect(evaluate<boolean>(compiled, { a: true, b: false, c: true, d: true, e: true })).toBe(false);

      // a=false: d || e
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: true, d: true, e: false })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: true, d: false, e: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: true, d: false, e: false })).toBe(false);
    });

    test("逻辑运算作为三元条件: (a && b) ? c : d", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.number());
      const d = variable(z.number());

      const result = expr({ a, b, c, d })("(a && b) ? c : d");
      const compiled = compile(result, { a, b, c, d }, { shortCircuit: true });

      expect(evaluate<number>(compiled, { a: true, b: true, c: 1, d: 2 })).toBe(1);
      expect(evaluate<number>(compiled, { a: true, b: false, c: 1, d: 2 })).toBe(2);
      expect(evaluate<number>(compiled, { a: false, b: true, c: 1, d: 2 })).toBe(2);
      expect(evaluate<number>(compiled, { a: false, b: false, c: 1, d: 2 })).toBe(2);
    });

    test("复杂嵌套: (a || b) ? (c && d) : (e ?? f)", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());
      const d = variable(z.boolean());
      const e = variable(z.union([z.boolean(), z.null()]));
      const f = variable(z.boolean());

      const result = expr({ a, b, c, d, e, f })("(a || b) ? (c && d) : (e ?? f)");
      const compiled = compile(result, { a, b, c, d, e, f }, { shortCircuit: true });

      // 条件为 true: c && d
      expect(evaluate<boolean>(compiled, { a: true, b: false, c: true, d: true, e: null, f: false })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: true, c: false, d: true, e: null, f: false })).toBe(false);

      // 条件为 false: e ?? f
      expect(evaluate<boolean>(compiled, { a: false, b: false, c: true, d: true, e: true, f: false })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: false, c: true, d: true, e: null, f: true })).toBe(true);
      expect(evaluate<boolean>(compiled, { a: false, b: false, c: true, d: true, e: null, f: false })).toBe(false);
    });

    test("多层嵌套三元: a ? (b ? (c ? 1 : 2) : (d ? 3 : 4)) : (e ? 5 : 6)", () => {
      const a = variable(z.boolean());
      const b = variable(z.boolean());
      const c = variable(z.boolean());
      const d = variable(z.boolean());
      const e = variable(z.boolean());

      const result = expr({ a, b, c, d, e })("a ? (b ? (c ? 1 : 2) : (d ? 3 : 4)) : (e ? 5 : 6)");
      const compiled = compile(result, { a, b, c, d, e }, { shortCircuit: true });

      // a=true, b=true
      expect(evaluate<number>(compiled, { a: true, b: true, c: true, d: false, e: false })).toBe(1);
      expect(evaluate<number>(compiled, { a: true, b: true, c: false, d: false, e: false })).toBe(2);

      // a=true, b=false
      expect(evaluate<number>(compiled, { a: true, b: false, c: false, d: true, e: false })).toBe(3);
      expect(evaluate<number>(compiled, { a: true, b: false, c: false, d: false, e: false })).toBe(4);

      // a=false
      expect(evaluate<number>(compiled, { a: false, b: false, c: false, d: false, e: true })).toBe(5);
      expect(evaluate<number>(compiled, { a: false, b: false, c: false, d: false, e: false })).toBe(6);
    });

    test("空值合并与逻辑或混合: (a ?? b) || c", () => {
      const a = variable(z.union([z.number(), z.null()]));
      const b = variable(z.number());
      const c = variable(z.number());

      const result = expr({ a, b, c })("(a ?? b) || c");
      const compiled = compile(result, { a, b, c }, { shortCircuit: true });

      expect(evaluate<number>(compiled, { a: 5, b: 10, c: 20 })).toBe(5);
      expect(evaluate<number>(compiled, { a: null, b: 10, c: 20 })).toBe(10);
      expect(evaluate<number>(compiled, { a: null, b: 0, c: 20 })).toBe(20);
      expect(evaluate<number>(compiled, { a: 0, b: 10, c: 20 })).toBe(20); // 0 非 null 但 falsy
    });

    test("空值合并与逻辑与混合: (a ?? b) && c", () => {
      const a = variable(z.union([z.number(), z.null()]));
      const b = variable(z.number());
      const c = variable(z.number());

      const result = expr({ a, b, c })("(a ?? b) && c");
      const compiled = compile(result, { a, b, c }, { shortCircuit: true });

      expect(evaluate<number>(compiled, { a: 5, b: 10, c: 20 })).toBe(20);
      expect(evaluate<number>(compiled, { a: null, b: 10, c: 20 })).toBe(20);
      expect(evaluate<number>(compiled, { a: null, b: 0, c: 20 })).toBe(0);
      expect(evaluate<number>(compiled, { a: 0, b: 10, c: 20 })).toBe(0); // 0 非 null 但 falsy
    });
  });

  describe("与非短路模式对比", () => {
    test("结果应该相同", () => {
      const a = variable(z.number());
      const b = variable(z.number());

      const result = expr({ a, b })("a || b");
      const compiledV1 = compile(result, { a, b }, { shortCircuit: false });
      const compiledV2 = compile(result, { a, b }, { shortCircuit: true });

      // V1 应该没有控制流节点
      expect(compiledV1.every((e) => typeof e === "string" || (Array.isArray(e) && typeof e[0] === "string"))).toBe(
        true
      );

      // 结果应该相同
      const testCases = [
        { a: 5, b: 10 },
        { a: 0, b: 10 },
        { a: 0, b: 0 },
      ];

      for (const values of testCases) {
        expect(evaluate<number>(compiledV1, values)).toBe(evaluate<number>(compiledV2, values));
      }
    });
  });

  describe("编译输出结构验证", () => {
    test("|| 生成正确的控制流结构", () => {
      const a = variable(z.number());
      const b = variable(z.number());

      const result = expr({ a, b })("a || b");
      const compiled = compile(result, { a, b }, { shortCircuit: true });

      // 应该生成: $0, ["br", "$2", 1], $1, ["phi"]
      // 偏移量为 1，因为只需跳过 $1 一条指令
      expect(compiled[0]).toEqual(["a", "b"]);
      expect(compiled[1]).toBe("$0"); // 左操作数
      expect(compiled[2]).toEqual(["br", "$2", 1]); // 如果 $2 为 true，跳过 1 条
      expect(compiled[3]).toBe("$1"); // 右操作数
      expect(compiled[4]).toEqual(["phi"]); // phi 节点
    });

    test("&& 生成正确的控制流结构", () => {
      const a = variable(z.number());
      const b = variable(z.number());

      const result = expr({ a, b })("a && b");
      const compiled = compile(result, { a, b }, { shortCircuit: true });

      expect(compiled[0]).toEqual(["a", "b"]);
      expect(compiled[1]).toBe("$0");
      expect(compiled[2]).toEqual(["br", "!$2", 1]); // 如果 !$2 为 true，跳过 1 条
      expect(compiled[3]).toBe("$1");
      expect(compiled[4]).toEqual(["phi"]);
    });

    test("?? 生成正确的控制流结构", () => {
      const a = variable(z.union([z.number(), z.null()]));
      const b = variable(z.number());

      const result = expr({ a, b })("a ?? b");
      const compiled = compile(result, { a, b }, { shortCircuit: true });

      expect(compiled[0]).toEqual(["a", "b"]);
      expect(compiled[1]).toBe("$0");
      expect(compiled[2]).toEqual(["br", "$2!=null", 1]); // 如果非 null，跳过 1 条
      expect(compiled[3]).toBe("$1");
      expect(compiled[4]).toEqual(["phi"]);
    });

    test("三元表达式生成正确的控制流结构", () => {
      const cond = variable(z.boolean());
      const x = variable(z.number());
      const y = variable(z.number());

      const result = expr({ cond, x, y })("cond ? x : y");
      const compiled = compile(result, { cond, x, y }, { shortCircuit: true });

      // 结构: $0 (cond), ["br", "$3", offset], $2 (else), ["jmp", offset], $1 (then), ["phi"]
      expect(compiled[0]).toEqual(["cond", "x", "y"]);
      expect(compiled[1]).toBe("$0"); // 条件
      expect(compiled[2]![0]).toBe("br"); // 条件跳转
      expect(compiled[4]![0]).toBe("jmp"); // 无条件跳转
      expect(compiled[compiled.length - 1]).toEqual(["phi"]); // phi 节点
    });
  });
});
