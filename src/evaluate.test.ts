import { test, expect } from "bun:test"
import { z } from "zod"
import { variable } from "./variable"
import { expr } from "./expr"
import { compile } from "./compile"
import { evaluate } from "./evaluate"

test("evaluate: simple arithmetic expression", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })<number>("x + y")
  const compiled = compile(sum, { x, y })

  const result = evaluate<number>(compiled, { x: 2, y: 3 })
  expect(result).toBe(5)
})

test("evaluate: nested expressions", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })<number>("x + y")
  const product = expr({ x, y })<number>("x * y")
  const result_expr = expr({ sum, product })<number>("sum + product")

  const compiled = compile(result_expr, { x, y })
  // [["x", "y"], "$0+$1", "$0*$1", "$2+$3"]

  const result = evaluate<number>(compiled, { x: 2, y: 3 })
  // 2 + 3 = 5, 2 * 3 = 6, 5 + 6 = 11
  expect(result).toBe(11)
})

test("evaluate: complex expression with multiple operations", () => {
  const x = variable(z.number())

  const double = expr({ x })<number>("x * 2")
  const add_one = expr({ double })<number>("double + 1")
  const square = expr({ add_one })<number>("add_one * add_one")

  const compiled = compile(square, { x })
  // [["x"], "x*2", "double+1", "add_one*add_one"]

  const result = evaluate<number>(compiled, { x: 3 })
  // 3 * 2 = 6, 6 + 1 = 7, 7 * 7 = 49
  expect(result).toBe(49)
})

test("evaluate: expression with string concatenation", () => {
  const x = variable(z.string())
  const y = variable(z.string())

  const expr_xy = expr({ x, y })<string>("x + y")
  const compiled = compile(expr_xy, { x, y })

  const result = evaluate<string>(compiled, { x: "Hello", y: " World" })
  expect(result).toBe("Hello World")
})

test("evaluate: missing required variable throws error", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })<number>("x + y")
  const compiled = compile(sum, { x, y })

  expect(() => {
    evaluate<number>(compiled, { x: 2 })
  }).toThrow("Missing required variable: y")
})

test("evaluate: caches evaluator functions", () => {
  const x = variable(z.number())
  const sum = expr({ x })<number>("x + 1")
  const compiled = compile(sum, { x })

  // First call constructs the function
  const result1 = evaluate<number>(compiled, { x: 5 })
  expect(result1).toBe(6)

  // Second call should use cached function
  const result2 = evaluate<number>(compiled, { x: 10 })
  expect(result2).toBe(11)
})

test("evaluate: works with complex numeric expressions", () => {
  const a = variable(z.number())
  const b = variable(z.number())
  const c = variable(z.number())

  const expr_abc = expr({ a, b, c })<number>("a * b + c / 2")
  const compiled = compile(expr_abc, { a, b, c })

  const result = evaluate<number>(compiled, { a: 2, b: 3, c: 10 })
  // 2 * 3 + 10 / 2 = 6 + 5 = 11
  expect(result).toBe(11)
})

test("evaluate: works with boolean expressions", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const comparison = expr({ x, y })<boolean>("x > y")
  const compiled = compile(comparison, { x, y })

  const result1 = evaluate<boolean>(compiled, { x: 5, y: 3 })
  expect(result1).toBe(true)

  const result2 = evaluate<boolean>(compiled, { x: 2, y: 3 })
  expect(result2).toBe(false)
})
