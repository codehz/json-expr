import { expect, test } from "bun:test";
import { z } from "zod";
import { compile, evaluate, expr, variable } from "./index";

test("集成测试：完整的表达式流程", () => {
  // 定义变量
  const x = variable(z.number());
  const y = variable(z.number());

  // 构建表达式
  const sum = expr({ x, y })("x + y");
  const product = expr({ x, y })("x * y");
  const result = expr({ sum, product })("sum + product");

  // 编译（默认内联优化）
  const data = compile(result, { x, y });
  expect(data[0]).toEqual(["x", "y"]);
  expect(data.length).toBe(2); // 变量名 + 内联后的单个表达式

  // 执行
  const value = evaluate<number>(data, { x: 2, y: 3 });
  expect(value).toBe(11); // 2+3 + 2*3 = 5 + 6 = 11
});

test("集成测试：基础变量和表达式", () => {
  const a = variable(z.number());
  const b = variable(z.number());

  const simple = expr({ a, b })("a + b");
  const compiled = compile(simple, { a, b });

  const result = evaluate<number>(compiled, { a: 10, b: 20 });
  expect(result).toBe(30);
});

test("集成测试：多层嵌套表达式", () => {
  const a = variable(z.number());
  const b = variable(z.number());
  const c = variable(z.number());

  const layer1 = expr({ a, b })("a + b");
  const layer2 = expr({ layer1, c })("layer1 * c");
  const layer3 = expr({ layer2 })("layer2 + 1");

  const compiled = compile(layer3, { a, b, c });

  // 验证编译结果的结构
  expect(compiled[0]).toEqual(["a", "b", "c"]);

  // 执行
  const result = evaluate<number>(compiled, { a: 2, b: 3, c: 4 });
  // (2+3) * 4 + 1 = 5 * 4 + 1 = 20 + 1 = 21
  expect(result).toBe(21);
});

test("集成测试：连续算术运算", () => {
  const x = variable(z.number());

  const expr1 = expr({ x })("x + 1");
  const expr2 = expr({ expr1 })("expr1 * 2");
  const expr3 = expr({ expr2 })("expr3 - 3");

  // 此处应该捕获错误：expr3 在上下文中不存在
  expect(() => {
    compile(expr3, { x });
  }).toThrow();
});

test("集成测试：正确的链式计算", () => {
  const x = variable(z.number());

  const expr1 = expr({ x })("x + 1");
  const expr2 = expr({ expr1 })("expr1 * 2");
  const expr3 = expr({ expr2 })("expr2 - 3");

  const compiled = compile(expr3, { x });
  const result = evaluate<number>(compiled, { x: 5 });
  // ((5+1)*2) - 3 = (6*2) - 3 = 12 - 3 = 9
  expect(result).toBe(9);
});

test("集成测试：简单字符串表达式", () => {
  const a = variable(z.string());
  const b = variable(z.string());

  const combined = expr({ a, b })("a + b");
  const compiled = compile(combined, { a, b });
  const result = evaluate<string>(compiled, { a: "Hello", b: "World" });
  expect(result).toBe("HelloWorld");
});

test("集成测试：数字类型保持一致", () => {
  const p = variable(z.number());
  const q = variable(z.number());

  const calc = expr({ p, q })("p + q * 2");
  const compiled = compile(calc, { p, q });
  const result = evaluate<number>(compiled, { p: 10, q: 5 });
  expect(result).toBe(20); // 10 + 5*2 = 10 + 10 = 20
});
