import { test, expect } from "bun:test"
import { z } from "zod"
import { variable } from "./variable"
import { expr } from "./expr"
import { compile } from "./compile"

test("compile: simple variable expression", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })<number>("x + y")
  const result = compile(sum, { x, y })

  // 预期结果：[["x", "y"], "$0 + $1"]（保留源码中的空格）
  expect(result).toHaveLength(2)
  expect(result[0]).toEqual(["x", "y"])
  expect(result[1]).toBe("$0 + $1")
})

test("compile: nested expressions", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })<number>("x + y")
  const product = expr({ x, y })<number>("x * y")
  const result = expr({ sum, product })<number>("sum + product")

  const compiled = compile(result, { x, y })

  // 预期：[["x", "y"], "$0 + $1", "$0 * $1", "$2 + $3"]
  expect(compiled).toHaveLength(4)
  expect(compiled[0]).toEqual(["x", "y"])
  expect(compiled[1]).toBe("$0 + $1")
  expect(compiled[2]).toBe("$0 * $1")
  expect(compiled[3]).toBe("$2 + $3")
})

test("compile: expression with single variable", () => {
  const x = variable(z.number())

  const double = expr({ x })<number>("x * 2")
  const result = compile(double, { x })

  expect(result).toHaveLength(2)
  expect(result[0]).toEqual(["x"])
  expect(result[1]).toBe("$0 * 2")
})

test("compile: complex placeholder replacement", () => {
  const x = variable(z.number())
  const xy = variable(z.number())

  // xy 是较长的名称，应该在 x 之前替换以避免部分替换
  const expr1 = expr({ xy, x })<number>("xy + x")
  const result = compile(expr1, { xy, x })

  expect(result).toHaveLength(2)
  expect(result[0]).toEqual(["xy", "x"])
  // xy 应该被替换为 $0，x 应该被替换为 $1
  expect(result[1]).toBe("$0 + $1")
})

test("compile: detects undefined variable reference", () => {
  const x = variable(z.number())
  const y = variable(z.number())

  const sum = expr({ x, y })<number>("x + y + z")

  expect(() => {
    compile(sum, { x, y })
  }).toThrow()
})

test("compile: variable order matches declaration", () => {
  const a = variable(z.number())
  const b = variable(z.number())
  const c = variable(z.number())

  const expr1 = expr({ a, b, c })<number>("a + b + c")
  const result = compile(expr1, { a, b, c })

  expect(result[0]).toEqual(["a", "b", "c"])
})
