import { expect, test } from "bun:test";
import { compile, evaluate, expr, variable } from "./index";

test("集成测试：基础对象属性访问", () => {
  // 测试创建包含 name(string)、value(number)、enabled(boolean) 的对象变量
  // 并测试访问各个属性的表达式
  const obj = variable<{
    name: string;
    value: number;
    enabled: boolean;
  }>();

  // 访问 name 属性
  const nameExpr = expr({ obj })("obj.name");
  const nameCompiled = compile(nameExpr, { obj });
  expect(evaluate<string>(nameCompiled, { obj: { name: "test", value: 42, enabled: true } })).toBe("test");

  // 访问 value 属性
  const valueExpr = expr({ obj })("obj.value");
  const valueCompiled = compile(valueExpr, { obj });
  expect(evaluate<number>(valueCompiled, { obj: { name: "test", value: 42, enabled: true } })).toBe(42);

  // 访问 enabled 属性
  const enabledExpr = expr({ obj })("obj.enabled");
  const enabledCompiled = compile(enabledExpr, { obj });
  expect(evaluate<boolean>(enabledCompiled, { obj: { name: "test", value: 42, enabled: true } })).toBe(true);
});

test("集成测试：对象属性在表达式中的计算", () => {
  // 测试使用对象属性进行数学运算（如 obj.value * 2）
  const obj = variable<{
    value: number;
    multiplier: number;
  }>();

  // 简单乘法
  const doubleExpr = expr({ obj })("obj.value * 2");
  const doubleCompiled = compile(doubleExpr, { obj });
  expect(evaluate<number>(doubleCompiled, { obj: { value: 10, multiplier: 3 } })).toBe(20);

  // 使用对象内两个属性
  const productExpr = expr({ obj })("obj.value * obj.multiplier");
  const productCompiled = compile(productExpr, { obj });
  expect(evaluate<number>(productCompiled, { obj: { value: 10, multiplier: 3 } })).toBe(30);

  // 复杂表达式
  const complexExpr = expr({ obj })("obj.value * obj.multiplier + obj.value");
  const complexCompiled = compile(complexExpr, { obj });
  expect(evaluate<number>(complexCompiled, { obj: { value: 10, multiplier: 3 } })).toBe(40); // 10*3 + 10 = 40
});

test("集成测试：嵌套对象属性访问", () => {
  // 测试创建嵌套对象并测试多层属性链访问
  const profile = variable<{
    user: {
      name: string;
      age: number;
    };
    settings: {
      theme: string;
    };
  }>();

  // 访问嵌套的 user.name
  const userNameExpr = expr({ profile })("profile.user.name");
  const userNameCompiled = compile(userNameExpr, { profile });
  expect(
    evaluate<string>(userNameCompiled, {
      profile: {
        user: { name: "Alice", age: 30 },
        settings: { theme: "dark" },
      },
    })
  ).toBe("Alice");

  // 访问嵌套的 user.age
  const userAgeExpr = expr({ profile })("profile.user.age");
  const userAgeCompiled = compile(userAgeExpr, { profile });
  expect(
    evaluate<number>(userAgeCompiled, {
      profile: {
        user: { name: "Alice", age: 30 },
        settings: { theme: "dark" },
      },
    })
  ).toBe(30);

  // 访问嵌套的 settings.theme
  const themeExpr = expr({ profile })("profile.settings.theme");
  const themeCompiled = compile(themeExpr, { profile });
  expect(
    evaluate<string>(themeCompiled, {
      profile: {
        user: { name: "Alice", age: 30 },
        settings: { theme: "dark" },
      },
    })
  ).toBe("dark");
});

test("集成测试：深层嵌套对象", () => {
  // 测试三层以上的嵌套结构并验证深层属性访问
  const config = variable<{
    level1: {
      level2: {
        level3: {
          value: number;
          label: string;
        };
      };
    };
  }>();

  // 访问深层 value 属性
  const deepValueExpr = expr({ config })("config.level1.level2.level3.value");
  const deepValueCompiled = compile(deepValueExpr, { config });
  const testData = {
    config: {
      level1: {
        level2: {
          level3: {
            value: 999,
            label: "deep",
          },
        },
      },
    },
  };
  expect(evaluate<number>(deepValueCompiled, testData)).toBe(999);

  // 访问深层 label 属性
  const deepLabelExpr = expr({ config })("config.level1.level2.level3.label");
  const deepLabelCompiled = compile(deepLabelExpr, { config });
  expect(evaluate<string>(deepLabelCompiled, testData)).toBe("deep");

  // 在表达式中使用深层属性
  const deepCalcExpr = expr({ config })("config.level1.level2.level3.value * 2");
  const deepCalcCompiled = compile(deepCalcExpr, { config });
  expect(evaluate<number>(deepCalcCompiled, testData)).toBe(1998);
});

test("集成测试：对象内数组方法", () => {
  // 测试包含 numbers 数组和 sum 方法的对象，测试方法调用
  const obj = variable<{
    numbers: number[];
    sum: () => number;
  }>();

  // 调用对象方法
  const sumExpr = expr({ obj })("obj.sum()");
  const sumCompiled = compile(sumExpr, { obj });

  const testObj = {
    numbers: [1, 2, 3, 4, 5],
    sum: function () {
      return this.numbers.reduce((a: number, b: number) => a + b, 0);
    },
  };

  expect(evaluate<number>(sumCompiled, { obj: testObj })).toBe(15);
});

test("集成测试：多个对象方法调用", () => {
  // 测试对象包含多个方法（如 getMax(), getMin(), getAverage()）
  const stats = variable<{
    numbers: number[];
    getMax: () => number;
    getMin: () => number;
    getAverage: () => number;
  }>();

  // 获取最大值
  const maxExpr = expr({ stats })("stats.getMax()");
  const maxCompiled = compile(maxExpr, { stats });

  // 获取最小值
  const minExpr = expr({ stats })("stats.getMin()");
  const minCompiled = compile(minExpr, { stats });

  // 获取平均值
  const avgExpr = expr({ stats })("stats.getAverage()");
  const avgCompiled = compile(avgExpr, { stats });

  const testData = {
    numbers: [10, 20, 30, 40, 50],
    getMax: function () {
      return Math.max(...this.numbers);
    },
    getMin: function () {
      return Math.min(...this.numbers);
    },
    getAverage: function () {
      return this.numbers.reduce((a: number, b: number) => a + b, 0) / this.numbers.length;
    },
  };

  expect(evaluate<number>(maxCompiled, { stats: testData })).toBe(50);
  expect(evaluate<number>(minCompiled, { stats: testData })).toBe(10);
  expect(evaluate<number>(avgCompiled, { stats: testData })).toBe(30);
});
