import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "./index";

describe("集成测试：Math 数学函数", () => {
  describe("基本函数", () => {
    test("绝对值、平方根、立方根", () => {
      const x = variable<number>();

      // Math.abs - 绝对值
      const absExpr = expr({ x })("Math.abs(x)");
      const absCompiled = compile(absExpr, { x });
      expect(evaluate<number>(absCompiled, { x: -5 })).toBe(5);
      expect(evaluate<number>(absCompiled, { x: 5 })).toBe(5);

      // Math.sqrt - 平方根
      const sqrtExpr = expr({ x })("Math.sqrt(x)");
      const sqrtCompiled = compile(sqrtExpr, { x });
      expect(evaluate<number>(sqrtCompiled, { x: 16 })).toBe(4);
      expect(evaluate<number>(sqrtCompiled, { x: 2 })).toBeCloseTo(Math.SQRT2);

      // Math.cbrt - 立方根
      const cbrtExpr = expr({ x })("Math.cbrt(x)");
      const cbrtCompiled = compile(cbrtExpr, { x });
      expect(evaluate<number>(cbrtCompiled, { x: 27 })).toBe(3);
    });
  });

  describe("三角函数", () => {
    test("正弦、余弦、正切", () => {
      const angle = variable<number>();

      // Math.sin
      const sinExpr = expr({ angle })("Math.sin(angle)");
      const sinCompiled = compile(sinExpr, { angle });
      expect(evaluate<number>(sinCompiled, { angle: 0 })).toBe(0);
      expect(evaluate<number>(sinCompiled, { angle: Math.PI / 2 })).toBeCloseTo(1);

      // Math.cos
      const cosExpr = expr({ angle })("Math.cos(angle)");
      const cosCompiled = compile(cosExpr, { angle });
      expect(evaluate<number>(cosCompiled, { angle: 0 })).toBe(1);
      expect(evaluate<number>(cosCompiled, { angle: Math.PI })).toBeCloseTo(-1);

      // Math.tan
      const tanExpr = expr({ angle })("Math.tan(angle)");
      const tanCompiled = compile(tanExpr, { angle });
      expect(evaluate<number>(tanCompiled, { angle: 0 })).toBe(0);
      expect(evaluate<number>(tanCompiled, { angle: Math.PI / 4 })).toBeCloseTo(1);
    });
  });

  describe("幂和对数", () => {
    test("幂运算、指数、对数", () => {
      const x = variable<number>();
      const y = variable<number>();

      // Math.pow - 幂运算
      const powExpr = expr({ x, y })("Math.pow(x, y)");
      const powCompiled = compile(powExpr, { x, y });
      expect(evaluate<number>(powCompiled, { x: 2, y: 3 })).toBe(8);
      expect(evaluate<number>(powCompiled, { x: 3, y: 2 })).toBe(9);

      // Math.exp - e 的幂
      const expExpr = expr({ x })("Math.exp(x)");
      const expCompiled = compile(expExpr, { x });
      expect(evaluate<number>(expCompiled, { x: 0 })).toBe(1);
      expect(evaluate<number>(expCompiled, { x: 1 })).toBeCloseTo(Math.E);

      // Math.log - 自然对数
      const logExpr = expr({ x })("Math.log(x)");
      const logCompiled = compile(logExpr, { x });
      expect(evaluate<number>(logCompiled, { x: 1 })).toBe(0);
      expect(evaluate<number>(logCompiled, { x: Math.E })).toBeCloseTo(1);

      // Math.log10 - 以 10 为底的对数
      const log10Expr = expr({ x })("Math.log10(x)");
      const log10Compiled = compile(log10Expr, { x });
      expect(evaluate<number>(log10Compiled, { x: 100 })).toBe(2);
      expect(evaluate<number>(log10Compiled, { x: 1000 })).toBe(3);
    });
  });

  describe("取整函数", () => {
    test("向下取整、向上取整、四舍五入、截断", () => {
      const x = variable<number>();

      // Math.floor - 向下取整
      const floorExpr = expr({ x })("Math.floor(x)");
      const floorCompiled = compile(floorExpr, { x });
      expect(evaluate<number>(floorCompiled, { x: 4.7 })).toBe(4);
      expect(evaluate<number>(floorCompiled, { x: -4.3 })).toBe(-5);

      // Math.ceil - 向上取整
      const ceilExpr = expr({ x })("Math.ceil(x)");
      const ceilCompiled = compile(ceilExpr, { x });
      expect(evaluate<number>(ceilCompiled, { x: 4.3 })).toBe(5);
      expect(evaluate<number>(ceilCompiled, { x: -4.7 })).toBe(-4);

      // Math.round - 四舍五入
      const roundExpr = expr({ x })("Math.round(x)");
      const roundCompiled = compile(roundExpr, { x });
      expect(evaluate<number>(roundCompiled, { x: 4.5 })).toBe(5);
      expect(evaluate<number>(roundCompiled, { x: 4.4 })).toBe(4);

      // Math.trunc - 截断小数部分
      const truncExpr = expr({ x })("Math.trunc(x)");
      const truncCompiled = compile(truncExpr, { x });
      expect(evaluate<number>(truncCompiled, { x: 4.7 })).toBe(4);
      expect(evaluate<number>(truncCompiled, { x: -4.7 })).toBe(-4);
    });
  });

  describe("最值函数", () => {
    test("最小值、最大值", () => {
      const x = variable<number>();
      const y = variable<number>();
      const zVar = variable<number>();

      // Math.min
      const minExpr = expr({ x, y })("Math.min(x, y)");
      const minCompiled = compile(minExpr, { x, y });
      expect(evaluate<number>(minCompiled, { x: 3, y: 7 })).toBe(3);
      expect(evaluate<number>(minCompiled, { x: -2, y: 5 })).toBe(-2);

      // Math.max
      const maxExpr = expr({ x, y })("Math.max(x, y)");
      const maxCompiled = compile(maxExpr, { x, y });
      expect(evaluate<number>(maxCompiled, { x: 3, y: 7 })).toBe(7);
      expect(evaluate<number>(maxCompiled, { x: -2, y: 5 })).toBe(5);

      // Math.min/max with multiple arguments
      const min3Expr = expr({ x, y, zVar })("Math.min(x, y, zVar)");
      const min3Compiled = compile(min3Expr, { x, y, zVar });
      expect(evaluate<number>(min3Compiled, { x: 5, y: 2, zVar: 8 })).toBe(2);

      const max3Expr = expr({ x, y, zVar })("Math.max(x, y, zVar)");
      const max3Compiled = compile(max3Expr, { x, y, zVar });
      expect(evaluate<number>(max3Compiled, { x: 5, y: 2, zVar: 8 })).toBe(8);
    });
  });

  describe("组合使用", () => {
    test("复合表达式计算", () => {
      const x = variable<number>();
      const y = variable<number>();

      // 计算两点距离: sqrt(x^2 + y^2)
      const distance = expr({ x, y })("Math.sqrt(x * x + y * y)");
      const distCompiled = compile(distance, { x, y });
      expect(evaluate<number>(distCompiled, { x: 3, y: 4 })).toBe(5); // 3-4-5 三角形

      // 使用 Math.hypot 简化
      const hypotExpr = expr({ x, y })("Math.hypot(x, y)");
      const hypotCompiled = compile(hypotExpr, { x, y });
      expect(evaluate<number>(hypotCompiled, { x: 3, y: 4 })).toBe(5);

      // 复合表达式: abs(sin(x)) + log(1 + y)
      const complexMath = expr({ x, y })("Math.abs(Math.sin(x)) + Math.log(1 + y)");
      const complexCompiled = compile(complexMath, { x, y });
      const result = evaluate<number>(complexCompiled, { x: Math.PI, y: Math.E - 1 });
      // sin(PI) ≈ 0, log(E) = 1
      expect(result).toBeCloseTo(1);
    });
  });

  describe("嵌套表达式中使用", () => {
    test("极坐标转换", () => {
      const r = variable<number>();
      const theta = variable<number>();

      // 极坐标转笛卡尔坐标
      const xCoord = expr({ r, theta })("r * Math.cos(theta)");
      const yCoord = expr({ r, theta })("r * Math.sin(theta)");

      // 验证: r=1, theta=0 -> (1, 0)
      const xCompiled = compile(xCoord, { r, theta });
      const yCompiled = compile(yCoord, { r, theta });

      expect(evaluate<number>(xCompiled, { r: 1, theta: 0 })).toBeCloseTo(1);
      expect(evaluate<number>(yCompiled, { r: 1, theta: 0 })).toBeCloseTo(0);

      // 验证: r=1, theta=PI/2 -> (0, 1)
      expect(evaluate<number>(xCompiled, { r: 1, theta: Math.PI / 2 })).toBeCloseTo(0);
      expect(evaluate<number>(yCompiled, { r: 1, theta: Math.PI / 2 })).toBeCloseTo(1);

      // 组合 x 和 y 计算回原距离
      const distFromOrigin = expr({ xCoord, yCoord })("Math.sqrt(xCoord * xCoord + yCoord * yCoord)");
      const distCompiled = compile(distFromOrigin, { r, theta });

      // 任意角度，距离应等于 r
      expect(evaluate<number>(distCompiled, { r: 5, theta: Math.PI / 3 })).toBeCloseTo(5);
      expect(evaluate<number>(distCompiled, { r: 10, theta: 1.234 })).toBeCloseTo(10);
    });
  });

  describe("Math 常量", () => {
    test("使用数学常量", () => {
      const x = variable<number>();

      // 使用 Math.PI
      const circumference = expr({ x })("2 * Math.PI * x"); // 周长 = 2πr
      const circCompiled = compile(circumference, { x });
      expect(evaluate<number>(circCompiled, { x: 1 })).toBeCloseTo(2 * Math.PI);

      // 使用 Math.E
      const expGrowth = expr({ x })("Math.E ** x"); // e^x
      const expCompiled = compile(expGrowth, { x });
      expect(evaluate<number>(expCompiled, { x: 2 })).toBeCloseTo(Math.E ** 2);

      // 使用 Math.SQRT2
      const diagonal = expr({ x })("x * Math.SQRT2"); // 正方形对角线
      const diagCompiled = compile(diagonal, { x });
      expect(evaluate<number>(diagCompiled, { x: 1 })).toBeCloseTo(Math.SQRT2);
    });
  });
});
