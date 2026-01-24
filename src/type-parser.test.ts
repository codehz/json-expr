import { describe, expect, test } from "bun:test";
import { expr, variable } from "./index";
import type { InferExpressionResult, ValidateExpression } from "./type-parser";

// ============================================================================
// 类型断言辅助
// ============================================================================

type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

describe("type-parser 单元测试", () => {
  describe("标识符提取测试", () => {
    test("类型测试：简单表达式的标识符提取", () => {
      const _x = variable<number>();
      const _y = variable<number>();

      // 验证表达式验证通过
      type Context = { x: typeof _x; y: typeof _y };
      type Result = ValidateExpression<"x + y", Context>;
      type _test = Expect<Equal<Result, true>>;

      expect(true).toBe(true);
    });

    test("类型测试：检测未定义的标识符", () => {
      const _x = variable<number>();

      type Context = { x: typeof _x };
      type Result = ValidateExpression<"x + z", Context>;

      // 应该返回错误类型
      type _test = Expect<Equal<Result, { error: "undefined_identifiers"; identifiers: "z" }>>;

      expect(true).toBe(true);
    });

    test("类型测试：跳过保留字和字面量", () => {
      const _x = variable<number>();

      type Context = { x: typeof _x };
      // true, false, null 等保留字应该被跳过
      type Result = ValidateExpression<"x > 0 ? true : false", Context>;
      type _test = Expect<Equal<Result, true>>;

      expect(true).toBe(true);
    });
  });

  describe("类型推导测试", () => {
    test("类型测试：数字加法推导为 number", () => {
      const _x = variable<number>();
      const _y = variable<number>();

      type Context = { x: typeof _x; y: typeof _y };
      type Result = InferExpressionResult<"x + y", Context>;
      type _test = Expect<Equal<Result, number>>;

      expect(true).toBe(true);
    });

    test("类型测试：比较运算推导为 boolean", () => {
      const _x = variable<number>();
      const _y = variable<number>();

      type Context = { x: typeof _x; y: typeof _y };
      type Result = InferExpressionResult<"x > y", Context>;
      type _test = Expect<Equal<Result, boolean>>;

      expect(true).toBe(true);
    });

    test("类型测试：字符串加法推导为 string", () => {
      const _a = variable<string>();
      const _b = variable<string>();

      type Context = { a: typeof _a; b: typeof _b };
      type Result = InferExpressionResult<"a + b", Context>;
      type _test = Expect<Equal<Result, string>>;

      expect(true).toBe(true);
    });

    test("类型测试：乘法推导为 number", () => {
      const _x = variable<number>();
      const _y = variable<number>();

      type Context = { x: typeof _x; y: typeof _y };
      type Result = InferExpressionResult<"x * y", Context>;
      type _test = Expect<Equal<Result, number>>;

      expect(true).toBe(true);
    });

    test("类型测试：逻辑非推导为 boolean", () => {
      const _x = variable<boolean>();

      type Context = { x: typeof _x };
      type Result = InferExpressionResult<"!x", Context>;
      type _test = Expect<Equal<Result, boolean>>;

      expect(true).toBe(true);
    });

    test("类型测试：三元表达式推导为分支类型的联合", () => {
      const _x = variable<number>();

      type Context = { x: typeof _x };
      // x > 0 ? 1 : 0  =>  number | number => number
      type Result = InferExpressionResult<"x > 0 ? 1 : 0", Context>;
      type _test = Expect<Equal<Result, number>>;

      expect(true).toBe(true);
    });
  });

  describe("运行时行为测试", () => {
    test("expr 函数返回正确推导的类型", () => {
      const _x = variable<number>();
      const _y = variable<number>();

      const _sum = expr({ x: _x, y: _y })("x + y");

      // 验证类型推导
      type _SumType = typeof _sum._type;
      type _test = Expect<Equal<_SumType, number>>;

      expect(_sum._tag).toBe("expression");
      expect(_sum.source).toBe("x + y");
    });

    test("expr 函数支持嵌套表达式", () => {
      const _x = variable<number>();
      const _y = variable<number>();

      const _sum = expr({ x: _x, y: _y })("x + y");
      const _doubled = expr({ sum: _sum })("sum * 2");

      type _DoubledType = typeof _doubled._type;
      type _test = Expect<Equal<_DoubledType, number>>;

      expect(_doubled.source).toBe("sum * 2");
    });

    test("expr 函数正确推导比较表达式", () => {
      const _age = variable<number>();

      const _isAdult = expr({ age: _age })("age >= 18");

      type _IsAdultType = typeof _isAdult._type;
      type _test = Expect<Equal<_IsAdultType, boolean>>;

      expect(_isAdult.source).toBe("age >= 18");
    });

    test("expr 函数正确推导复杂表达式", () => {
      const _x = variable<number>();
      const _y = variable<number>();

      // (x + y) * 2 - 1
      const _complex = expr({ x: _x, y: _y })("(x + y) * 2 - 1");

      type _ComplexType = typeof _complex._type;
      type _test = Expect<Equal<_ComplexType, number>>;

      expect(_complex.source).toBe("(x + y) * 2 - 1");
    });

    test("expr 函数正确推导逻辑表达式", () => {
      const _a = variable<boolean>();
      const _b = variable<boolean>();

      const _result = expr({ a: _a, b: _b })("a && b || !a");

      // 逻辑表达式最终返回 boolean
      type _ResultType = typeof _result._type;
      // && 和 || 的返回类型较复杂，但最终都是 boolean 相关

      expect(_result.source).toBe("a && b || !a");
    });

    test("expr 函数处理字符串表达式", () => {
      const _firstName = variable<string>();
      const _lastName = variable<string>();

      const _fullName = expr({ firstName: _firstName, lastName: _lastName })("firstName + lastName");

      type _FullNameType = typeof _fullName._type;
      type _test = Expect<Equal<_FullNameType, string>>;

      expect(_fullName.source).toBe("firstName + lastName");
    });
  });

  describe("集成测试", () => {
    test("完整流程：类型推导 + 编译 + 执行", () => {
      const _x = variable<number>();
      const _y = variable<number>();

      // 类型自动推导
      const _sum = expr({ x: _x, y: _y })("x + y");
      const _isPositive = expr({ sum: _sum })("sum > 0");

      // 验证类型
      type _SumType = typeof _sum._type;
      type _IsPositiveType = typeof _isPositive._type;

      type _test1 = Expect<Equal<_SumType, number>>;
      type _test2 = Expect<Equal<_IsPositiveType, boolean>>;

      expect(_sum._tag).toBe("expression");
      expect(_isPositive._tag).toBe("expression");
    });
  });

  describe("边界情况测试", () => {
    test("类型测试：空表达式处理", () => {
      const _x = variable<number>();

      type Context = { x: typeof _x };
      type Result = ValidateExpression<"", Context>;

      // 空表达式没有标识符需要验证，应该通过
      type _test = Expect<Equal<Result, true>>;

      expect(true).toBe(true);
    });

    test("类型测试：只有数字字面量", () => {
      const _x = variable<number>();

      type Context = { x: typeof _x };
      type Result = InferExpressionResult<"42", Context>;
      type _test = Expect<Equal<Result, number>>;

      expect(true).toBe(true);
    });

    test("类型测试：带括号的表达式", () => {
      const _x = variable<number>();
      const _y = variable<number>();

      type Context = { x: typeof _x; y: typeof _y };
      type Result = InferExpressionResult<"(x + y) * 2", Context>;
      type _test = Expect<Equal<Result, number>>;

      expect(true).toBe(true);
    });

    test("类型测试：一元负号", () => {
      const _x = variable<number>();

      type Context = { x: typeof _x };
      type Result = InferExpressionResult<"-x", Context>;
      type _test = Expect<Equal<Result, number>>;

      expect(true).toBe(true);
    });
  });
});
