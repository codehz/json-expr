import { test, expect } from "bun:test"
import { z } from "zod"
import { variable, expr, compile, evaluate } from "./index"

test("集成测试：完整的表达式流程", () => {
  // 定义变量
  const x = variable(z.number())
  const y = variable(z.number())

  // 构建表达式
  const sum = expr({ x, y })("x + y")
  const product = expr({ x, y })("x * y")
  const result = expr({ sum, product })("sum + product")

  // 编译（默认内联优化）
  const data = compile(result, { x, y })
  expect(data[0]).toEqual(["x", "y"])
  expect(data.length).toBe(2) // 变量名 + 内联后的单个表达式

  // 执行
  const value = evaluate<number>(data, { x: 2, y: 3 })
  expect(value).toBe(11) // 2+3 + 2*3 = 5 + 6 = 11
})

test("集成测试：基础变量和表达式", () => {
  const a = variable(z.number())
  const b = variable(z.number())

  const simple = expr({ a, b })("a + b")
  const compiled = compile(simple, { a, b })

  const result = evaluate<number>(compiled, { a: 10, b: 20 })
  expect(result).toBe(30)
})

test("集成测试：内联优化（默认开启）", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })("x + y")
  const product = expr({ x, y })("x * y")
  const result = expr({ sum, product })("sum + product")

  // 默认编译（内联优化）
  const optimized = compile(result, { x, y })
  // 内联优化后只剩一个表达式（sum 和 product 都只被引用一次）
  expect(optimized.length).toBe(2) // [变量名, 内联后的表达式]

  // 不内联编译
  const unoptimized = compile(result, { x, y }, { inline: false })
  expect(unoptimized.length).toBe(4) // [变量名, expr1, expr2, expr3]

  // 执行结果一致
  const value1 = evaluate<number>(optimized, { x: 2, y: 3 })
  const value2 = evaluate<number>(unoptimized, { x: 2, y: 3 })
  expect(value1).toBe(11)
  expect(value2).toBe(11)
})

test("集成测试：多层嵌套表达式", () => {
  const a = variable(z.number())
  const b = variable(z.number())
  const c = variable(z.number())

  const layer1 = expr({ a, b })("a + b")
  const layer2 = expr({ layer1, c })("layer1 * c")
  const layer3 = expr({ layer2 })("layer2 + 1")

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

  const expr1 = expr({ x, y })("x * y")
  const expr2 = expr({ x, y })("x + y")
  const expr3 = expr({ expr1, expr2 })("expr1 - expr2")

  const compiled = compile(expr3, { x, y })
  const result = evaluate<number>(compiled, { x: 5, y: 3 })
  // 5*3 - (5+3) = 15 - 8 = 7
  expect(result).toBe(7)
})

test("集成测试：内联优化对比", () => {
  const p = variable(z.number())
  const q = variable(z.number())
  const r = variable(z.number())

  const expr1 = expr({ p, q })("p + q")
  const expr2 = expr({ q, r })("q * r")
  const expr3 = expr({ expr1, expr2 })("expr1 + expr2")

  // 不内联编译
  const unoptimized = compile(expr3, { p, q, r }, { inline: false })

  // 默认编译（内联优化）
  const optimized = compile(expr3, { p, q, r })

  // 验证内联优化后的表达式数量减少
  expect(optimized.length).toBeLessThan(unoptimized.length)

  // 执行并验证结果正确
  const result = evaluate<number>(optimized, { p: 2, q: 3, r: 4 })
  // (2+3) + (3*4) = 5 + 12 = 17
  expect(result).toBe(17)
})

test("集成测试：连续算术运算", () => {
  const x = variable(z.number())

  const expr1 = expr({ x })("x + 1")
  const expr2 = expr({ expr1 })("expr1 * 2")
  const expr3 = expr({ expr2 })("expr3 - 3")

  // 此处应该捕获错误：expr3 在上下文中不存在
  expect(() => {
    compile(expr3, { x })
  }).toThrow()
})

test("集成测试：正确的链式计算", () => {
  const x = variable(z.number())

  const expr1 = expr({ x })("x + 1")
  const expr2 = expr({ expr1 })("expr1 * 2")
  const expr3 = expr({ expr2 })("expr2 - 3")

  const compiled = compile(expr3, { x })
  const result = evaluate<number>(compiled, { x: 5 })
  // ((5+1)*2) - 3 = (6*2) - 3 = 12 - 3 = 9
  expect(result).toBe(9)
})

test("集成测试：布尔表达式", () => {
  const age = variable(z.number())

  const isAdult = expr({ age })("age >= 18")
  const compiled = compile(isAdult, { age })

  const result1 = evaluate<boolean>(compiled, { age: 25 })
  expect(result1).toBe(true)

  const result2 = evaluate<boolean>(compiled, { age: 15 })
  expect(result2).toBe(false)
})

test("集成测试：多变量布尔逻辑", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const isGreater = expr({ x, y })("x > y")
  const isEqual = expr({ x, y })("x === y")
  const combined = expr({ isGreater, isEqual })("isGreater || isEqual")

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
  const sum = expr({ a, b })("a + b")
  
  // 链 2: 从链1和 c
  const multiple = expr({ sum, c })("sum * c")
  
  // 链 3: 从链2
  const final = expr({ multiple })("multiple + 10")

  const compiled = compile(final, { a, b, c })
  const result = evaluate<number>(compiled, { a: 1, b: 2, c: 3 })
  // ((1+2)*3) + 10 = (3*3) + 10 = 9 + 10 = 19
  expect(result).toBe(19)
})

test("集成测试：内联与非内联结果一致性", () => {
  const x = variable(z.number())
  const y = variable(z.number())
  const zVar = variable(z.number())

  const e1 = expr({ x, y })("x * y")
  const e2 = expr({ y, zVar })("y + zVar")
  const e3 = expr({ e1, e2 })("e1 + e2")

  const optimized = compile(e3, { x, y, zVar }) // 默认内联
  const unoptimized = compile(e3, { x, y, zVar }, { inline: false })

  const testValue = { x: 2, y: 3, zVar: 4 }
  const resultOptimized = evaluate<number>(optimized, testValue)
  const resultUnoptimized = evaluate<number>(unoptimized, testValue)

  // 2*3 + (3+4) = 6 + 7 = 13
  expect(resultOptimized).toBe(13)
  expect(resultUnoptimized).toBe(13)
  expect(resultOptimized).toBe(resultUnoptimized)
})

test("集成测试：简单字符串表达式", () => {
  const a = variable(z.string())
  const b = variable(z.string())

  const combined = expr({ a, b })("a + b")
  const compiled = compile(combined, { a, b })
  const result = evaluate<string>(compiled, { a: "Hello", b: "World" })
  expect(result).toBe("HelloWorld")
})

test("集成测试：数字类型保持一致", () => {
  const p = variable(z.number())
  const q = variable(z.number())

  const calc = expr({ p, q })("p + q * 2")
  const compiled = compile(calc, { p, q })
  const result = evaluate<number>(compiled, { p: 10, q: 5 })
  expect(result).toBe(20)  // 10 + 5*2 = 10 + 10 = 20
})

test("集成测试：Math 数学函数 - 基本函数", () => {
  const x = variable(z.number())

  // Math.abs - 绝对值
  const absExpr = expr({ x })("Math.abs(x)")
  const absCompiled = compile(absExpr, { x })
  expect(evaluate<number>(absCompiled, { x: -5 })).toBe(5)
  expect(evaluate<number>(absCompiled, { x: 5 })).toBe(5)

  // Math.sqrt - 平方根
  const sqrtExpr = expr({ x })("Math.sqrt(x)")
  const sqrtCompiled = compile(sqrtExpr, { x })
  expect(evaluate<number>(sqrtCompiled, { x: 16 })).toBe(4)
  expect(evaluate<number>(sqrtCompiled, { x: 2 })).toBeCloseTo(Math.SQRT2)

  // Math.cbrt - 立方根
  const cbrtExpr = expr({ x })("Math.cbrt(x)")
  const cbrtCompiled = compile(cbrtExpr, { x })
  expect(evaluate<number>(cbrtCompiled, { x: 27 })).toBe(3)
})

test("集成测试：Math 数学函数 - 三角函数", () => {
  const angle = variable(z.number())

  // Math.sin
  const sinExpr = expr({ angle })("Math.sin(angle)")
  const sinCompiled = compile(sinExpr, { angle })
  expect(evaluate<number>(sinCompiled, { angle: 0 })).toBe(0)
  expect(evaluate<number>(sinCompiled, { angle: Math.PI / 2 })).toBeCloseTo(1)

  // Math.cos
  const cosExpr = expr({ angle })("Math.cos(angle)")
  const cosCompiled = compile(cosExpr, { angle })
  expect(evaluate<number>(cosCompiled, { angle: 0 })).toBe(1)
  expect(evaluate<number>(cosCompiled, { angle: Math.PI })).toBeCloseTo(-1)

  // Math.tan
  const tanExpr = expr({ angle })("Math.tan(angle)")
  const tanCompiled = compile(tanExpr, { angle })
  expect(evaluate<number>(tanCompiled, { angle: 0 })).toBe(0)
  expect(evaluate<number>(tanCompiled, { angle: Math.PI / 4 })).toBeCloseTo(1)
})

test("集成测试：Math 数学函数 - 幂和对数", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  // Math.pow - 幂运算
  const powExpr = expr({ x, y })("Math.pow(x, y)")
  const powCompiled = compile(powExpr, { x, y })
  expect(evaluate<number>(powCompiled, { x: 2, y: 3 })).toBe(8)
  expect(evaluate<number>(powCompiled, { x: 3, y: 2 })).toBe(9)

  // Math.exp - e 的幂
  const expExpr = expr({ x })("Math.exp(x)")
  const expCompiled = compile(expExpr, { x })
  expect(evaluate<number>(expCompiled, { x: 0 })).toBe(1)
  expect(evaluate<number>(expCompiled, { x: 1 })).toBeCloseTo(Math.E)

  // Math.log - 自然对数
  const logExpr = expr({ x })("Math.log(x)")
  const logCompiled = compile(logExpr, { x })
  expect(evaluate<number>(logCompiled, { x: 1 })).toBe(0)
  expect(evaluate<number>(logCompiled, { x: Math.E })).toBeCloseTo(1)

  // Math.log10 - 以 10 为底的对数
  const log10Expr = expr({ x })("Math.log10(x)")
  const log10Compiled = compile(log10Expr, { x })
  expect(evaluate<number>(log10Compiled, { x: 100 })).toBe(2)
  expect(evaluate<number>(log10Compiled, { x: 1000 })).toBe(3)
})

test("集成测试：Math 数学函数 - 取整函数", () => {
  const x = variable(z.number())

  // Math.floor - 向下取整
  const floorExpr = expr({ x })("Math.floor(x)")
  const floorCompiled = compile(floorExpr, { x })
  expect(evaluate<number>(floorCompiled, { x: 4.7 })).toBe(4)
  expect(evaluate<number>(floorCompiled, { x: -4.3 })).toBe(-5)

  // Math.ceil - 向上取整
  const ceilExpr = expr({ x })("Math.ceil(x)")
  const ceilCompiled = compile(ceilExpr, { x })
  expect(evaluate<number>(ceilCompiled, { x: 4.3 })).toBe(5)
  expect(evaluate<number>(ceilCompiled, { x: -4.7 })).toBe(-4)

  // Math.round - 四舍五入
  const roundExpr = expr({ x })("Math.round(x)")
  const roundCompiled = compile(roundExpr, { x })
  expect(evaluate<number>(roundCompiled, { x: 4.5 })).toBe(5)
  expect(evaluate<number>(roundCompiled, { x: 4.4 })).toBe(4)

  // Math.trunc - 截断小数部分
  const truncExpr = expr({ x })("Math.trunc(x)")
  const truncCompiled = compile(truncExpr, { x })
  expect(evaluate<number>(truncCompiled, { x: 4.7 })).toBe(4)
  expect(evaluate<number>(truncCompiled, { x: -4.7 })).toBe(-4)
})

test("集成测试：Math 数学函数 - 最值函数", () => {
  const x = variable(z.number())
  const y = variable(z.number())
  const zVar = variable(z.number())

  // Math.min
  const minExpr = expr({ x, y })("Math.min(x, y)")
  const minCompiled = compile(minExpr, { x, y })
  expect(evaluate<number>(minCompiled, { x: 3, y: 7 })).toBe(3)
  expect(evaluate<number>(minCompiled, { x: -2, y: 5 })).toBe(-2)

  // Math.max
  const maxExpr = expr({ x, y })("Math.max(x, y)")
  const maxCompiled = compile(maxExpr, { x, y })
  expect(evaluate<number>(maxCompiled, { x: 3, y: 7 })).toBe(7)
  expect(evaluate<number>(maxCompiled, { x: -2, y: 5 })).toBe(5)

  // Math.min/max with multiple arguments
  const min3Expr = expr({ x, y, zVar })("Math.min(x, y, zVar)")
  const min3Compiled = compile(min3Expr, { x, y, zVar })
  expect(evaluate<number>(min3Compiled, { x: 5, y: 2, zVar: 8 })).toBe(2)

  const max3Expr = expr({ x, y, zVar })("Math.max(x, y, zVar)")
  const max3Compiled = compile(max3Expr, { x, y, zVar })
  expect(evaluate<number>(max3Compiled, { x: 5, y: 2, zVar: 8 })).toBe(8)
})

test("集成测试：Math 数学函数 - 组合使用", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  // 计算两点距离: sqrt(x^2 + y^2)
  const distance = expr({ x, y })("Math.sqrt(x * x + y * y)")
  const distCompiled = compile(distance, { x, y })
  expect(evaluate<number>(distCompiled, { x: 3, y: 4 })).toBe(5)  // 3-4-5 三角形

  // 使用 Math.hypot 简化
  const hypotExpr = expr({ x, y })("Math.hypot(x, y)")
  const hypotCompiled = compile(hypotExpr, { x, y })
  expect(evaluate<number>(hypotCompiled, { x: 3, y: 4 })).toBe(5)

  // 复合表达式: abs(sin(x)) + log(1 + y)
  const complexMath = expr({ x, y })("Math.abs(Math.sin(x)) + Math.log(1 + y)")
  const complexCompiled = compile(complexMath, { x, y })
  const result = evaluate<number>(complexCompiled, { x: Math.PI, y: Math.E - 1 })
  // sin(PI) ≈ 0, log(E) = 1
  expect(result).toBeCloseTo(1)
})

test("集成测试：Math 数学函数 - 嵌套表达式中使用", () => {
  const r = variable(z.number())
  const theta = variable(z.number())

  // 极坐标转笛卡尔坐标
  const xCoord = expr({ r, theta })("r * Math.cos(theta)")
  const yCoord = expr({ r, theta })("r * Math.sin(theta)")

  // 验证: r=1, theta=0 -> (1, 0)
  const xCompiled = compile(xCoord, { r, theta })
  const yCompiled = compile(yCoord, { r, theta })

  expect(evaluate<number>(xCompiled, { r: 1, theta: 0 })).toBeCloseTo(1)
  expect(evaluate<number>(yCompiled, { r: 1, theta: 0 })).toBeCloseTo(0)

  // 验证: r=1, theta=PI/2 -> (0, 1)
  expect(evaluate<number>(xCompiled, { r: 1, theta: Math.PI / 2 })).toBeCloseTo(0)
  expect(evaluate<number>(yCompiled, { r: 1, theta: Math.PI / 2 })).toBeCloseTo(1)

  // 组合 x 和 y 计算回原距离
  const distFromOrigin = expr({ xCoord, yCoord })("Math.sqrt(xCoord * xCoord + yCoord * yCoord)")
  const distCompiled = compile(distFromOrigin, { r, theta })

  // 任意角度，距离应等于 r
  expect(evaluate<number>(distCompiled, { r: 5, theta: Math.PI / 3 })).toBeCloseTo(5)
  expect(evaluate<number>(distCompiled, { r: 10, theta: 1.234 })).toBeCloseTo(10)
})

test("集成测试：Math 常量", () => {
  const x = variable(z.number())

  // 使用 Math.PI
  const circumference = expr({ x })("2 * Math.PI * x")  // 周长 = 2πr
  const circCompiled = compile(circumference, { x })
  expect(evaluate<number>(circCompiled, { x: 1 })).toBeCloseTo(2 * Math.PI)

  // 使用 Math.E
  const expGrowth = expr({ x })("Math.E ** x")  // e^x
  const expCompiled = compile(expGrowth, { x })
  expect(evaluate<number>(expCompiled, { x: 2 })).toBeCloseTo(Math.E ** 2)

  // 使用 Math.SQRT2
  const diagonal = expr({ x })("x * Math.SQRT2")  // 正方形对角线
  const diagCompiled = compile(diagonal, { x })
  expect(evaluate<number>(diagCompiled, { x: 1 })).toBeCloseTo(Math.SQRT2)
})
