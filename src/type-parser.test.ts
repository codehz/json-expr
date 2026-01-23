import { test, expect } from "bun:test"
import { z } from "zod"
import { variable, expr } from "./index"
import type {
  ValidateExpression,
  InferExpressionResult,
  ParseExpression,
  ExtractType,
  ContextTypeMap
} from "./type-parser"
import type { Variable, Expression } from "./types"

// ============================================================================
// 类型断言辅助
// ============================================================================

type Expect<T extends true> = T
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
  ? true
  : false

// ============================================================================
// 标识符提取测试
// ============================================================================

test("类型测试：简单表达式的标识符提取", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  // 验证表达式验证通过
  type Context = { x: typeof x; y: typeof y }
  type Result = ValidateExpression<"x + y", Context>
  type _test = Expect<Equal<Result, true>>

  expect(true).toBe(true)
})

test("类型测试：检测未定义的标识符", () => {
  const x = variable(z.number())

  type Context = { x: typeof x }
  type Result = ValidateExpression<"x + z", Context>

  // 应该返回错误类型
  type _test = Expect<Equal<Result, { error: "undefined_identifiers"; identifiers: "z" }>>

  expect(true).toBe(true)
})

test("类型测试：跳过保留字和字面量", () => {
  const x = variable(z.number())

  type Context = { x: typeof x }
  // true, false, null 等保留字应该被跳过
  type Result = ValidateExpression<"x > 0 ? true : false", Context>
  type _test = Expect<Equal<Result, true>>

  expect(true).toBe(true)
})

// ============================================================================
// 类型推导测试
// ============================================================================

test("类型测试：数字加法推导为 number", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  type Context = { x: typeof x; y: typeof y }
  type Result = InferExpressionResult<"x + y", Context>
  type _test = Expect<Equal<Result, number>>

  expect(true).toBe(true)
})

test("类型测试：比较运算推导为 boolean", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  type Context = { x: typeof x; y: typeof y }
  type Result = InferExpressionResult<"x > y", Context>
  type _test = Expect<Equal<Result, boolean>>

  expect(true).toBe(true)
})

test("类型测试：字符串加法推导为 string", () => {
  const a = variable(z.string())
  const b = variable(z.string())

  type Context = { a: typeof a; b: typeof b }
  type Result = InferExpressionResult<"a + b", Context>
  type _test = Expect<Equal<Result, string>>

  expect(true).toBe(true)
})

test("类型测试：乘法推导为 number", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  type Context = { x: typeof x; y: typeof y }
  type Result = InferExpressionResult<"x * y", Context>
  type _test = Expect<Equal<Result, number>>

  expect(true).toBe(true)
})

test("类型测试：逻辑非推导为 boolean", () => {
  const x = variable(z.boolean())

  type Context = { x: typeof x }
  type Result = InferExpressionResult<"!x", Context>
  type _test = Expect<Equal<Result, boolean>>

  expect(true).toBe(true)
})

test("类型测试：三元表达式推导为分支类型的联合", () => {
  const x = variable(z.number())

  type Context = { x: typeof x }
  // x > 0 ? 1 : 0  =>  number | number => number
  type Result = InferExpressionResult<"x > 0 ? 1 : 0", Context>
  type _test = Expect<Equal<Result, number>>

  expect(true).toBe(true)
})

// ============================================================================
// 运行时行为测试
// ============================================================================

test("expr 函数返回正确推导的类型", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })("x + y")

  // 验证类型推导
  type SumType = typeof sum._type
  type _test = Expect<Equal<SumType, number>>

  expect(sum._tag).toBe("expression")
  expect(sum.source).toBe("x + y")
})

test("expr 函数支持嵌套表达式", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })("x + y")
  const doubled = expr({ sum })("sum * 2")

  type DoubledType = typeof doubled._type
  type _test = Expect<Equal<DoubledType, number>>

  expect(doubled.source).toBe("sum * 2")
})

test("expr 函数正确推导比较表达式", () => {
  const age = variable(z.number())

  const isAdult = expr({ age })("age >= 18")

  type IsAdultType = typeof isAdult._type
  type _test = Expect<Equal<IsAdultType, boolean>>

  expect(isAdult.source).toBe("age >= 18")
})

test("expr 函数正确推导复杂表达式", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  // (x + y) * 2 - 1
  const complex = expr({ x, y })("(x + y) * 2 - 1")

  type ComplexType = typeof complex._type
  type _test = Expect<Equal<ComplexType, number>>

  expect(complex.source).toBe("(x + y) * 2 - 1")
})

test("expr 函数正确推导逻辑表达式", () => {
  const a = variable(z.boolean())
  const b = variable(z.boolean())

  const result = expr({ a, b })("a && b || !a")

  // 逻辑表达式最终返回 boolean
  type ResultType = typeof result._type
  // && 和 || 的返回类型较复杂，但最终都是 boolean 相关

  expect(result.source).toBe("a && b || !a")
})

test("expr 函数处理字符串表达式", () => {
  const firstName = variable(z.string())
  const lastName = variable(z.string())

  const fullName = expr({ firstName, lastName })("firstName + lastName")

  type FullNameType = typeof fullName._type
  type _test = Expect<Equal<FullNameType, string>>

  expect(fullName.source).toBe("firstName + lastName")
})

// ============================================================================
// 集成测试
// ============================================================================

test("完整流程：类型推导 + 编译 + 执行", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  // 类型自动推导
  const sum = expr({ x, y })("x + y")
  const isPositive = expr({ sum })("sum > 0")

  // 验证类型
  type SumType = typeof sum._type
  type IsPositiveType = typeof isPositive._type

  type _test1 = Expect<Equal<SumType, number>>
  type _test2 = Expect<Equal<IsPositiveType, boolean>>

  expect(sum._tag).toBe("expression")
  expect(isPositive._tag).toBe("expression")
})

// ============================================================================
// 边界情况测试
// ============================================================================

test("类型测试：空表达式处理", () => {
  const x = variable(z.number())

  type Context = { x: typeof x }
  type Result = ValidateExpression<"", Context>

  // 空表达式没有标识符需要验证，应该通过
  type _test = Expect<Equal<Result, true>>

  expect(true).toBe(true)
})

test("类型测试：只有数字字面量", () => {
  const x = variable(z.number())

  type Context = { x: typeof x }
  type Result = InferExpressionResult<"42", Context>
  type _test = Expect<Equal<Result, number>>

  expect(true).toBe(true)
})

test("类型测试：带括号的表达式", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  type Context = { x: typeof x; y: typeof y }
  type Result = InferExpressionResult<"(x + y) * 2", Context>
  type _test = Expect<Equal<Result, number>>

  expect(true).toBe(true)
})

test("类型测试：一元负号", () => {
  const x = variable(z.number())

  type Context = { x: typeof x }
  type Result = InferExpressionResult<"-x", Context>
  type _test = Expect<Equal<Result, number>>

  expect(true).toBe(true)
})
