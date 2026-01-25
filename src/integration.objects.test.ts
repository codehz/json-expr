import { describe, expect, test } from "bun:test";
import { expr, variable } from "./index";
import { compileAndEvaluate } from "./test-helper";

describe("集成测试：对象属性访问", () => {
  describe("基础对象属性访问", () => {
    test("访问对象属性", () => {
      // 测试创建包含 name(string)、value(number)、enabled(boolean) 的对象变量
      // 并测试访问各个属性的表达式
      const obj = variable<{
        name: string;
        value: number;
        enabled: boolean;
      }>();

      // 访问 name 属性
      const nameExpr = expr({ obj })("obj.name");
      expect(compileAndEvaluate<string>(nameExpr, { obj }, { obj: { name: "test", value: 42, enabled: true } })).toBe(
        "test"
      );

      // 访问 value 属性
      const valueExpr = expr({ obj })("obj.value");
      expect(compileAndEvaluate<number>(valueExpr, { obj }, { obj: { name: "test", value: 42, enabled: true } })).toBe(
        42
      );

      // 访问 enabled 属性
      const enabledExpr = expr({ obj })("obj.enabled");
      expect(
        compileAndEvaluate<boolean>(enabledExpr, { obj }, { obj: { name: "test", value: 42, enabled: true } })
      ).toBe(true);
    });
  });

  describe("对象属性在表达式中的计算", () => {
    test("使用对象属性进行数学运算", () => {
      // 测试使用对象属性进行数学运算（如 obj.value * 2）
      const obj = variable<{
        value: number;
        multiplier: number;
      }>();

      // 简单乘法
      const doubleExpr = expr({ obj })("obj.value * 2");
      expect(compileAndEvaluate<number>(doubleExpr, { obj }, { obj: { value: 10, multiplier: 3 } })).toBe(20);

      // 使用对象内两个属性
      const productExpr = expr({ obj })("obj.value * obj.multiplier");
      expect(compileAndEvaluate<number>(productExpr, { obj }, { obj: { value: 10, multiplier: 3 } })).toBe(30);

      // 复杂表达式
      const complexExpr = expr({ obj })("obj.value * obj.multiplier + obj.value");
      expect(compileAndEvaluate<number>(complexExpr, { obj }, { obj: { value: 10, multiplier: 3 } })).toBe(40); // 10*3 + 10 = 40
    });
  });

  describe("嵌套对象属性访问", () => {
    test("多层属性链访问", () => {
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
      expect(
        compileAndEvaluate<string>(
          userNameExpr,
          { profile },
          {
            profile: {
              user: { name: "Alice", age: 30 },
              settings: { theme: "dark" },
            },
          }
        )
      ).toBe("Alice");

      // 访问嵌套的 user.age
      const userAgeExpr = expr({ profile })("profile.user.age");
      expect(
        compileAndEvaluate<number>(
          userAgeExpr,
          { profile },
          {
            profile: {
              user: { name: "Alice", age: 30 },
              settings: { theme: "dark" },
            },
          }
        )
      ).toBe(30);

      // 访问嵌套的 settings.theme
      const themeExpr = expr({ profile })("profile.settings.theme");
      expect(
        compileAndEvaluate<string>(
          themeExpr,
          { profile },
          {
            profile: {
              user: { name: "Alice", age: 30 },
              settings: { theme: "dark" },
            },
          }
        )
      ).toBe("dark");
    });
  });

  describe("深层嵌套对象", () => {
    test("三层以上嵌套结构", () => {
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
      expect(compileAndEvaluate<number>(deepValueExpr, { config }, testData)).toBe(999);

      // 访问深层 label 属性
      const deepLabelExpr = expr({ config })("config.level1.level2.level3.label");
      expect(compileAndEvaluate<string>(deepLabelExpr, { config }, testData)).toBe("deep");

      // 在表达式中使用深层属性
      const deepCalcExpr = expr({ config })("config.level1.level2.level3.value * 2");
      expect(compileAndEvaluate<number>(deepCalcExpr, { config }, testData)).toBe(1998);
    });
  });

  describe("对象内数组方法", () => {
    test("调用对象方法", () => {
      // 测试包含 numbers 数组和 sum 方法的对象，测试方法调用
      const obj = variable<{
        numbers: number[];
        sum: () => number;
      }>();

      // 调用对象方法
      const sumExpr = expr({ obj })("obj.sum()");

      const testObj = {
        numbers: [1, 2, 3, 4, 5],
        sum: function () {
          return this.numbers.reduce((a: number, b: number) => a + b, 0);
        },
      };

      expect(compileAndEvaluate<number>(sumExpr, { obj }, { obj: testObj })).toBe(15);
    });
  });

  describe("多个对象方法调用", () => {
    test("对象包含多个方法", () => {
      // 测试对象包含多个方法（如 getMax(), getMin(), getAverage()）
      const stats = variable<{
        numbers: number[];
        getMax: () => number;
        getMin: () => number;
        getAverage: () => number;
      }>();

      // 获取最大值
      const maxExpr = expr({ stats })("stats.getMax()");
      // 获取最小值
      const minExpr = expr({ stats })("stats.getMin()");
      // 获取平均值
      const avgExpr = expr({ stats })("stats.getAverage()");

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

      expect(compileAndEvaluate<number>(maxExpr, { stats }, { stats: testData })).toBe(50);
      expect(compileAndEvaluate<number>(minExpr, { stats }, { stats: testData })).toBe(10);
      expect(compileAndEvaluate<number>(avgExpr, { stats }, { stats: testData })).toBe(30);
    });
  });
});
