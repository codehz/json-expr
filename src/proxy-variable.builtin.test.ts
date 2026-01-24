import { describe, expect, test } from "bun:test";
import { compile, evaluate, variable } from "./index";
import { generate } from "./parser";
import { serializeArgumentToAST } from "./proxy-variable";

describe("内置类型序列化测试", () => {
  test("序列化 Date", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const ast = serializeArgumentToAST(date);
    const source = generate(ast);
    expect(source).toContain("Date");
    expect(source).toContain(date.getTime().toString());
  });

  test("编译 Date 参数", () => {
    interface Logger {
      log(message: string, date: Date): string;
    }
    const logger = variable<Logger>();
    const date = new Date("2024-01-01T00:00:00.000Z");
    const result = logger.log("Event", date);

    const compiled = compile(result, { logger });
    const evalResult = evaluate(compiled, {
      logger: {
        log: (msg: string, d: Date) => `${msg} at ${d.toISOString()}`,
      },
    });
    expect(evalResult).toBe("Event at 2024-01-01T00:00:00.000Z");
  });

  test("序列化 RegExp", () => {
    const regex = /test/gi;
    const ast = serializeArgumentToAST(regex);
    const source = generate(ast);
    expect(source).toContain("RegExp");
    expect(source).toContain("test");
    expect(source).toContain("gi");
  });

  test("编译 RegExp 参数", () => {
    interface Validator {
      match(text: string, pattern: RegExp): boolean;
    }
    const validator = variable<Validator>();
    const pattern = /^[a-z]+$/i;
    const result = validator.match("hello", pattern);

    const compiled = compile(result, { validator });
    const evalResult = evaluate(compiled, {
      validator: {
        match: (text: string, pattern: RegExp) => pattern.test(text),
      },
    });
    expect(evalResult).toBe(true);
  });

  test("序列化 BigInt", () => {
    const bigInt = 12345678901234567890n;
    const ast = serializeArgumentToAST(bigInt);
    const source = generate(ast);
    expect(source).toContain("BigInt");
    expect(source).toContain("12345678901234567890");
  });

  test("编译 BigInt 参数", () => {
    interface Calculator {
      add(a: bigint, b: bigint): bigint;
    }
    const calc = variable<Calculator>();
    const result = calc.add(100n, 200n);

    const compiled = compile(result, { calc });
    const evalResult = evaluate(compiled, {
      calc: {
        add: (a: bigint, b: bigint) => a + b,
      },
    });
    expect(evalResult).toBe(300n);
  });

  test("序列化 URL", () => {
    const url = new URL("https://example.com/path?query=value");
    const ast = serializeArgumentToAST(url);
    const source = generate(ast);
    expect(source).toContain("URL");
    expect(source).toContain("https://example.com/path?query=value");
  });

  test("编译 URL 参数", () => {
    interface Fetcher {
      fetch(url: URL): string;
    }
    const fetcher = variable<Fetcher>();
    const url = new URL("https://example.com/api");
    const result = fetcher.fetch(url);

    const compiled = compile(result, { fetcher });
    const evalResult = evaluate(compiled, {
      fetcher: {
        fetch: (url: URL) => url.href,
      },
    });
    expect(evalResult).toBe("https://example.com/api");
  });

  test("序列化 URLSearchParams", () => {
    const params = new URLSearchParams([
      ["key1", "value1"],
      ["key2", "value2"],
    ]);
    const ast = serializeArgumentToAST(params);
    const source = generate(ast);
    expect(source).toContain("URLSearchParams");
    expect(source).toContain("key1");
    expect(source).toContain("value1");
  });

  test("编译 URLSearchParams 参数", () => {
    interface HTTP {
      buildQuery(params: URLSearchParams): string;
    }
    const http = variable<HTTP>();
    const params = new URLSearchParams([
      ["foo", "bar"],
      ["baz", "qux"],
    ]);
    const result = http.buildQuery(params);

    const compiled = compile(result, { http });
    const evalResult = evaluate(compiled, {
      http: {
        buildQuery: (params: URLSearchParams) => params.toString(),
      },
    });
    expect(evalResult).toBe("foo=bar&baz=qux");
  });

  test("序列化 Map", () => {
    const map = new Map([
      ["key1", 100],
      ["key2", 200],
    ]);
    const ast = serializeArgumentToAST(map);
    const source = generate(ast);
    expect(source).toContain("Map");
    expect(source).toContain("key1");
    expect(source).toContain("100");
  });

  test("编译 Map 参数", () => {
    interface Storage {
      get(map: Map<string, number>, key: string): number | undefined;
    }
    const storage = variable<Storage>();
    const map = new Map([
      ["x", 10],
      ["y", 20],
    ]);
    const result = storage.get(map, "x");

    const compiled = compile(result, { storage });
    const evalResult = evaluate(compiled, {
      storage: {
        get: (map: Map<string, number>, key: string) => map.get(key),
      },
    });
    expect(evalResult).toBe(10);
  });

  test("序列化 Set", () => {
    const set = new Set([1, 2, 3, 4, 5]);
    const ast = serializeArgumentToAST(set);
    const source = generate(ast);
    expect(source).toContain("Set");
    expect(source).toContain("1");
    expect(source).toContain("5");
  });

  test("编译 Set 参数", () => {
    interface Collection {
      has(set: Set<number>, value: number): boolean;
    }
    const collection = variable<Collection>();
    const set = new Set([10, 20, 30]);
    const result = collection.has(set, 20);

    const compiled = compile(result, { collection });
    const evalResult = evaluate(compiled, {
      collection: {
        has: (set: Set<number>, value: number) => set.has(value),
      },
    });
    expect(evalResult).toBe(true);
  });

  test("序列化 Uint8Array", () => {
    const arr = new Uint8Array([1, 2, 3, 4, 5]);
    const ast = serializeArgumentToAST(arr);
    const source = generate(ast);
    expect(source).toContain("Uint8Array");
    expect(source).toContain("1");
    expect(source).toContain("5");
  });

  test("编译 Uint8Array 参数", () => {
    interface Buffer {
      sum(arr: Uint8Array): number;
    }
    const buffer = variable<Buffer>();
    const arr = new Uint8Array([10, 20, 30]);
    const result = buffer.sum(arr);

    const compiled = compile(result, { buffer });
    const evalResult = evaluate(compiled, {
      buffer: {
        sum: (arr: Uint8Array) => Array.from(arr).reduce((a, b) => a + b, 0),
      },
    });
    expect(evalResult).toBe(60);
  });

  test("序列化 Float32Array", () => {
    const arr = new Float32Array([1.5, 2.5, 3.5]);
    const ast = serializeArgumentToAST(arr);
    const source = generate(ast);
    expect(source).toContain("Float32Array");
    expect(source).toContain("1.5");
    expect(source).toContain("3.5");
  });

  test("序列化 BigInt64Array", () => {
    const arr = new BigInt64Array([100n, 200n, 300n]);
    const ast = serializeArgumentToAST(arr);
    const source = generate(ast);
    expect(source).toContain("BigInt64Array");
    expect(source).toContain("BigInt");
  });

  test("编译 BigInt64Array 参数", () => {
    interface BigIntBuffer {
      first(arr: BigInt64Array): bigint;
    }
    const buffer = variable<BigIntBuffer>();
    const arr = new BigInt64Array([999n, 888n, 777n]);
    const result = buffer.first(arr);

    const compiled = compile(result, { buffer });
    const evalResult = evaluate(compiled, {
      buffer: {
        first: (arr: BigInt64Array) => arr[0],
      },
    });
    expect(evalResult).toBe(999n);
  });

  test("序列化 ArrayBuffer", () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const ast = serializeArgumentToAST(buffer);
    const source = generate(ast);
    expect(source).toContain("Uint8Array");
    expect(source).toContain("buffer");
  });

  test("编译 ArrayBuffer 参数", () => {
    interface BufferUtil {
      byteLength(buffer: ArrayBuffer): number;
    }
    const util = variable<BufferUtil>();
    const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const result = util.byteLength(buffer);

    const compiled = compile(result, { util });
    const evalResult = evaluate(compiled, {
      util: {
        byteLength: (buffer: ArrayBuffer) => buffer.byteLength,
      },
    });
    expect(evalResult).toBe(5);
  });

  test("序列化 DataView", () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const view = new DataView(buffer);
    const ast = serializeArgumentToAST(view);
    const source = generate(ast);
    expect(source).toContain("DataView");
    expect(source).toContain("Uint8Array");
  });

  test("编译 DataView 参数", () => {
    interface DataUtil {
      readUint8(view: DataView, offset: number): number;
    }
    const util = variable<DataUtil>();
    const buffer = new Uint8Array([10, 20, 30, 40]).buffer;
    const view = new DataView(buffer);
    const result = util.readUint8(view, 2);

    const compiled = compile(result, { util });
    const evalResult = evaluate(compiled, {
      util: {
        readUint8: (view: DataView, offset: number) => view.getUint8(offset),
      },
    });
    expect(evalResult).toBe(30);
  });

  test("混合使用多种内置类型", () => {
    interface MultiType {
      process(date: Date, regex: RegExp, bigint: bigint, map: Map<string, number>, set: Set<number>): string;
    }
    const handler = variable<MultiType>();
    const result = handler.process(new Date("2024-01-01"), /test/i, 123n, new Map([["a", 1]]), new Set([1, 2, 3]));

    const compiled = compile(result, { handler });
    const evalResult = evaluate(compiled, {
      handler: {
        process: (date: Date, regex: RegExp, bigint: bigint, map: Map<string, number>, set: Set<number>) =>
          `${date.getFullYear()}-${regex.source}-${bigint}-${map.size}-${set.size}`,
      },
    });
    expect(evalResult).toBe("2024-test-123-1-3");
  });

  test("嵌套内置类型（Map of Arrays）", () => {
    interface NestedHandler {
      process(data: Map<string, number[]>): number;
    }
    const handler = variable<NestedHandler>();
    const data = new Map([
      ["a", [1, 2, 3]],
      ["b", [4, 5, 6]],
    ]);
    const result = handler.process(data);

    const compiled = compile(result, { handler });
    const evalResult = evaluate(compiled, {
      handler: {
        process: (data: Map<string, number[]>) => {
          let sum = 0;
          data.forEach((arr) => {
            sum += arr.reduce((a, b) => a + b, 0);
          });
          return sum;
        },
      },
    });
    expect(evalResult).toBe(21);
  });

  test("嵌套内置类型（Set of Maps）", () => {
    interface SetMapHandler {
      count(data: Set<Map<string, number>>): number;
    }
    const handler = variable<SetMapHandler>();
    const data = new Set([new Map([["x", 1]]), new Map([["y", 2]])]);
    const result = handler.count(data);

    const compiled = compile(result, { handler });
    const evalResult = evaluate(compiled, {
      handler: {
        count: (data: Set<Map<string, number>>) => data.size,
      },
    });
    expect(evalResult).toBe(2);
  });
});
