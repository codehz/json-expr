import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "./index";
import { compileAndEvaluate } from "./test-helper";

describe("集成测试：Math 数学函数", () => {
  describe("基本函数", () => {
    test("绝对值、平方根、立方根", () => {
      const x = variable<number>();

      // Math.abs - 绝对值
      const absExpr = expr({ x })("Math.abs(x)");
      expect(compileAndEvaluate<number>(absExpr, { x }, { x: -5 })).toBe(5);
      expect(compileAndEvaluate<number>(absExpr, { x }, { x: 5 })).toBe(5);

      // Math.sqrt - 平方根
      const sqrtExpr = expr({ x })("Math.sqrt(x)");
      expect(compileAndEvaluate<number>(sqrtExpr, { x }, { x: 16 })).toBe(4);
      expect(compileAndEvaluate<number>(sqrtExpr, { x }, { x: 2 })).toBeCloseTo(Math.SQRT2);

      // Math.cbrt - 立方根
      const cbrtExpr = expr({ x })("Math.cbrt(x)");
      expect(compileAndEvaluate<number>(cbrtExpr, { x }, { x: 27 })).toBe(3);
    });
  });

  describe("三角函数", () => {
    test("正弦、余弦、正切", () => {
      const angle = variable<number>();

      // Math.sin
      const sinExpr = expr({ angle })("Math.sin(angle)");
      expect(compileAndEvaluate<number>(sinExpr, { angle }, { angle: 0 })).toBe(0);
      expect(compileAndEvaluate<number>(sinExpr, { angle }, { angle: Math.PI / 2 })).toBeCloseTo(1);

      // Math.cos
      const cosExpr = expr({ angle })("Math.cos(angle)");
      expect(compileAndEvaluate<number>(cosExpr, { angle }, { angle: 0 })).toBe(1);
      expect(compileAndEvaluate<number>(cosExpr, { angle }, { angle: Math.PI })).toBeCloseTo(-1);

      // Math.tan
      const tanExpr = expr({ angle })("Math.tan(angle)");
      expect(compileAndEvaluate<number>(tanExpr, { angle }, { angle: 0 })).toBe(0);
      expect(compileAndEvaluate<number>(tanExpr, { angle }, { angle: Math.PI / 4 })).toBeCloseTo(1);
    });
  });

  describe("幂和对数", () => {
    test("幂运算、指数、对数", () => {
      const x = variable<number>();
      const y = variable<number>();

      // Math.pow - 幂运算
      const powExpr = expr({ x, y })("Math.pow(x, y)");
      expect(compileAndEvaluate<number>(powExpr, { x, y }, { x: 2, y: 3 })).toBe(8);
      expect(compileAndEvaluate<number>(powExpr, { x, y }, { x: 3, y: 2 })).toBe(9);

      // Math.exp - e 的幂
      const expExpr = expr({ x })("Math.exp(x)");
      expect(compileAndEvaluate<number>(expExpr, { x }, { x: 0 })).toBe(1);
      expect(compileAndEvaluate<number>(expExpr, { x }, { x: 1 })).toBeCloseTo(Math.E);

      // Math.log - 自然对数
      const logExpr = expr({ x })("Math.log(x)");
      expect(compileAndEvaluate<number>(logExpr, { x }, { x: 1 })).toBe(0);
      expect(compileAndEvaluate<number>(logExpr, { x }, { x: Math.E })).toBeCloseTo(1);

      // Math.log10 - 以 10 为底的对数
      const log10Expr = expr({ x })("Math.log10(x)");
      expect(compileAndEvaluate<number>(log10Expr, { x }, { x: 100 })).toBe(2);
      expect(compileAndEvaluate<number>(log10Expr, { x }, { x: 1000 })).toBe(3);
    });
  });

  describe("取整函数", () => {
    test("向下取整、向上取整、四舍五入、截断", () => {
      const x = variable<number>();

      // Math.floor - 向下取整
      const floorExpr = expr({ x })("Math.floor(x)");
      expect(compileAndEvaluate<number>(floorExpr, { x }, { x: 4.7 })).toBe(4);
      expect(compileAndEvaluate<number>(floorExpr, { x }, { x: -4.3 })).toBe(-5);

      // Math.ceil - 向上取整
      const ceilExpr = expr({ x })("Math.ceil(x)");
      expect(compileAndEvaluate<number>(ceilExpr, { x }, { x: 4.3 })).toBe(5);
      expect(compileAndEvaluate<number>(ceilExpr, { x }, { x: -4.7 })).toBe(-4);

      // Math.round - 四舍五入
      const roundExpr = expr({ x })("Math.round(x)");
      expect(compileAndEvaluate<number>(roundExpr, { x }, { x: 4.5 })).toBe(5);
      expect(compileAndEvaluate<number>(roundExpr, { x }, { x: 4.4 })).toBe(4);

      // Math.trunc - 截断小数部分
      const truncExpr = expr({ x })("Math.trunc(x)");
      expect(compileAndEvaluate<number>(truncExpr, { x }, { x: 4.7 })).toBe(4);
      expect(compileAndEvaluate<number>(truncExpr, { x }, { x: -4.7 })).toBe(-4);
    });
  });

  describe("最值函数", () => {
    test("最小值、最大值", () => {
      const x = variable<number>();
      const y = variable<number>();
      const zVar = variable<number>();

      // Math.min
      const minExpr = expr({ x, y })("Math.min(x, y)");
      expect(compileAndEvaluate<number>(minExpr, { x, y }, { x: 3, y: 7 })).toBe(3);
      expect(compileAndEvaluate<number>(minExpr, { x, y }, { x: -2, y: 5 })).toBe(-2);

      // Math.max
      const maxExpr = expr({ x, y })("Math.max(x, y)");
      expect(compileAndEvaluate<number>(maxExpr, { x, y }, { x: 3, y: 7 })).toBe(7);
      expect(compileAndEvaluate<number>(maxExpr, { x, y }, { x: -2, y: 5 })).toBe(5);

      // Math.min/max with multiple arguments
      const min3Expr = expr({ x, y, zVar })("Math.min(x, y, zVar)");
      expect(compileAndEvaluate<number>(min3Expr, { x, y, zVar }, { x: 5, y: 2, zVar: 8 })).toBe(2);

      const max3Expr = expr({ x, y, zVar })("Math.max(x, y, zVar)");
      expect(compileAndEvaluate<number>(max3Expr, { x, y, zVar }, { x: 5, y: 2, zVar: 8 })).toBe(8);
    });
  });

  describe("组合使用", () => {
    test("复合表达式计算", () => {
      const x = variable<number>();
      const y = variable<number>();

      // 计算两点距离: sqrt(x^2 + y^2)
      const distance = expr({ x, y })("Math.sqrt(x * x + y * y)");
      expect(compileAndEvaluate<number>(distance, { x, y }, { x: 3, y: 4 })).toBe(5); // 3-4-5 三角形

      // 使用 Math.hypot 简化
      const hypotExpr = expr({ x, y })("Math.hypot(x, y)");
      expect(compileAndEvaluate<number>(hypotExpr, { x, y }, { x: 3, y: 4 })).toBe(5);

      // 复合表达式: abs(sin(x)) + log(1 + y)
      const complexMath = expr({ x, y })("Math.abs(Math.sin(x)) + Math.log(1 + y)");
      const result = compileAndEvaluate<number>(complexMath, { x, y }, { x: Math.PI, y: Math.E - 1 });
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
      expect(compileAndEvaluate<number>(circumference, { x }, { x: 1 })).toBeCloseTo(2 * Math.PI);

      // 使用 Math.E
      const expGrowth = expr({ x })("Math.E ** x"); // e^x
      expect(compileAndEvaluate<number>(expGrowth, { x }, { x: 2 })).toBeCloseTo(Math.E ** 2);

      // 使用 Math.SQRT2
      const diagonal = expr({ x })("x * Math.SQRT2"); // 正方体对角线
      expect(compileAndEvaluate<number>(diagonal, { x }, { x: 1 })).toBeCloseTo(Math.SQRT2);
    });
  });
});
