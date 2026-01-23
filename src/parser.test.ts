import { expect, test } from "bun:test";
import { collectIdentifiers, generate, parse, transformIdentifiers } from "./parser";

test("parse: number literals", () => {
  expect(generate(parse("42"))).toBe("42");
  expect(generate(parse("3.14"))).toBe("3.14");
  expect(generate(parse("0xff"))).toBe("0xff");
  expect(generate(parse("1e10"))).toBe("1e10");
});

test("parse: string literals", () => {
  expect(generate(parse('"hello"'))).toBe('"hello"');
  expect(generate(parse("'world'"))).toBe('"world"');
});

test("parse: boolean and null literals", () => {
  expect(generate(parse("true"))).toBe("true");
  expect(generate(parse("false"))).toBe("false");
  expect(generate(parse("null"))).toBe("null");
});

test("parse: identifiers", () => {
  expect(generate(parse("foo"))).toBe("foo");
  expect(generate(parse("_bar"))).toBe("_bar");
  expect(generate(parse("$baz"))).toBe("$baz");
});

test("parse: binary expressions", () => {
  expect(generate(parse("a + b"))).toBe("a+b");
  expect(generate(parse("a - b"))).toBe("a-b");
  expect(generate(parse("a * b"))).toBe("a*b");
  expect(generate(parse("a / b"))).toBe("a/b");
  expect(generate(parse("a % b"))).toBe("a%b");
  expect(generate(parse("a ** b"))).toBe("a**b");
});

test("parse: comparison operators", () => {
  expect(generate(parse("a < b"))).toBe("a<b");
  expect(generate(parse("a > b"))).toBe("a>b");
  expect(generate(parse("a <= b"))).toBe("a<=b");
  expect(generate(parse("a >= b"))).toBe("a>=b");
  expect(generate(parse("a == b"))).toBe("a==b");
  expect(generate(parse("a === b"))).toBe("a===b");
  expect(generate(parse("a != b"))).toBe("a!=b");
  expect(generate(parse("a !== b"))).toBe("a!==b");
});

test("parse: logical operators", () => {
  expect(generate(parse("a && b"))).toBe("a&&b");
  expect(generate(parse("a || b"))).toBe("a||b");
  expect(generate(parse("a ?? b"))).toBe("a??b");
});

test("parse: unary expressions", () => {
  expect(generate(parse("!a"))).toBe("!a");
  expect(generate(parse("-a"))).toBe("-a");
  expect(generate(parse("+a"))).toBe("+a");
  expect(generate(parse("~a"))).toBe("~a");
  expect(generate(parse("typeof a"))).toBe("typeof a");
});

test("parse: conditional expressions", () => {
  expect(generate(parse("a ? b : c"))).toBe("a?b:c");
});

test("parse: member expressions", () => {
  expect(generate(parse("a.b"))).toBe("a.b");
  expect(generate(parse("a.b.c"))).toBe("a.b.c");
  expect(generate(parse("a[0]"))).toBe("a[0]");
  expect(generate(parse('a["key"]'))).toBe('a["key"]');
});

test("parse: optional chaining", () => {
  expect(generate(parse("a?.b"))).toBe("a?.b");
  expect(generate(parse("a?.[0]"))).toBe("a?.[0]");
  expect(generate(parse("a?.()"))).toBe("a?.()");
});

test("parse: call expressions", () => {
  expect(generate(parse("f()"))).toBe("f()");
  expect(generate(parse("f(a)"))).toBe("f(a)");
  expect(generate(parse("f(a, b)"))).toBe("f(a,b)");
  expect(generate(parse("a.b(c)"))).toBe("a.b(c)");
});

test("parse: array expressions", () => {
  expect(generate(parse("[]"))).toBe("[]");
  expect(generate(parse("[1, 2, 3]"))).toBe("[1,2,3]");
  expect(generate(parse("[a, b]"))).toBe("[a,b]");
});

test("parse: object expressions", () => {
  expect(generate(parse("{}"))).toBe("{}");
  expect(generate(parse("{ a: 1 }"))).toBe("{a:1}");
  expect(generate(parse("{ a: 1, b: 2 }"))).toBe("{a:1,b:2}");
  expect(generate(parse("{ a }"))).toBe("{a}"); // shorthand 保持简写形式
  expect(generate(parse('{ "key": value }'))).toBe('{"key":value}');
  expect(generate(parse("{ [key]: value }"))).toBe("{[key]:value}");
});

test("parse: operator precedence", () => {
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

test("parse: right associativity", () => {
  // ** 是右结合的
  expect(generate(parse("a ** b ** c"))).toBe("a**b**c");
});

test("parse: parentheses for clarity", () => {
  // 条件表达式在二元表达式中需要括号
  expect(generate(parse("(a ? b : c) + d"))).toBe("(a?b:c)+d");
});

test("transformIdentifiers: basic transformation", () => {
  const ast = parse("x + y");
  const transformed = transformIdentifiers(ast, (name) => `$${name}`);
  expect(generate(transformed)).toBe("$x+$y");
});

test("transformIdentifiers: with mapping", () => {
  const ast = parse("a + b * 2");
  const mapping: Record<string, number> = { a: 0, b: 1 };
  const transformed = transformIdentifiers(ast, (name) => (name in mapping ? `$${mapping[name]}` : name));
  expect(generate(transformed)).toBe("$0+$1*2");
});

test("transformIdentifiers: member access keeps property names", () => {
  const ast = parse("obj.property");
  const transformed = transformIdentifiers(ast, (name) => `$${name}`);
  expect(generate(transformed)).toBe("$obj.property");
});

test("transformIdentifiers: computed member access transforms property", () => {
  const ast = parse("obj[key]");
  const transformed = transformIdentifiers(ast, (name) => `$${name}`);
  expect(generate(transformed)).toBe("$obj[$key]");
});

test("collectIdentifiers: collects all identifiers", () => {
  const ast = parse("a + b * c");
  const identifiers = collectIdentifiers(ast);
  expect(identifiers).toEqual(new Set(["a", "b", "c"]));
});

test("collectIdentifiers: member access object only", () => {
  const ast = parse("obj.property");
  const identifiers = collectIdentifiers(ast);
  expect(identifiers).toEqual(new Set(["obj"]));
});

test("collectIdentifiers: computed member access includes key", () => {
  const ast = parse("obj[key]");
  const identifiers = collectIdentifiers(ast);
  expect(identifiers).toEqual(new Set(["obj", "key"]));
});

test("collectIdentifiers: function calls", () => {
  const ast = parse("Math.max(a, b)");
  const identifiers = collectIdentifiers(ast);
  expect(identifiers).toEqual(new Set(["Math", "a", "b"]));
});

test("parse: complex expressions", () => {
  const expr = "a > 0 ? a * 2 : a + 1";
  expect(generate(parse(expr))).toBe("a>0?a*2:a+1");
});

test("parse: nested function calls", () => {
  const expr = "Math.max(Math.min(a, b), c)";
  expect(generate(parse(expr))).toBe("Math.max(Math.min(a,b),c)");
});

test("parse: mixed expressions", () => {
  const expr = "arr[i].value + obj.method(x, y)";
  expect(generate(parse(expr))).toBe("arr[i].value+obj.method(x,y)");
});
