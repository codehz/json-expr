import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "./index";

describe("集成测试：复杂表达式组合", () => {
  describe("对象属性与函数组合", () => {
    test("函数调用对象属性", () => {
      const double = variable<(n: number) => number>();
      const obj = variable<{ value: number }>();

      const combinedExpr = expr({ double, obj })("double(obj.value)");
      const compiled = compile(combinedExpr, { double, obj });

      expect(evaluate<number>(compiled, { double: (n: number) => n * 2, obj: { value: 15 } })).toBe(30);
    });

    test("嵌套对象属性运算", () => {
      const obj = variable<{
        user: {
          name: string;
          age: number;
        };
      }>();

      const ageCalcExpr = expr({ obj })("obj.user.age * 2 + 10");
      const compiled = compile(ageCalcExpr, { obj });

      expect(evaluate<number>(compiled, { obj: { user: { name: "Alice", age: 30 } } })).toBe(70);
    });
  });

  describe("多函数组合", () => {
    test("函数链式调用", () => {
      const multiply = variable<(a: number, b: number) => number>();
      const add = variable<(a: number, b: number) => number>();
      const data = variable<{ x: number; y: number }>();

      // multiply(data.x, data.y) + add(data.x, data.y)
      const e1 = expr({ multiply, add, data })("multiply(data.x, data.y) + add(data.x, data.y)");
      const c1 = compile(e1, { multiply, add, data });
      expect(
        evaluate<number>(c1, {
          multiply: (a: number, b: number) => a * b,
          add: (a: number, b: number) => a + b,
          data: { x: 3, y: 4 },
        })
      ).toBe(19); // 12 + 7

      // 嵌套调用: multiply(add(data.x, data.y), data.x)
      const e2 = expr({ multiply, add, data })("multiply(add(data.x, data.y), data.x)");
      const c2 = compile(e2, { multiply, add, data });
      expect(
        evaluate<number>(c2, {
          multiply: (a: number, b: number) => a * b,
          add: (a: number, b: number) => a + b,
          data: { x: 5, y: 2 },
        })
      ).toBe(35); // (5+2) * 5
    });
  });

  describe("条件与计算混合", () => {
    test("条件表达式中使用复杂计算", () => {
      const x = variable<number>();
      const y = variable<number>();

      // 根据条件选择不同的计算方式
      const e = expr({ x, y })("x > y ? x * x - y : y * y - x");
      const compiled = compile(e, { x, y });

      expect(evaluate<number>(compiled, { x: 5, y: 3 })).toBe(22); // 25 - 3
      expect(evaluate<number>(compiled, { x: 3, y: 5 })).toBe(22); // 25 - 3
    });

    test("布尔逻辑控制计算路径", () => {
      const enabled = variable<boolean>();
      const value = variable<number>();
      const multiplier = variable<number>();

      const e = expr({ enabled, value, multiplier })("enabled && value > 0 ? value * multiplier : 0");
      const compiled = compile(e, { enabled, value, multiplier });

      expect(evaluate<number>(compiled, { enabled: true, value: 10, multiplier: 2 })).toBe(20);
      expect(evaluate<number>(compiled, { enabled: false, value: 10, multiplier: 2 })).toBe(0);
      expect(evaluate<number>(compiled, { enabled: true, value: -5, multiplier: 2 })).toBe(0);
    });
  });

  describe("表达式依赖链", () => {
    test("多层依赖的复杂表达式", () => {
      const x = variable<number>();
      const y = variable<number>();

      const sum = expr({ x, y })("x + y");
      const diff = expr({ x, y })("x - y");
      const product = expr({ sum, diff })("sum * diff"); // (x+y)(x-y) = x² - y²
      const final = expr({ product, x })("product + x * x"); // x² - y² + x² = 2x² - y²

      const compiled = compile(final, { x, y });

      // x=5, y=3: 2*25 - 9 = 41
      expect(evaluate<number>(compiled, { x: 5, y: 3 })).toBe(41);
      // x=10, y=4: 2*100 - 16 = 184
      expect(evaluate<number>(compiled, { x: 10, y: 4 })).toBe(184);
    });

    test("菱形依赖结构", () => {
      const x = variable<number>();

      //       base
      //      /    \
      //   left   right
      //      \    /
      //      result
      const base = expr({ x })("x * 2");
      const left = expr({ base })("base + 1");
      const right = expr({ base })("base - 1");
      const result = expr({ left, right })("left * right");

      const compiled = compile(result, { x });

      // x=5: base=10, left=11, right=9, result=99
      expect(evaluate<number>(compiled, { x: 5 })).toBe(99);
    });
  });

  describe("实际场景模拟", () => {
    test("价格计算", () => {
      const price = variable<number>();
      const quantity = variable<number>();
      const discount = variable<number>();
      const taxRate = variable<number>();

      const subtotal = expr({ price, quantity })("price * quantity");
      const discounted = expr({ subtotal, discount })("subtotal * (1 - discount)");
      const total = expr({ discounted, taxRate })("discounted * (1 + taxRate)");

      const compiled = compile(total, { price, quantity, discount, taxRate });

      // price=100, qty=3, discount=0.1, tax=0.08
      // subtotal=300, discounted=270, total=291.6
      expect(evaluate<number>(compiled, { price: 100, quantity: 3, discount: 0.1, taxRate: 0.08 })).toBeCloseTo(291.6);
    });

    test("坐标变换", () => {
      const x = variable<number>();
      const y = variable<number>();
      const angle = variable<number>();

      // 旋转变换
      const rotatedX = expr({ x, y, angle })("x * Math.cos(angle) - y * Math.sin(angle)");
      const rotatedY = expr({ x, y, angle })("x * Math.sin(angle) + y * Math.cos(angle)");

      // 计算旋转后距离原点的距离
      const distance = expr({ rotatedX, rotatedY })("Math.sqrt(rotatedX * rotatedX + rotatedY * rotatedY)");

      const compiled = compile(distance, { x, y, angle });

      // 旋转不改变距离
      const original = Math.sqrt(3 * 3 + 4 * 4); // 5
      expect(evaluate<number>(compiled, { x: 3, y: 4, angle: Math.PI / 4 })).toBeCloseTo(original);
      expect(evaluate<number>(compiled, { x: 3, y: 4, angle: Math.PI })).toBeCloseTo(original);
    });

    test("条件评分系统", () => {
      const score = variable<number>();
      const bonus = variable<number>();
      const penalty = variable<number>();

      const adjusted = expr({ score, bonus, penalty })("score + bonus - penalty");
      const clamped = expr({ adjusted })("Math.max(0, Math.min(100, adjusted))");
      const grade = expr({ clamped })(
        'clamped >= 90 ? "A" : clamped >= 80 ? "B" : clamped >= 70 ? "C" : clamped >= 60 ? "D" : "F"'
      );

      const compiled = compile(grade, { score, bonus, penalty });

      expect(evaluate<string>(compiled, { score: 85, bonus: 10, penalty: 5 })).toBe("A"); // 90
      expect(evaluate<string>(compiled, { score: 75, bonus: 0, penalty: 0 })).toBe("C");
      expect(evaluate<string>(compiled, { score: 50, bonus: 0, penalty: 0 })).toBe("F");
      expect(evaluate<string>(compiled, { score: 95, bonus: 20, penalty: 0 })).toBe("A"); // clamped to 100
    });
  });
});
