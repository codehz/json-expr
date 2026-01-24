import { describe, expect, test } from "bun:test";
import { compile, evaluate, variable } from "./index";
import { getProxyMetadata } from "./proxy-metadata";

describe("Proxy Variable", () => {
  test("should create proxy variable", () => {
    const x = variable<number>();
    expect(typeof x).toBe("function"); // Proxy wraps function
    const meta = getProxyMetadata(x as object);
    expect(meta?.type).toBe("variable");
  });

  test("should support property access", () => {
    interface Config {
      timeout: number;
      retries: number;
    }
    const config = variable<Config>();
    const timeout = config.timeout;

    const meta = getProxyMetadata(timeout as object);
    expect(meta?.type).toBe("expression");
    expect(meta?.source).toContain("timeout");
  });

  test("should compile property access", () => {
    interface Config {
      timeout: number;
    }
    const config = variable<Config>();
    const timeout = config.timeout;

    const compiled = compile(timeout, { config });
    const result = evaluate(compiled, { config: { timeout: 5000 } });
    expect(result).toBe(5000);
  });

  test("should support method calls", () => {
    interface Builder {
      build(name: string): { name: string };
    }
    const builder = variable<Builder>();
    const result = builder.build("test");

    const meta = getProxyMetadata(result as object);
    expect(meta?.type).toBe("expression");
    expect(meta?.source).toContain("build");
  });

  test("should compile method calls with literal arguments", () => {
    interface Calculator {
      add(a: number, b: number): number;
    }
    const calc = variable<Calculator>();
    const sum = calc.add(1, 2);

    const compiled = compile(sum, { calc });
    const result = evaluate(compiled, { calc: { add: (a: number, b: number) => a + b } });
    expect(result).toBe(3);
  });

  test("should compile method calls with variable arguments", () => {
    interface Calculator {
      double(n: number): number;
    }
    const calc = variable<Calculator>();
    const x = variable<number>();
    const doubled = calc.double(x);

    const compiled = compile(doubled, { calc, x });
    const result = evaluate(compiled, {
      calc: { double: (n: number) => n * 2 },
      x: 5,
    });
    expect(result).toBe(10);
  });

  test("should support chained method calls", () => {
    interface Builder {
      setName(name: string): Builder;
      build(): { name: string };
    }
    const builder = variable<Builder>();
    const result = builder.setName("test").build();

    const compiled = compile(result, { builder });
    const mockBuilder = {
      name: "",
      setName(name: string) {
        this.name = name;
        return this;
      },
      build() {
        return { name: this.name };
      },
    };
    const evalResult = evaluate(compiled, { builder: mockBuilder });
    expect(evalResult).toEqual({ name: "test" });
  });

  test("should support nested property access", () => {
    interface Nested {
      level1: {
        level2: {
          value: number;
        };
      };
    }
    const obj = variable<Nested>();
    const value = obj.level1.level2.value;

    const compiled = compile(value, { obj });
    const result = evaluate(compiled, {
      obj: { level1: { level2: { value: 42 } } },
    });
    expect(result).toBe(42);
  });

  test("should support array literal arguments", () => {
    interface UI {
      list(items: string[]): string;
    }
    const ui = variable<UI>();
    const list = ui.list(["a", "b", "c"]);

    const compiled = compile(list, { ui });
    const result = evaluate(compiled, {
      ui: { list: (items: string[]) => items.join(",") },
    });
    expect(result).toBe("a,b,c");
  });

  test("should support object literal arguments", () => {
    interface UI {
      configure(opts: { padding: number; margin: number }): void;
    }
    const ui = variable<UI>();
    const configured = ui.configure({ padding: 10, margin: 5 });

    const meta = getProxyMetadata(configured as object);
    expect(meta?.source).toContain("padding");
    expect(meta?.source).toContain("margin");
  });

  test("should support mixed variable and literal arguments", () => {
    interface Formatter {
      format(template: string, value: number): string;
    }
    const fmt = variable<Formatter>();
    const count = variable<number>();
    const result = fmt.format("Count: ", count);

    const compiled = compile(result, { fmt, count });
    const evalResult = evaluate(compiled, {
      fmt: { format: (t: string, v: number) => t + v },
      count: 42,
    });
    expect(evalResult).toBe("Count: 42");
  });
});
