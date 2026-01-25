import { describe, expect, test } from "bun:test";
import { collectIdentifiers, generate, transformIdentifiers } from "./generate";
import { parse } from "./parser";

describe("parser 单元测试", () => {
  describe("parse 函数测试", () => {
    test("数字字面量", () => {
      expect(generate(parse("42"))).toBe("42");
      expect(generate(parse("3.14"))).toBe("3.14");
      expect(generate(parse("0xff"))).toBe("0xff");
      expect(generate(parse("1e10"))).toBe("1e10");
    });

    test("字符串字面量", () => {
      expect(generate(parse('"hello"'))).toBe('"hello"');
      expect(generate(parse("'world'"))).toBe('"world"');
    });

    test("布尔值和空值字面量", () => {
      expect(generate(parse("true"))).toBe("true");
      expect(generate(parse("false"))).toBe("false");
      expect(generate(parse("null"))).toBe("null");
    });

    test("标识符", () => {
      expect(generate(parse("foo"))).toBe("foo");
      expect(generate(parse("_bar"))).toBe("_bar");
      expect(generate(parse("$baz"))).toBe("$baz");
    });

    test("二元表达式", () => {
      expect(generate(parse("a + b"))).toBe("a+b");
      expect(generate(parse("a - b"))).toBe("a-b");
      expect(generate(parse("a * b"))).toBe("a*b");
      expect(generate(parse("a / b"))).toBe("a/b");
      expect(generate(parse("a % b"))).toBe("a%b");
      expect(generate(parse("a ** b"))).toBe("a**b");
    });

    test("比较运算符", () => {
      expect(generate(parse("a < b"))).toBe("a<b");
      expect(generate(parse("a > b"))).toBe("a>b");
      expect(generate(parse("a <= b"))).toBe("a<=b");
      expect(generate(parse("a >= b"))).toBe("a>=b");
      expect(generate(parse("a == b"))).toBe("a==b");
      expect(generate(parse("a === b"))).toBe("a===b");
      expect(generate(parse("a != b"))).toBe("a!=b");
      expect(generate(parse("a !== b"))).toBe("a!==b");
    });

    test("逻辑运算符", () => {
      expect(generate(parse("a && b"))).toBe("a&&b");
      expect(generate(parse("a || b"))).toBe("a||b");
      expect(generate(parse("a ?? b"))).toBe("a??b");
    });

    test("关键字运算符 (in, instanceof)", () => {
      expect(generate(parse("key in obj"))).toBe("key in obj");
      expect(generate(parse("value instanceof Array"))).toBe("value instanceof Array");
      expect(generate(parse("'prop' in object"))).toBe('"prop" in object');
    });

    test("一元表达式", () => {
      expect(generate(parse("!a"))).toBe("!a");
      expect(generate(parse("-a"))).toBe("-a");
      expect(generate(parse("+a"))).toBe("+a");
      expect(generate(parse("~a"))).toBe("~a");
      expect(generate(parse("typeof a"))).toBe("typeof a");
    });

    test("条件表达式", () => {
      expect(generate(parse("a ? b : c"))).toBe("a?b:c");
    });

    test("成员表达式", () => {
      expect(generate(parse("a.b"))).toBe("a.b");
      expect(generate(parse("a.b.c"))).toBe("a.b.c");
      expect(generate(parse("a[0]"))).toBe("a[0]");
      expect(generate(parse('a["key"]'))).toBe('a["key"]');
    });

    test("可选链", () => {
      expect(generate(parse("a?.b"))).toBe("a?.b");
      expect(generate(parse("a?.[0]"))).toBe("a?.[0]");
      expect(generate(parse("a?.()"))).toBe("a?.()");
    });

    test("调用表达式", () => {
      expect(generate(parse("f()"))).toBe("f()");
      expect(generate(parse("f(a)"))).toBe("f(a)");
      expect(generate(parse("f(a, b)"))).toBe("f(a,b)");
      expect(generate(parse("a.b(c)"))).toBe("a.b(c)");
    });

    test("数组表达式", () => {
      expect(generate(parse("[]"))).toBe("[]");
      expect(generate(parse("[1, 2, 3]"))).toBe("[1,2,3]");
      expect(generate(parse("[a, b]"))).toBe("[a,b]");
    });

    test("对象表达式", () => {
      expect(generate(parse("{}"))).toBe("{}");
      expect(generate(parse("{ a: 1 }"))).toBe("{a:1}");
      expect(generate(parse("{ a: 1, b: 2 }"))).toBe("{a:1,b:2}");
      expect(generate(parse("{ a }"))).toBe("{a}"); // shorthand 保持简写形式
      expect(generate(parse('{ "key": value }'))).toBe('{"key":value}');
      expect(generate(parse("{ [key]: value }"))).toBe("{[key]:value}");
    });

    test("运算符优先级", () => {
      // 乘法优先于加法
      expect(generate(parse("a + b * c"))).toBe("a+b*c");
      expect(generate(parse("a * b + c"))).toBe("a*b+c");

      // 括号改变优先级
      expect(generate(parse("(a + b) * c"))).toBe("(a+b)*c");

      // 比较运算符优先级
      expect(generate(parse("a + b < c + d"))).toBe("a+b<c+d");

      // 逻辑非 ! 优先于逻辑与 &&
      expect(generate(parse("!(a && b)"))).toBe("!(a&&b)");
      expect(generate(parse("!a && b"))).toBe("(!a)&&b");

      // 逻辑非 ! 优先于逻辑或 ||
      expect(generate(parse("!(a || b)"))).toBe("!(a||b)");
      expect(generate(parse("!a || b"))).toBe("(!a)||b");

      // 多个逻辑非
      expect(generate(parse("!!a"))).toBe("!!a");
      expect(generate(parse("!a && !b"))).toBe("(!a)&&(!b)");
    });

    test("右结合性", () => {
      // ** 是右结合的
      expect(generate(parse("a ** b ** c"))).toBe("a**b**c");
    });

    test("用于明确语义的括号", () => {
      // 条件表达式在二元表达式中需要括号
      expect(generate(parse("(a ? b : c) + d"))).toBe("(a?b:c)+d");
      expect(generate(parse("a + (b ? c : d)"))).toBe("a+(b?c:d)");
    });

    test("生成代码时的括号处理", () => {
      // MemberExpr 对象需要括号的情况
      expect(generate(parse("(a + b).c"))).toBe("(a+b).c");
      expect(generate(parse("(a ? b : c).d"))).toBe("(a?b:c).d");
      expect(generate(parse("(-a).b"))).toBe("(-a).b");
      expect(generate(parse("({a: 1}).a"))).toBe("({a:1}).a");
      expect(generate(parse("(42).toString()"))).toBe("(42).toString()");

      // CallExpr callee 需要括号的情况
      expect(generate(parse("(a + b)()"))).toBe("(a+b)()");
      expect(generate(parse("(a ? b : c)()"))).toBe("(a?b:c)()");
      expect(generate(parse("(() => a)()"))).toBe("(()=>a)()");

      // ConditionalExpr test 需要括号的情况
      expect(generate(parse("(a ? b : c) ? d : e"))).toBe("(a?b:c)?d:e");
    });

    test("复杂表达式", () => {
      const expr = "a > 0 ? a * 2 : a + 1";
      expect(generate(parse(expr))).toBe("a>0?a*2:a+1");
    });

    test("嵌套函数调用", () => {
      const expr = "Math.max(Math.min(a, b), c)";
      expect(generate(parse(expr))).toBe("Math.max(Math.min(a,b),c)");
    });

    test("混合表达式", () => {
      const expr = "arr[i].value + obj.method(x, y)";
      expect(generate(parse(expr))).toBe("arr[i].value+obj.method(x,y)");
    });
  });

  describe("transformIdentifiers 函数测试", () => {
    test("基本转换", () => {
      const ast = parse("x + y");
      const transformed = transformIdentifiers(ast, (name) => `$${name}`);
      expect(generate(transformed)).toBe("$x+$y");
    });

    test("使用映射", () => {
      const ast = parse("a + b * 2");
      const mapping: Record<string, number> = { a: 0, b: 1 };
      const transformed = transformIdentifiers(ast, (name) => (name in mapping ? `$${mapping[name]}` : name));
      expect(generate(transformed)).toBe("$0+$1*2");
    });

    test("成员访问保留属性名", () => {
      const ast = parse("obj.property");
      const transformed = transformIdentifiers(ast, (name) => `$${name}`);
      expect(generate(transformed)).toBe("$obj.property");
    });

    test("计算成员访问转换属性", () => {
      const ast = parse("obj[key]");
      const transformed = transformIdentifiers(ast, (name) => `$${name}`);
      expect(generate(transformed)).toBe("$obj[$key]");
    });
  });

  describe("collectIdentifiers 函数测试", () => {
    test("收集所有标识符", () => {
      const ast = parse("a + b * c");
      const identifiers = collectIdentifiers(ast);
      expect(identifiers).toEqual(new Set(["a", "b", "c"]));
    });

    test("成员访问仅收集对象", () => {
      const ast = parse("obj.property");
      const identifiers = collectIdentifiers(ast);
      expect(identifiers).toEqual(new Set(["obj"]));
    });

    test("计算成员访问包含键", () => {
      const ast = parse("obj[key]");
      const identifiers = collectIdentifiers(ast);
      expect(identifiers).toEqual(new Set(["obj", "key"]));
    });

    test("函数调用", () => {
      const ast = parse("Math.max(a, b)");
      const identifiers = collectIdentifiers(ast);
      expect(identifiers).toEqual(new Set(["Math", "a", "b"]));
    });
  });
});
