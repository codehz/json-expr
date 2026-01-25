import { describe, expect, test } from "bun:test";
import { compile, evaluate, expr, lambda, variable } from "./index";

describe("lambda 函数", () => {
  describe("基础功能", () => {
    test("单参数 lambda + expr", () => {
      const numbers = variable<number[]>();
      const doubled = numbers.map(lambda<[number], number>((n) => expr({ n })("n * 2")));

      const compiled = compile(doubled, { numbers });
      expect(compiled[0]).toEqual(["numbers"]);
      // 表达式包含箭头函数
      expect(compiled[1]).toContain("=>");

      const result = evaluate(compiled, { numbers: [1, 2, 3] });
      expect(result).toEqual([2, 4, 6]);
    });

    test("多参数 lambda + expr", () => {
      const numbers = variable<number[]>();
      const sum = numbers.reduce(
        lambda<[number, number], number>((acc, val) => expr({ acc, val })("acc + val")),
        0
      );

      const compiled = compile(sum, { numbers });
      expect(compiled[0]).toEqual(["numbers"]);

      const result = evaluate(compiled, { numbers: [1, 2, 3, 4, 5] });
      expect(result).toBe(15);
    });

    test("lambda 访问属性", () => {
      const items = variable<{ value: number }[]>();
      const values = items.map(lambda<[{ value: number }], number>((item) => item.value));

      const compiled = compile(values, { items });
      const result = evaluate(compiled, { items: [{ value: 1 }, { value: 2 }, { value: 3 }] });
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe("闭包捕获", () => {
    test("lambda 捕获外部变量", () => {
      const numbers = variable<number[]>();
      const multiplier = variable<number>();

      const scaled = numbers.map(lambda<[number], number>((n) => expr({ n, multiplier })("n * multiplier")));

      const compiled = compile(scaled, { numbers, multiplier });
      expect(compiled[0]).toContain("numbers");
      expect(compiled[0]).toContain("multiplier");

      const result = evaluate(compiled, { numbers: [1, 2, 3], multiplier: 10 });
      expect(result).toEqual([10, 20, 30]);
    });

    test("lambda 同时捕获多个外部变量", () => {
      const numbers = variable<number[]>();
      const offset = variable<number>();
      const scale = variable<number>();

      const transformed = numbers.map(
        lambda<[number], number>((n) => expr({ n, offset, scale })("(n + offset) * scale"))
      );

      const compiled = compile(transformed, { numbers, offset, scale });

      const result = evaluate(compiled, { numbers: [1, 2, 3], offset: 5, scale: 2 });
      expect(result).toEqual([12, 14, 16]); // (1+5)*2=12, (2+5)*2=14, (3+5)*2=16
    });
  });

  describe("数组方法", () => {
    test("filter", () => {
      const numbers = variable<number[]>();
      const threshold = variable<number>();

      const filtered = numbers.filter(lambda<[number], boolean>((n) => expr({ n, threshold })("n > threshold")));

      const compiled = compile(filtered, { numbers, threshold });
      const result = evaluate(compiled, { numbers: [1, 5, 3, 8, 2, 7], threshold: 4 });
      expect(result).toEqual([5, 8, 7]);
    });

    test("find", () => {
      const items = variable<{ id: number; name: string }[]>();
      const targetId = variable<number>();

      const found = items.find(
        lambda<[{ id: number; name: string }], boolean>((item) => expr({ item, targetId })("item.id === targetId"))
      );

      const compiled = compile(found, { items, targetId });
      const result = evaluate(compiled, {
        items: [
          { id: 1, name: "a" },
          { id: 2, name: "b" },
          { id: 3, name: "c" },
        ],
        targetId: 2,
      });
      expect(result).toEqual({ id: 2, name: "b" });
    });

    test("some", () => {
      const numbers = variable<number[]>();
      const hasPositive = numbers.some(lambda<[number], boolean>((n) => expr({ n })("n > 0")));

      const compiled = compile(hasPositive, { numbers });
      expect(evaluate<boolean>(compiled, { numbers: [-1, -2, 3] })).toBe(true);
      expect(evaluate<boolean>(compiled, { numbers: [-1, -2, -3] })).toBe(false);
    });

    test("every", () => {
      const numbers = variable<number[]>();
      const allPositive = numbers.every(lambda<[number], boolean>((n) => expr({ n })("n > 0")));

      const compiled = compile(allPositive, { numbers });
      expect(evaluate<boolean>(compiled, { numbers: [1, 2, 3] })).toBe(true);
      expect(evaluate<boolean>(compiled, { numbers: [1, -2, 3] })).toBe(false);
    });

    test("sort", () => {
      const numbers = variable<number[]>();

      const sorted = numbers.toSorted(lambda<[number, number], number>((a, b) => expr({ a, b })("a - b")));

      const compiled = compile(sorted, { numbers });
      const result = evaluate(compiled, { numbers: [3, 1, 4, 1, 5, 9, 2, 6] });
      expect(result).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    });
  });

  describe("复杂场景", () => {
    test("带索引参数的 map", () => {
      const items = variable<string[]>();
      // 使用非 shorthand 语法以保持明确的属性名
      const indexed = items.map(
        lambda<[string, number], { item: string; index: number }>((item, index) => ({ item, index }))
      );

      const compiled = compile(indexed, { items });
      const result = evaluate(compiled, { items: ["a", "b", "c"] });
      expect(result).toEqual([
        { item: "a", index: 0 },
        { item: "b", index: 1 },
        { item: "c", index: 2 },
      ]);
    });

    test("reduce 计算加权平均", () => {
      const values = variable<{ value: number; weight: number }[]>();

      // 求加权和
      const weightedSum = values.reduce(
        lambda<[number, { value: number; weight: number }], number>((acc, item) =>
          expr({ acc, item })("acc + item.value * item.weight")
        ),
        0
      );

      // 求权重和
      const totalWeight = values.reduce(
        lambda<[number, { value: number; weight: number }], number>((acc, item) =>
          expr({ acc, item })("acc + item.weight")
        ),
        0
      );

      // 计算平均
      const average = expr({ weightedSum, totalWeight })("weightedSum / totalWeight");

      const compiled = compile(average, { values });
      const result = evaluate(compiled, {
        values: [
          { value: 10, weight: 1 },
          { value: 20, weight: 2 },
          { value: 30, weight: 3 },
        ],
      });
      // (10*1 + 20*2 + 30*3) / (1+2+3) = 140/6 ≈ 23.33
      expect(result).toBeCloseTo(23.333333, 4);
    });

    test("链式方法调用", () => {
      const numbers = variable<number[]>();
      const threshold = variable<number>();

      const result = numbers
        .filter(lambda<[number], boolean>((n) => expr({ n, threshold })("n > threshold")))
        .map(lambda<[number], number>((n) => expr({ n })("n * 2")));

      const compiled = compile(result, { numbers, threshold });
      const evaluated = evaluate(compiled, { numbers: [1, 5, 3, 8, 2, 7], threshold: 4 });
      expect(evaluated).toEqual([10, 16, 14]); // [5, 8, 7] * 2
    });
  });

  describe("返回普通值", () => {
    test("返回包含 Proxy 变量的对象字面量", () => {
      const items = variable<string[]>();
      const indexed = items.map(
        lambda<[string, number], { item: string; index: number }>((item, index) => ({ item, index }))
      );

      const compiled = compile(indexed, { items });
      const result = evaluate(compiled, { items: ["a", "b", "c"] });
      expect(result).toEqual([
        { item: "a", index: 0 },
        { item: "b", index: 1 },
        { item: "c", index: 2 },
      ]);
    });

    test("返回原始值常量", () => {
      const numbers = variable<number[]>();
      const mapped = numbers.map(lambda<[number], number>(() => 42));

      const compiled = compile(mapped, { numbers });
      const result = evaluate(compiled, { numbers: [1, 2, 3] });
      expect(result).toEqual([42, 42, 42]);
    });

    test("返回字符串常量", () => {
      const items = variable<string[]>();
      const mapped = items.map(lambda<[string], string>(() => "constant"));

      const compiled = compile(mapped, { items });
      const result = evaluate(compiled, { items: ["a", "b"] });
      expect(result).toEqual(["constant", "constant"]);
    });

    test("返回包含混合值的数组", () => {
      const numbers = variable<number[]>();
      const pairs = numbers.map(lambda<[number], [number, string]>((n) => [n, "item"]));

      const compiled = compile(pairs, { numbers });
      const result = evaluate(compiled, { numbers: [1, 2, 3] });
      expect(result).toEqual([
        [1, "item"],
        [2, "item"],
        [3, "item"],
      ]);
    });

    test("返回包含外部变量的对象", () => {
      const items = variable<string[]>();
      const prefix = variable<string>();
      const tagged = items.map(
        lambda<[string], { value: string; tag: string }>((item) => ({ value: item, tag: prefix }))
      );

      const compiled = compile(tagged, { items, prefix });
      const result = evaluate(compiled, { items: ["a", "b"], prefix: "test" });
      expect(result).toEqual([
        { value: "a", tag: "test" },
        { value: "b", tag: "test" },
      ]);
    });

    test("返回嵌套对象", () => {
      const numbers = variable<number[]>();
      const nested = numbers.map(lambda<[number], { outer: { inner: number } }>((n) => ({ outer: { inner: n } })));

      const compiled = compile(nested, { numbers });
      const result = evaluate(compiled, { numbers: [1, 2, 3] });
      expect(result).toEqual([{ outer: { inner: 1 } }, { outer: { inner: 2 } }, { outer: { inner: 3 } }]);
    });
  });
});

describe("嵌套 lambda", () => {
  describe("基础嵌套", () => {
    test("嵌套 map", () => {
      const matrix = variable<number[][]>();
      const doubled = matrix.map(
        lambda<[number[]], number[]>((row) => row.map(lambda<[number], number>((n) => expr({ n })("n * 2"))))
      );

      const compiled = compile(doubled, { matrix });
      const result = evaluate(compiled, {
        matrix: [
          [1, 2],
          [3, 4],
        ],
      });
      expect(result).toEqual([
        [2, 4],
        [6, 8],
      ]);
    });

    test("外层 map 内层 filter", () => {
      const matrix = variable<number[][]>();
      const filtered = matrix.map(
        lambda<[number[]], number[]>((row) => row.filter(lambda<[number], boolean>((n) => expr({ n })("n > 2"))))
      );

      const compiled = compile(filtered, { matrix });
      const result = evaluate(compiled, {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });
      expect(result).toEqual([[3], [4, 5, 6]]);
    });

    test("外层 map 内层 reduce", () => {
      const matrix = variable<number[][]>();
      const sums = matrix.map(
        lambda<[number[]], number>((row) =>
          row.reduce(
            lambda<[number, number], number>((acc, val) => expr({ acc, val })("acc + val")),
            0
          )
        )
      );

      const compiled = compile(sums, { matrix });
      const result = evaluate(compiled, {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });
      expect(result).toEqual([6, 15]);
    });
  });

  describe("嵌套 lambda 捕获外部变量", () => {
    test("内层 lambda 捕获全局变量", () => {
      const matrix = variable<number[][]>();
      const multiplier = variable<number>();
      const scaled = matrix.map(
        lambda<[number[]], number[]>((row) =>
          row.map(lambda<[number], number>((n) => expr({ n, multiplier })("n * multiplier")))
        )
      );

      const compiled = compile(scaled, { matrix, multiplier });
      expect(compiled[0]).toContain("matrix");
      expect(compiled[0]).toContain("multiplier");

      const result = evaluate(compiled, {
        matrix: [
          [1, 2],
          [3, 4],
        ],
        multiplier: 10,
      });
      expect(result).toEqual([
        [10, 20],
        [30, 40],
      ]);
    });

    test("内层 lambda 捕获外层 lambda 参数", () => {
      const matrix = variable<number[][]>();
      const indexed = matrix.map(
        lambda<[number[], number], number[]>((row, rowIndex) =>
          row.map(lambda<[number], number>((n) => expr({ n, rowIndex })("n + rowIndex * 10")))
        )
      );

      const compiled = compile(indexed, { matrix });
      const result = evaluate(compiled, {
        matrix: [
          [1, 2],
          [3, 4],
        ],
      });
      expect(result).toEqual([
        [1, 2], // rowIndex=0: 1+0, 2+0
        [13, 14], // rowIndex=1: 3+10, 4+10
      ]);
    });

    test("内层 lambda 同时捕获外层参数和全局变量", () => {
      const matrix = variable<number[][]>();
      const baseOffset = variable<number>();
      const indexed = matrix.map(
        lambda<[number[], number], number[]>((row, rowIndex) =>
          row.map(lambda<[number], number>((n) => expr({ n, rowIndex, baseOffset })("n + rowIndex * 10 + baseOffset")))
        )
      );

      const compiled = compile(indexed, { matrix, baseOffset });
      expect(compiled[0]).toContain("matrix");
      expect(compiled[0]).toContain("baseOffset");

      const result = evaluate(compiled, {
        matrix: [
          [1, 2],
          [3, 4],
        ],
        baseOffset: 100,
      });
      expect(result).toEqual([
        [101, 102], // rowIndex=0: 1+0+100, 2+0+100
        [113, 114], // rowIndex=1: 3+10+100, 4+10+100
      ]);
    });

    test("多层嵌套捕获", () => {
      const cube = variable<number[][][]>();
      const multiplier = variable<number>();
      const processed = cube.map(
        lambda<[number[][]], number[][]>((plane) =>
          plane.map(
            lambda<[number[]], number[]>((row) =>
              row.map(lambda<[number], number>((n) => expr({ n, multiplier })("n * multiplier")))
            )
          )
        )
      );

      const compiled = compile(processed, { cube, multiplier });
      const result = evaluate(compiled, {
        cube: [
          [
            [1, 2],
            [3, 4],
          ],
        ],
        multiplier: 2,
      });
      expect(result).toEqual([
        [
          [2, 4],
          [6, 8],
        ],
      ]);
    });

    test("外层 lambda 使用不同数量参数避免冲突", () => {
      // 内层 lambda 使用单参数，外层使用双参数，通过不同参数数量避免命名冲突
      const matrix = variable<number[][]>();
      const processed = matrix.map(
        lambda<[number[], number], number[]>((row, rowIdx) =>
          row.map(lambda<[number], number>((val) => expr({ val, rowIdx })("val + rowIdx * 100")))
        )
      );

      const compiled = compile(processed, { matrix });
      const result = evaluate(compiled, {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });
      // row 0: 1+0=1, 2+0=2, 3+0=3
      // row 1: 4+100=104, 5+100=105, 6+100=106
      expect(result).toEqual([
        [1, 2, 3],
        [104, 105, 106],
      ]);
    });

    test("内层 lambda 捕获外层参数进行 reduce", () => {
      const groups = variable<{ name: string; values: number[] }[]>();
      const totals = groups.map(
        lambda<[{ name: string; values: number[] }], { name: string; total: number }>((group) => ({
          name: group.name,
          total: group.values.reduce(
            lambda<[number, number], number>((acc, val) => expr({ acc, val })("acc + val")),
            0
          ),
        }))
      );

      const compiled = compile(totals, { groups });
      const result = evaluate(compiled, {
        groups: [
          { name: "A", values: [1, 2, 3] },
          { name: "B", values: [4, 5, 6] },
        ],
      });
      expect(result).toEqual([
        { name: "A", total: 6 },
        { name: "B", total: 15 },
      ]);
    });
  });

  describe("复杂嵌套场景", () => {
    test("嵌套 lambda 链式调用", () => {
      const matrix = variable<number[][]>();
      const threshold = variable<number>();
      const processed = matrix.map(
        lambda<[number[]], number[]>((row) =>
          row
            .filter(lambda<[number], boolean>((n) => expr({ n, threshold })("n > threshold")))
            .map(lambda<[number], number>((n) => expr({ n })("n * 2")))
        )
      );

      const compiled = compile(processed, { matrix, threshold });
      const result = evaluate(compiled, {
        matrix: [
          [1, 5, 3],
          [8, 2, 7],
        ],
        threshold: 3,
      });
      expect(result).toEqual([
        [10], // [5] * 2
        [16, 14], // [8, 7] * 2
      ]);
    });

    test("flatMap 模拟", () => {
      const groups = variable<number[][]>();
      const offset = variable<number>();
      const flattened = groups.reduce(
        lambda<[number[], number[]], number[]>((acc, group) =>
          acc.concat(group.map(lambda<[number], number>((n) => expr({ n, offset })("n + offset"))))
        ),
        [] as number[]
      );

      const compiled = compile(flattened, { groups, offset });
      const result = evaluate(compiled, {
        groups: [
          [1, 2],
          [3, 4],
        ],
        offset: 10,
      });
      expect(result).toEqual([11, 12, 13, 14]);
    });

    test("嵌套 some/every", () => {
      const matrix = variable<number[][]>();
      const threshold = variable<number>();

      // 检查是否所有行都有至少一个大于阈值的元素
      const allRowsHaveLarge = matrix.every(
        lambda<[number[]], boolean>((row) =>
          row.some(lambda<[number], boolean>((n) => expr({ n, threshold })("n > threshold")))
        )
      );

      const compiled = compile(allRowsHaveLarge, { matrix, threshold });
      expect(
        evaluate<boolean>(compiled, {
          matrix: [
            [1, 5, 2],
            [3, 8, 1],
          ],
          threshold: 4,
        })
      ).toBe(true);
      expect(
        evaluate<boolean>(compiled, {
          matrix: [
            [1, 2, 3],
            [4, 5, 6],
          ],
          threshold: 10,
        })
      ).toBe(false);
    });

    test("嵌套 find", () => {
      const data = variable<{ id: number; children: { name: string; active: boolean }[] }[]>();
      const firstActiveChild = data.map(
        lambda<
          [{ id: number; children: { name: string; active: boolean }[] }],
          { name: string; active: boolean } | undefined
        >((parent) =>
          parent.children.find(lambda<[{ name: string; active: boolean }], boolean>((child) => child.active))
        )
      );

      const compiled = compile(firstActiveChild, { data });
      const result = evaluate(compiled, {
        data: [
          {
            id: 1,
            children: [
              { name: "a", active: false },
              { name: "b", active: true },
            ],
          },
          {
            id: 2,
            children: [
              { name: "c", active: true },
              { name: "d", active: false },
            ],
          },
        ],
      });
      expect(result).toEqual([
        { name: "b", active: true },
        { name: "c", active: true },
      ]);
    });
  });

  describe("已知限制", () => {
    test("相同参数数量的嵌套 lambda 会发生参数名冲突", () => {
      // 当内外层 lambda 参数数量相同时，参数名会冲突（都是 _0, _1 等）
      // 这是当前实现的已知限制
      const matrix = variable<number[][]>();
      const processed = matrix.map(
        lambda<[number[], number], number[]>((row, rowIdx) =>
          row.map(
            lambda<[number, number], number>((val, colIdx) =>
              // rowIdx 在编译后会变成内层的 _1 (即 colIdx)，导致结果不符预期
              expr({ val, rowIdx, colIdx })("val + rowIdx * 100 + colIdx")
            )
          )
        )
      );

      const compiled = compile(processed, { matrix });
      // 编译结果: $0.map((_0,_1)=>_0.map((_0,_1)=>_0+_1*100+_1))
      // 内层的 _1 覆盖了外层的 _1，所以 rowIdx 实际上是 colIdx
      expect(compiled[1]).toContain("(_0,_1)=>_0.map((_0,_1)=>");

      const result = evaluate(compiled, {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });
      // 实际计算: val + colIdx * 100 + colIdx = val + colIdx * 101
      // 而非预期的: val + rowIdx * 100 + colIdx
      expect(result).toEqual([
        [1, 103, 205], // 1+0*101, 2+1*101, 3+2*101
        [4, 106, 208], // 4+0*101, 5+1*101, 6+2*101
      ]);
    });

    test("workaround: 使用不同参数数量避免冲突", () => {
      // 解决方案：确保内外层 lambda 使用不同数量的参数
      const matrix = variable<number[][]>();
      const processed = matrix.map(
        lambda<[number[], number], number[]>((row, rowIdx) =>
          // 内层只用一个参数，外层用两个参数，避免 _1 冲突
          row.map(lambda<[number], number>((val) => expr({ val, rowIdx })("val + rowIdx * 100")))
        )
      );

      const compiled = compile(processed, { matrix });
      // 编译结果: $0.map((_0,_1)=>_0.map(_0=>_0+_1*100))
      // 内层只有 _0，外层的 _1 不会被覆盖
      expect(compiled[1]).toContain("(_0,_1)=>_0.map(_0=>");

      const result = evaluate(compiled, {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });
      expect(result).toEqual([
        [1, 2, 3],
        [104, 105, 106],
      ]);
    });
  });
});

describe("parser 箭头函数支持", () => {
  test("解析单参数箭头函数", () => {
    const numbers = variable<number[]>();
    // 直接使用生成的箭头函数源码
    const result = numbers.map(lambda<[number], number>((n) => expr({ n })("n * 2")));

    const compiled = compile(result, { numbers });
    const exprStr = compiled[1] as string;
    expect(exprStr).toMatch(/_0=>/);
  });

  test("解析多参数箭头函数", () => {
    const numbers = variable<number[]>();
    const result = numbers.reduce(
      lambda<[number, number], number>((acc, val) => expr({ acc, val })("acc + val")),
      0
    );

    const compiled = compile(result, { numbers });
    const exprStr = compiled[1] as string;
    expect(exprStr).toMatch(/\(_0,_1\)=>/);
  });
});
