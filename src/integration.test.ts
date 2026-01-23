import { test, expect } from "bun:test"
import { z } from "zod"
import { variable, expr, compile, optimize, evaluate } from "./index"

test("集成测试：完整的表达式流程 (DESIGN07 示例)", () => {
  // 定义变量
  const x = variable(z.number())
  const y = variable(z.number())

  // 构建表达式
  const sum = expr({ x, y })<number>("x + y")
  const product = expr({ x, y })<number>("x * y")
  const result = expr({ sum, product })<number>("sum + product")

  // 编译
  const data = compile(result, { x, y })
  expect(data[0]).toEqual(["x", "y"])
  expect(data.length).toBe(4) // 变量名 + 3个表达式

  // 执行（未优化）
  const value = evaluate<number>(data, { x: 2, y: 3 })
  expect(value).toBe(11) // 2+3 + 2*3 = 5 + 6 = 11
})

test("集成测试：基础变量和表达式", () => {
  const a = variable(z.number())
  const b = variable(z.number())

  const simple = expr({ a, b })<number>("a + b")
  const compiled = compile(simple, { a, b })

  const result = evaluate<number>(compiled, { a: 10, b: 20 })
  expect(result).toBe(30)
})

test("集成测试：优化流程", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })<number>("x + y")
  const product = expr({ x, y })<number>("x * y")
  const result = expr({ sum, product })<number>("sum + product")

  // 编译
  const data = compile(result, { x, y })
  expect(data.length).toBe(4) // [变量名, expr1, expr2, expr3]

  // 优化
  const optimized = optimize(data)
  // 优化后应该减少表达式数量（内联仅被引用一次的子表达式）
  expect(optimized.length).toBeLessThanOrEqual(data.length)

  // 执行优化后的版本
  const value = evaluate<number>(optimized, { x: 2, y: 3 })
  expect(value).toBe(11)
})

test("集成测试：多层嵌套表达式", () => {
  const a = variable(z.number())
  const b = variable(z.number())
  const c = variable(z.number())

  const layer1 = expr({ a, b })<number>("a + b")
  const layer2 = expr({ layer1, c })<number>("layer1 * c")
  const layer3 = expr({ layer2 })<number>("layer2 + 1")

  const compiled = compile(layer3, { a, b, c })

  // 验证编译结果的结构
  expect(compiled[0]).toEqual(["a", "b", "c"])

  // 执行
  const result = evaluate<number>(compiled, { a: 2, b: 3, c: 4 })
  // (2+3) * 4 + 1 = 5 * 4 + 1 = 20 + 1 = 21
  expect(result).toBe(21)
})

test("集成测试：复杂的数学运算", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const expr1 = expr({ x, y })<number>("x * y")
  const expr2 = expr({ x, y })<number>("x + y")
  const expr3 = expr({ expr1, expr2 })<number>("expr1 - expr2")

  const compiled = compile(expr3, { x, y })
  const result = evaluate<number>(compiled, { x: 5, y: 3 })
  // 5*3 - (5+3) = 15 - 8 = 7
  expect(result).toBe(7)
})

test("集成测试：带有中间优化的执行流程", () => {
  const p = variable(z.number())
  const q = variable(z.number())
  const r = variable(z.number())

  const expr1 = expr({ p, q })<number>("p + q")
  const expr2 = expr({ q, r })<number>("q * r")
  const expr3 = expr({ expr1, expr2 })<number>("expr1 + expr2")

  // 编译
  const compiled = compile(expr3, { p, q, r })
  
  // 记录编译前的表达式数量
  const beforeOptimize = compiled.length

  // 优化
  const optimized = optimize(compiled)
  
  // 验证优化后的表达式数量不会增加
  expect(optimized.length).toBeLessThanOrEqual(beforeOptimize)

  // 执行并验证结果正确
  const result = evaluate<number>(optimized, { p: 2, q: 3, r: 4 })
  // (2+3) + (3*4) = 5 + 12 = 17
  expect(result).toBe(17)
})

test("集成测试：连续算术运算", () => {
  const x = variable(z.number())

  const expr1 = expr({ x })<number>("x + 1")
  const expr2 = expr({ expr1 })<number>("expr1 * 2")
  const expr3 = expr({ expr2 })<number>("expr3 - 3")

  // 此处应该捕获错误：expr3 在上下文中不存在
  expect(() => {
    compile(expr3, { x })
  }).toThrow()
})

test("集成测试：正确的链式计算", () => {
  const x = variable(z.number())

  const expr1 = expr({ x })<number>("x + 1")
  const expr2 = expr({ expr1 })<number>("expr1 * 2")
  const expr3 = expr({ expr2 })<number>("expr2 - 3")

  const compiled = compile(expr3, { x })
  const result = evaluate<number>(compiled, { x: 5 })
  // ((5+1)*2) - 3 = (6*2) - 3 = 12 - 3 = 9
  expect(result).toBe(9)
})

test("集成测试：布尔表达式", () => {
  const age = variable(z.number())

  const isAdult = expr({ age })<boolean>("age >= 18")
  const compiled = compile(isAdult, { age })

  const result1 = evaluate<boolean>(compiled, { age: 25 })
  expect(result1).toBe(true)

  const result2 = evaluate<boolean>(compiled, { age: 15 })
  expect(result2).toBe(false)
})

test("集成测试：多变量布尔逻辑", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const isGreater = expr({ x, y })<boolean>("x > y")
  const isEqual = expr({ x, y })<boolean>("x === y")
  const combined = expr({ isGreater, isEqual })<boolean>("isGreater || isEqual")

  const compiled = compile(combined, { x, y })

  const result1 = evaluate<boolean>(compiled, { x: 10, y: 5 })
  expect(result1).toBe(true) // 10 > 5

  const result2 = evaluate<boolean>(compiled, { x: 5, y: 5 })
  expect(result2).toBe(true) // 5 === 5

  const result3 = evaluate<boolean>(compiled, { x: 3, y: 7 })
  expect(result3).toBe(false) // !(3 > 7) && !(3 === 7)
})

test("集成测试：多个独立表达式链", () => {
  const a = variable(z.number())
  const b = variable(z.number())
  const c = variable(z.number())

  // 链 1: a 和 b
  const sum = expr({ a, b })<number>("a + b")
  
  // 链 2: 从链1和 c
  const multiple = expr({ sum, c })<number>("sum * c")
  
  // 链 3: 从链2
  const final = expr({ multiple })<number>("multiple + 10")

  const compiled = compile(final, { a, b, c })
  const result = evaluate<number>(compiled, { a: 1, b: 2, c: 3 })
  // ((1+2)*3) + 10 = (3*3) + 10 = 9 + 10 = 19
  expect(result).toBe(19)
})

test("集成测试：优化后的结果一致性", () => {
  const x = variable(z.number())
  const y = variable(z.number())
  const zVar = variable(z.number())

  const e1 = expr({ x, y })<number>("x * y")
  const e2 = expr({ y, zVar })<number>("y + zVar")
  const e3 = expr({ e1, e2 })<number>("e1 + e2")

  const compiled = compile(e3, { x, y, zVar })
  const optimized = optimize(compiled)

  const testValue = { x: 2, y: 3, zVar: 4 }
  const resultCompiled = evaluate<number>(compiled, testValue)
  const resultOptimized = evaluate<number>(optimized, testValue)

  // 2*3 + (3+4) = 6 + 7 = 13
  expect(resultCompiled).toBe(13)
  expect(resultOptimized).toBe(13)
  expect(resultCompiled).toBe(resultOptimized)
})

test("集成测试：简单字符串表达式", () => {
  const a = variable(z.string())
  const b = variable(z.string())

  const combined = expr({ a, b })<string>("a + b")
  const compiled = compile(combined, { a, b })
  const result = evaluate<string>(compiled, { a: "Hello", b: "World" })
  expect(result).toBe("HelloWorld")
})

test("集成测试：数字类型保持一致", () => {
  const p = variable(z.number())
  const q = variable(z.number())

  const calc = expr({ p, q })<number>("p + q * 2")
  const compiled = compile(calc, { p, q })
  const result = evaluate<number>(compiled, { p: 10, q: 5 })
  expect(result).toBe(20)  // 10 + 5*2 = 10 + 10 = 20
})
