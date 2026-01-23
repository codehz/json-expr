import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { compile, expr, variable } from "./index";

describe("compile 单元测试", () => {
  describe("编译输出格式", () => {
    test("基本结构: [变量名数组, ...表达式]", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const sum = expr({ x, y })("x + y");
      const result = compile(sum, { x, y });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(["x", "y"]);
      expect(typeof result[1]).toBe("string");
    });

    test("变量占位符替换", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const sum = expr({ x, y })("x + y");
      const result = compile(sum, { x, y });

      // 变量被替换为 $0, $1 等
      expect(result[1]).toBe("$0+$1");
    });

    test("变量顺序与声明顺序一致", () => {
      const a = variable(z.number());
      const b = variable(z.number());
      const c = variable(z.number());

      const expr1 = expr({ a, b, c })("c + b + a");
      const result = compile(expr1, { a, b, c });

      expect(result[0]).toEqual(["a", "b", "c"]);
    });

    test("相似变量名正确区分", () => {
      const x = variable(z.number());
      const xy = variable(z.number());

      // xy 不应该被 x 的替换影响
      const e = expr({ xy, x })("xy + x");
      const result = compile(e, { xy, x });

      expect(result[0]).toEqual(["xy", "x"]);
      expect(result[1]).toBe("$0+$1");
    });
  });

  describe("错误检测", () => {
    test("检测未定义的变量引用", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const sum = expr({ x, y })("x + y + z");

      expect(() => {
        compile(sum, { x, y });
      }).toThrow();
    });

    test("检测表达式中引用不存在的上下文变量", () => {
      const x = variable(z.number());

      const e1 = expr({ x })("x + 1");
      const e2 = expr({ e1 })("e1 + e2"); // e2 不存在

      expect(() => {
        compile(e2, { x });
      }).toThrow();
    });
  });

  describe("内联优化输出", () => {
    test("内联模式减少表达式数量", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const sum = expr({ x, y })("x + y");
      const product = expr({ x, y })("x * y");
      const result = expr({ sum, product })("sum + product");

      const inlined = compile(result, { x, y }); // 默认内联
      const notInlined = compile(result, { x, y }, { inline: false });

      expect(inlined.length).toBe(2);
      expect(notInlined.length).toBe(4);
    });

    test("非内联模式保留所有中间表达式", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const sum = expr({ x, y })("x + y");
      const product = expr({ x, y })("x * y");
      const result = expr({ sum, product })("sum + product");

      const compiled = compile(result, { x, y }, { inline: false });

      expect(compiled).toHaveLength(4);
      expect(compiled[0]).toEqual(["x", "y"]);
      expect(compiled[1]).toBe("$0+$1"); // sum
      expect(compiled[2]).toBe("$0*$1"); // product
      expect(compiled[3]).toBe("$2+$3"); // result
    });
  });

  describe("AST 规范化", () => {
    test("输出不包含多余空格", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      // 原始表达式有空格
      const e = expr({ x, y })("x + y * 2");
      const result = compile(e, { x, y });

      // 输出应该是规范化的
      expect(result[1]).toBe("$0+$1*2");
    });

    test("保留必要的括号", () => {
      const x = variable(z.number());
      const y = variable(z.number());

      const e = expr({ x, y })("(x + y) * 2");
      const result = compile(e, { x, y });

      // 括号应该被保留以保持正确的运算顺序
      expect(result[1]).toBe("($0+$1)*2");
    });
  });
});
