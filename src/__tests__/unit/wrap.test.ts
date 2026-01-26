import { describe, expect, test } from "bun:test";
import { expr, lambda, variable, wrap } from "../../index";
import { compileAndEvaluate } from "./test-helper";

describe("wrap 函数测试", () => {
  test("包装 RegExp 并调用方法", () => {
    const pattern = wrap(/^[a-z]+$/i);
    const input = variable<string>();
    const result = pattern.test(input);

    expect(compileAndEvaluate<boolean>(result, { input }, { input: "hello" })).toBe(true);
    expect(compileAndEvaluate<boolean>(result, { input }, { input: "hello123" })).toBe(false);
  });

  test("包装 RegExp 作为参数使用", () => {
    const pattern = wrap(/^[a-z]+$/i);
    const input = variable<string>();
    const result = input.match(pattern);

    const evalResult = compileAndEvaluate<RegExpMatchArray | null>(result, { input }, { input: "hello" });
    expect(evalResult).toBeInstanceOf(Array);
    expect(evalResult?.[0]).toBe("hello");
  });

  test("包装 Date 并调用方法", () => {
    const date = wrap(new Date("2024-01-15T10:30:00.000Z"));
    const year = date.getFullYear();
    const month = date.getMonth();

    expect(compileAndEvaluate<number>(year, {}, {})).toBe(2024);
    expect(compileAndEvaluate<number>(month, {}, {})).toBe(0); // January = 0
  });

  test("包装数字并进行运算", () => {
    const ten = wrap(10);
    const x = variable<number>();
    const result = expr({ ten, x })("ten + x");

    expect(compileAndEvaluate<number>(result, { x }, { x: 5 })).toBe(15);
  });

  test("包装字符串并调用方法", () => {
    const greeting = wrap("Hello, World!");
    const upper = greeting.toUpperCase();
    const lower = greeting.toLowerCase();

    expect(compileAndEvaluate<string>(upper, {}, {})).toBe("HELLO, WORLD!");
    expect(compileAndEvaluate<string>(lower, {}, {})).toBe("hello, world!");
  });

  test("包装数组并调用方法", () => {
    const numbers = wrap([1, 2, 3, 4, 5]);
    const x = variable<number>();
    const doubled = numbers.map(lambda<[number], number>((n) => expr({ n, x })("n * x")));

    expect(compileAndEvaluate<number[]>(doubled, { x }, { x: 2 })).toEqual([2, 4, 6, 8, 10]);
  });

  test("包装对象并访问属性", () => {
    const config = wrap({ port: 8080, host: "localhost" });
    const port = config.port;
    const host = config.host;

    expect(compileAndEvaluate<number>(port, {}, {})).toBe(8080);
    expect(compileAndEvaluate<string>(host, {}, {})).toBe("localhost");
  });

  test("wrap 与 variable 结合使用", () => {
    const pattern = wrap(/^[a-z]+$/i);
    const text = variable<string>();
    const result = pattern.test(text);

    expect(compileAndEvaluate<boolean>(result, { text }, { text: "hello" })).toBe(true);
    expect(compileAndEvaluate<boolean>(result, { text }, { text: "123" })).toBe(false);
  });

  test("包装 URL 并访问属性", () => {
    const url = wrap(new URL("https://example.com:8080/path?query=value"));
    const host = url.hostname;
    const port = url.port;
    const pathname = url.pathname;

    expect(compileAndEvaluate<string>(host, {}, {})).toBe("example.com");
    expect(compileAndEvaluate<string>(port, {}, {})).toBe("8080");
    expect(compileAndEvaluate<string>(pathname, {}, {})).toBe("/path");
  });

  test("包装 Map 并调用方法", () => {
    const map = wrap(
      new Map([
        ["a", 1],
        ["b", 2],
      ])
    );
    const key = variable<string>();
    const value = map.get(key);

    expect(compileAndEvaluate<number | undefined>(value, { key }, { key: "a" })).toBe(1);
    expect(compileAndEvaluate<number | undefined>(value, { key }, { key: "b" })).toBe(2);
  });

  test("包装 Set 并调用方法", () => {
    const set = wrap(new Set([1, 2, 3, 4, 5]));
    const num = variable<number>();
    const has = set.has(num);

    expect(compileAndEvaluate<boolean>(has, { num }, { num: 3 })).toBe(true);
    expect(compileAndEvaluate<boolean>(has, { num }, { num: 10 })).toBe(false);
  });

  test("链式调用 wrap 的结果", () => {
    const text = wrap("  hello world  ");
    const trimmed = text.trim();
    const upper = trimmed.toUpperCase();
    const replaced = upper.replace("HELLO", "HI");

    expect(compileAndEvaluate<string>(replaced, {}, {})).toBe("HI WORLD");
  });

  test("包装 BigInt 并进行运算", () => {
    const big = wrap(100n);
    const x = variable<bigint>();
    const sum = expr({ big, x })("big + x");

    expect(compileAndEvaluate<bigint>(sum, { x }, { x: 50n })).toBe(150n);
  });

  test("wrap 嵌套对象", () => {
    const data = wrap({
      user: {
        name: "Alice",
        age: 30,
      },
    });
    const name = data.user.name;
    const age = data.user.age;

    expect(compileAndEvaluate<string>(name, {}, {})).toBe("Alice");
    expect(compileAndEvaluate<number>(age, {}, {})).toBe(30);
  });

  test("wrap 与 expr 结合使用", () => {
    const pattern = wrap(/\d+/g);
    const text = variable<string>();
    const matches = text.match(pattern);
    const length = expr({ matches })("matches ? matches.length : 0");

    expect(compileAndEvaluate<number>(length, { text }, { text: "a1b2c3" })).toBe(3);
    expect(compileAndEvaluate<number>(length, { text }, { text: "abc" })).toBe(0);
  });

  test("wrap TypedArray", () => {
    const arr = wrap(new Uint8Array([10, 20, 30]));
    const index = variable<number>();
    const value = expr({ arr, index })("arr[index]");

    expect(compileAndEvaluate<number>(value, { index }, { index: 0 })).toBe(10);
    expect(compileAndEvaluate<number>(value, { index }, { index: 2 })).toBe(30);
  });

  test("wrap 复杂表达式", () => {
    const multiplier = wrap(2);
    const offset = wrap(10);
    const x = variable<number>();

    const result = expr({ x, multiplier, offset })("x * multiplier + offset");

    expect(compileAndEvaluate<number>(result, { x }, { x: 5 })).toBe(20); // 5 * 2 + 10
    expect(compileAndEvaluate<number>(result, { x }, { x: 0 })).toBe(10);
  });
});
