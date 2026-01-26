import { describe, expect, test } from "bun:test";
import { generate } from "../../core/generate";
import { variable } from "../../index";
import { getProxyMetadata } from "../../proxy/proxy-metadata";
import { compileAndEvaluate } from "./test-helper";

describe("代理变量 单元测试", () => {
  test("创建代理变量", () => {
    const x = variable<number>();
    expect(typeof x).toBe("function"); // Proxy wraps function
    const meta = getProxyMetadata(x as object);
    expect(meta?.type).toBe("variable");
  });

  test("支持属性访问", () => {
    interface Config {
      timeout: number;
      retries: number;
    }
    const config = variable<Config>();
    const timeout = config.timeout;

    const meta = getProxyMetadata(timeout as object);
    expect(meta?.type).toBe("expression");
    expect(meta?.ast).toBeDefined();
    if (meta?.ast) {
      const source = generate(meta.ast);
      expect(source).toContain("timeout");
    }
  });

  test("编译属性访问", () => {
    interface Config {
      timeout: number;
    }
    const config = variable<Config>();
    const timeout = config.timeout;

    const result = compileAndEvaluate(timeout, { config }, { config: { timeout: 5000 } });
    expect(result).toBe(5000);
  });

  test("支持方法调用", () => {
    interface Builder {
      build(name: string): { name: string };
    }
    const builder = variable<Builder>();
    const result = builder.build("test");

    const meta = getProxyMetadata(result as object);
    expect(meta?.type).toBe("expression");
    expect(meta?.ast).toBeDefined();
    if (meta?.ast) {
      const source = generate(meta.ast);
      expect(source).toContain("build");
    }
  });

  test("编译字面量参数的方法调用", () => {
    interface Calculator {
      add(a: number, b: number): number;
    }
    const calc = variable<Calculator>();
    const sum = calc.add(1, 2);

    const result = compileAndEvaluate(sum, { calc }, { calc: { add: (a: number, b: number) => a + b } });
    expect(result).toBe(3);
  });

  test("编译变量参数的方法调用", () => {
    interface Calculator {
      double(n: number): number;
    }
    const calc = variable<Calculator>();
    const x = variable<number>();
    const doubled = calc.double(x);

    const result = compileAndEvaluate(
      doubled,
      { calc, x },
      {
        calc: { double: (n: number) => n * 2 },
        x: 5,
      }
    );
    expect(result).toBe(10);
  });

  test("支持链式方法调用", () => {
    interface Builder {
      setName(name: string): Builder;
      build(): { name: string };
    }
    const builder = variable<Builder>();
    const result = builder.setName("test").build();

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
    const evalResult = compileAndEvaluate(result, { builder }, { builder: mockBuilder });
    expect(evalResult).toEqual({ name: "test" });
  });

  test("支持嵌套属性访问", () => {
    interface Nested {
      level1: {
        level2: {
          value: number;
        };
      };
    }
    const obj = variable<Nested>();
    const value = obj.level1.level2.value;

    const result = compileAndEvaluate(
      value,
      { obj },
      {
        obj: { level1: { level2: { value: 42 } } },
      }
    );
    expect(result).toBe(42);
  });

  test("支持数组字面量参数", () => {
    interface UI {
      list(items: string[]): string;
    }
    const ui = variable<UI>();
    const list = ui.list(["a", "b", "c"]);

    const result = compileAndEvaluate(
      list,
      { ui },
      {
        ui: { list: (items: string[]) => items.join(",") },
      }
    );
    expect(result).toBe("a,b,c");
  });

  test("支持对象字面量参数", () => {
    interface UI {
      configure(opts: { padding: number; margin: number }): void;
    }
    const ui = variable<UI>();
    const configured = ui.configure({ padding: 10, margin: 5 });

    const meta = getProxyMetadata(configured as object);
    expect(meta?.ast).toBeDefined();
    if (meta?.ast) {
      const source = generate(meta.ast);
      expect(source).toContain("padding");
      expect(source).toContain("margin");
    }
  });

  test("支持混合变量和字面量参数", () => {
    interface Formatter {
      format(template: string, value: number): string;
    }
    const fmt = variable<Formatter>();
    const count = variable<number>();
    const result = fmt.format("Count: ", count);

    const evalResult = compileAndEvaluate(
      result,
      { fmt, count },
      {
        fmt: { format: (t: string, v: number) => t + v },
        count: 42,
      }
    );
    expect(evalResult).toBe("Count: 42");
  });
});
