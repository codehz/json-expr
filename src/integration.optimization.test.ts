import { expect, test } from "bun:test";
import { z } from "zod";
import { compile, evaluate, expr, variable } from "./index";

test("集成测试：内联优化（默认开启）", () => {
  const x = variable(z.number());
  const y = variable(z.number());

  const sum = expr({ x, y })("x + y");
  const product = expr({ x, y })("x * y");
  const result = expr({ sum, product })("sum + product");

  // 默认编译（内联优化）
  const optimized = compile(result, { x, y });
  // 内联优化后只剩一个表达式（sum 和 product 都只被引用一次）
  expect(optimized.length).toBe(2); // [变量名, 内联后的表达式]

  // 不内联编译
  const unoptimized = compile(result, { x, y }, { inline: false });
  expect(unoptimized.length).toBe(4); // [变量名, expr1, expr2, expr3]

  // 执行结果一致
  const value1 = evaluate<number>(optimized, { x: 2, y: 3 });
  const value2 = evaluate<number>(unoptimized, { x: 2, y: 3 });
  expect(value1).toBe(11);
  expect(value2).toBe(11);
});

test("集成测试：内联优化对比", () => {
  const p = variable(z.number());
  const q = variable(z.number());
  const r = variable(z.number());

  const expr1 = expr({ p, q })("p + q");
  const expr2 = expr({ q, r })("q * r");
  const expr3 = expr({ expr1, expr2 })("expr1 + expr2");

  // 不内联编译
  const unoptimized = compile(expr3, { p, q, r }, { inline: false });

  // 默认编译（内联优化）
  const optimized = compile(expr3, { p, q, r });

  // 验证内联优化后的表达式数量减少
  expect(optimized.length).toBeLessThan(unoptimized.length);

  // 执行并验证结果正确
  const result = evaluate<number>(optimized, { p: 2, q: 3, r: 4 });
  // (2+3) + (3*4) = 5 + 12 = 17
  expect(result).toBe(17);
});

test("集成测试：内联与非内联结果一致性", () => {
  const x = variable(z.number());
  const y = variable(z.number());
  const zVar = variable(z.number());

  const e1 = expr({ x, y })("x * y");
  const e2 = expr({ y, zVar })("y + zVar");
  const e3 = expr({ e1, e2 })("e1 + e2");

  const optimized = compile(e3, { x, y, zVar }); // 默认内联
  const unoptimized = compile(e3, { x, y, zVar }, { inline: false });

  const testValue = { x: 2, y: 3, zVar: 4 };
  const resultOptimized = evaluate<number>(optimized, testValue);
  const resultUnoptimized = evaluate<number>(unoptimized, testValue);

  // 2*3 + (3+4) = 6 + 7 = 13
  expect(resultOptimized).toBe(13);
  expect(resultUnoptimized).toBe(13);
  expect(resultOptimized).toBe(resultUnoptimized);
});
