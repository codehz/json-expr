import { describe, expect, test } from "bun:test";
import { expr, variable } from "../../index";
import { compileAndEvaluate } from "../unit/test-helper";

describe("对象/数组直接编译集成测试", () => {
  test("编译并求值包含 Proxy 的对象", () => {
    const x = variable<number>();
    const y = variable<number>();
    const sum = expr({ x, y })("x + y");

    const output = compileAndEvaluate({ result: sum, original: { x, y } }, { x, y }, { x: 10, y: 20 });

    expect(output).toEqual({
      result: 30,
      original: { x: 10, y: 20 },
    });
  });

  test("编译并求值包含 Proxy 的数组", () => {
    const x = variable<number>();
    const x2 = expr({ x })("x * 2");
    const output = compileAndEvaluate<number[]>([x, x2, 100], { x }, { x: 5 });

    expect(output).toEqual([5, 10, 100]);
  });
});
