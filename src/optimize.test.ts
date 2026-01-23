import { test, expect } from "bun:test"
import { optimize } from "./optimize"
import type { CompiledData } from "./types"

test("optimize: 无表达式时返回原数据", () => {
  const data: CompiledData = [["x"]]
  const result = optimize(data)
  expect(result).toEqual([["x"]])
})

test("optimize: 没有可内联的表达式时返回原数据", () => {
  // 当一个表达式被多次引用时，不应该内联
  const noInlineData: CompiledData = [["x", "y"], "$0+$1", "$2+$2+$2"]
  const noInlineResult = optimize(noInlineData)
  expect(noInlineResult).toEqual(noInlineData)
  
  // 当所有非最后表达式都被多次引用时
  const multiRefData: CompiledData = [["x", "y"], "$0+$1", "$0*$1", "$2+$3+$2+$3"]
  const multiRefResult = optimize(multiRefData)
  expect(multiRefResult).toEqual(multiRefData)
})

test("optimize: 内联仅被引用一次的表达式", () => {
  const data: CompiledData = [["x"], "$0+1", "$0+2", "$1*$2"]
  const result = optimize(data)
  // $1 ($0+1) 仅被引用一次，$2 ($0+2) 仅被引用一次
  // 应该内联为 "($0+1)*($0+2)"
  expect(result[0]).toEqual(["x"])
  expect(result.length).toBe(2) // 只剩一个表达式
  expect(result[1]).toBe("($0+1)*($0+2)")
})

test("optimize: 多层内联", () => {
  const data: CompiledData = [["x"], "$0*2", "$1+1", "$2*3"]
  const result = optimize(data)
  // $1 ($0*2) 仅被引用一次
  // $2 ($1+1) 仅被引用一次
  // 最终应该内联为 "($0*2+1)*3"
  expect(result[0]).toEqual(["x"])
  expect(result.length).toBe(2)
  expect(result[1]).toBe("($0*2+1)*3")
})

test("optimize: 部分可内联", () => {
  const data: CompiledData = [["x", "y"], "$0+$1", "$0*$1", "$2+$3"]
  const result = optimize(data)
  // $0 和 $1 都被引用多次，不内联
  // $2 ($0+$1) 和 $3 ($0*$1) 仅被引用一次，应该内联
  expect(result[0]).toEqual(["x", "y"])
  expect(result.length).toBe(2)
  // $2 需要括号（包含加法），$3 不需要括号（只有乘法）
  expect(result[1]).toBe("($0+$1)+$0*$1")
})

test("optimize: 变量列表保持不变", () => {
  const data: CompiledData = [["x", "y", "z"], "$0+$1", "$2*$2", "$3+$4"]
  const result = optimize(data)
  expect(result[0]).toEqual(["x", "y", "z"])
})

test("optimize: 不添加不必要的括号", () => {
  const data: CompiledData = [["x"], "$0", "$1+1"]
  const result = optimize(data)
  // $0 仅被引用一次，但是一个简单引用不需要括号
  expect(result[0]).toEqual(["x"])
  expect(result[1]).toBe("$0+1")
})

test("optimize: 处理简单的数字内联", () => {
  const data: CompiledData = [["x"], "1", "2", "$1+$2"]
  const result = optimize(data)
  expect(result[0]).toEqual(["x"])
  expect(result[1]).toBe("1+2")
})

test("optimize: 复杂表达式内联保留括号", () => {
  const data: CompiledData = [["x"], "$0+1", "$0+2", "$1*$2"]
  const result = optimize(data)
  // $0+1 和 $0+2 都包含 + 运算符，乘法时需要括号
  expect(result[1]).toBe("($0+1)*($0+2)")
})
