import { describe, expect, test } from "bun:test";
import { expr } from "../../api/expr";
import { lambda } from "../../api/lambda";
import { variable } from "../../api/variable";
import { compileAndEvaluate } from "../unit/test-helper";

describe("集成测试：回调函数", () => {
  test("简单回调", () => {
    const callback = variable<(x: (input: number) => number) => number>();

    const resultExpr = callback(lambda<[number], number>((x) => expr({ x })("x * 2")));

    const result = compileAndEvaluate(
      resultExpr,
      { callback },
      {
        callback: (fn: (input: number) => number) => fn(5),
      }
    );

    expect(result).toBe(10);
  });
});
