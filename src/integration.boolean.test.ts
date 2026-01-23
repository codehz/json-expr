import { expect, test } from "bun:test";
import { z } from "zod";
import { compile, evaluate, expr, variable } from "./index";

test("集成测试：布尔表达式", () => {
  const age = variable(z.number());

  const isAdult = expr({ age })("age >= 18");
  const compiled = compile(isAdult, { age });

  const result1 = evaluate<boolean>(compiled, { age: 25 });
  expect(result1).toBe(true);

  const result2 = evaluate<boolean>(compiled, { age: 15 });
  expect(result2).toBe(false);
});

test("集成测试：多变量布尔逻辑", () => {
  const x = variable(z.number());
  const y = variable(z.number());

  const isGreater = expr({ x, y })("x > y");
  const isEqual = expr({ x, y })("x === y");
  const combined = expr({ isGreater, isEqual })("isGreater || isEqual");

  const compiled = compile(combined, { x, y });

  const result1 = evaluate<boolean>(compiled, { x: 10, y: 5 });
  expect(result1).toBe(true); // 10 > 5

  const result2 = evaluate<boolean>(compiled, { x: 5, y: 5 });
  expect(result2).toBe(true); // 5 === 5

  const result3 = evaluate<boolean>(compiled, { x: 3, y: 7 });
  expect(result3).toBe(false); // !(3 > 7) && !(3 === 7)
});
