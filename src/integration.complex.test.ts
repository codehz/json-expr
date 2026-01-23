import { expect, test } from "bun:test";
import { z } from "zod";
import { compile, evaluate, expr, variable } from "./index";

test("集成测试：复杂的数学运算", () => {
  const x = variable(z.number());
  const y = variable(z.number());

  const expr1 = expr({ x, y })("x * y");
  const expr2 = expr({ x, y })("x + y");
  const expr3 = expr({ expr1, expr2 })("expr1 - expr2");

  const compiled = compile(expr3, { x, y });
  const result = evaluate<number>(compiled, { x: 5, y: 3 });
  // 5*3 - (5+3) = 15 - 8 = 7
  expect(result).toBe(7);
});

test("集成测试：多个独立表达式链", () => {
  const a = variable(z.number());
  const b = variable(z.number());
  const c = variable(z.number());

  // 链 1: a 和 b
  const sum = expr({ a, b })("a + b");

  // 链 2: 从链1和 c
  const multiple = expr({ sum, c })("sum * c");

  // 链 3: 从链2
  const final = expr({ multiple })("multiple + 10");

  const compiled = compile(final, { a, b, c });
  const result = evaluate<number>(compiled, { a: 1, b: 2, c: 3 });
  // ((1+2)*3) + 10 = (3*3) + 10 = 9 + 10 = 19
  expect(result).toBe(19);
});

test("集成测试：对象属性与函数组合", () => {
  // 测试表达式 double(obj.value)，组合对象属性和函数调用
  const double = variable(z.function({ input: [z.number()], output: z.number() }));
  const obj = variable(
    z.object({
      value: z.number(),
    })
  );

  const combinedExpr = expr({ double, obj })("double(obj.value)");
  const combinedCompiled = compile(combinedExpr, { double, obj });

  const result = evaluate<number>(combinedCompiled, {
    double: (n: number) => n * 2,
    obj: { value: 15 },
  });
  expect(result).toBe(30);
});

test("集成测试：嵌套的方法调用与运算", () => {
  // 测试表达式 obj.user.age * 2 或类似的组合
  const obj = variable(
    z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
    })
  );

  const ageCalcExpr = expr({ obj })("obj.user.age * 2");
  const ageCalcCompiled = compile(ageCalcExpr, { obj });

  const result = evaluate<number>(ageCalcCompiled, {
    obj: { user: { name: "Charlie", age: 25 } },
  });
  expect(result).toBe(50);

  // 更复杂的计算
  const complexExpr = expr({ obj })("obj.user.age * 2 + 10");
  const complexCompiled = compile(complexExpr, { obj });

  const complexResult = evaluate<number>(complexCompiled, {
    obj: { user: { name: "Diana", age: 30 } },
  });
  expect(complexResult).toBe(70); // 30 * 2 + 10 = 70
});

test("集成测试：在复杂表达式中使用多个导入", () => {
  // 使用多个对象和函数的组合表达式
  const multiply = variable(z.function({ input: [z.number(), z.number()], output: z.number() }));
  const add = variable(z.function({ input: [z.number(), z.number()], output: z.number() }));

  const data = variable(
    z.object({
      x: z.number(),
      y: z.number(),
    })
  );

  // 复合表达式：multiply(data.x, data.y) + add(data.x, data.y)
  const complexExpr = expr({ multiply, add, data })("multiply(data.x, data.y) + add(data.x, data.y)");
  const complexCompiled = compile(complexExpr, { multiply, add, data });

  const result = evaluate<number>(complexCompiled, {
    multiply: (a: number, b: number) => a * b,
    add: (a: number, b: number) => a + b,
    data: { x: 3, y: 4 },
  });
  expect(result).toBe(19); // (3*4) + (3+4) = 12 + 7 = 19

  // 另一个组合：multiply(add(data.x, data.y), data.x)
  const nestedExpr = expr({ multiply, add, data })("multiply(add(data.x, data.y), data.x)");
  const nestedCompiled = compile(nestedExpr, { multiply, add, data });

  const nestedResult = evaluate<number>(nestedCompiled, {
    multiply: (a: number, b: number) => a * b,
    add: (a: number, b: number) => a + b,
    data: { x: 5, y: 2 },
  });
  expect(nestedResult).toBe(35); // (5+2) * 5 = 7 * 5 = 35
});
