# @codehz/json-expr

一个可序列化为 JSON 的表达式 DSL 库，提供类型安全的表达式构建、编译和求值。

[![npm version](https://img.shields.io/npm/v/@codehz/json-expr.svg)](https://www.npmjs.com/package/@codehz/json-expr)

## 特性

- 🎯 **类型安全** - 使用 TypeScript 泛型进行完整的编译时类型推导
- 📦 **可序列化** - 编译后的表达式为纯 JSON 格式，易于传输和存储
- 🔧 **灵活的表达式** - 支持任意 JavaScript 表达式，包括函数调用和对象属性访问
- ⚡ **高性能** - 优化的表达式编译和执行
- 🧩 **可组合** - 表达式可以相互组合，形成复杂的计算树
- 🔄 **短路求值** - 支持 `&&`、`||`、`??` 和三元表达式的控制流优化
- 📝 **内联优化** - 自动内联只被引用一次的子表达式
- 🔗 **Proxy 变量系统** - 支持链式属性访问和方法调用，如 `config.timeout`、`user.profile.name`
- 🎛️ **Lambda 表达式** - 类型安全的数组方法支持（map、filter、reduce 等）
- 🛡️ **错误检测** - 编译时检测未定义变量和类型错误

## 快速开始

### 安装

```bash
bun install @codehz/json-expr
```

### 基本用法

```typescript
import { variable, expr, compile, evaluate, t, lambda, wrap } from "@codehz/json-expr";

// 定义类型化变量（使用 TypeScript 泛型）
const x = variable<number>();
const y = variable<number>();

// 构建表达式
const sum = expr({ x, y })("x + y");
const product = expr({ x, y })("x * y");
const result = expr({ sum, product })("sum + product");

// 编译表达式（可序列化为 JSON）
const compiled = compile(result, { x, y });
// => [["x", "y"], "$[0]+$[1]", "$[0]*$[1]", "$[2]+$[3]"]

// 执行编译后的表达式
const value = evaluate(compiled, { x: 2, y: 3 });
// => 11  (2+3 + 2*3 = 5 + 6 = 11)

// 使用模板字符串
const name = variable<string>();
const greeting = t`Hello, ${name}!`;

// 使用 lambda 表达式
const numbers = variable<number[]>();
const doubled = numbers.map(lambda<[number], number>((n) => expr({ n })("n * 2")));

// 使用 wrap 包装静态值
const pattern = wrap(/^[a-z]+$/i);
const input = variable<string>();
const isValid = pattern.test(input);
```

## 核心概念

### Variable（变量）

变量是表达式中的占位符，使用 TypeScript 泛型定义其类型。

```typescript
const age = variable<number>();
const name = variable<string>();
const config = variable<{
  debug: boolean;
  timeout: number;
}>();
```

### Expression（表达式）

表达式对变量或其他表达式进行运算，使用字符串形式描述。

```typescript
const x = variable<number>();
const y = variable<number>();

// 简单表达式
const sum = expr({ x, y })("x + y");

// 复杂表达式（可以使用 JS 语言特性）
const abs = expr({ x })("Math.abs(x)");
const conditional = expr({ x, y })("x > y ? x : y");
const array = expr({ x, y })("[x, y].filter(v => v > 0)");
```

### CompiledData（编译数据）

编译后的表达式为 JSON 数组格式：

```typescript
// 格式: [variableNames, expression1, expression2, ...]
// 其中 $N 用于引用之前的变量或表达式

const compiled = compile(result, { x, y });
// [["x", "y"], "$[0]+$[1]", "$[0]*$[1]", "$[2]+$[3]"]
```

## API 参考

### `variable<T>(): Variable<T>`

创建一个类型化变量。

**参数：** 无（类型通过泛型参数 `T` 指定）

**返回值：** Variable 对象，支持属性访问和方法调用

**示例：**

```typescript
const num = variable<number>();
const str = variable<string>();
const config = variable<{ timeout: number }>();

// 支持链式属性访问
const timeout = config.timeout; // 自动转换为表达式
```

### `expr<TContext>(context: TContext): (source: string) => Expression<TContext, TResult>`

创建表达式，采用柯里化设计以支持完整的类型推导。

**参数：**

- `context` - 上下文对象，包含变量和/或其他表达式的映射

**返回值：** 函数，接收表达式源码字符串并返回 Expression 对象

**示例：**

```typescript
const x = variable<number>();
const y = variable<number>();

const sum = expr({ x, y })("x + y");
const result = expr({ sum, x })("sum * x");
```

### `compile<TResult>(expression: Expression<any, TResult>, variables: Record<string, Variable<any>> | Variable<any>[], options?: CompileOptions): CompiledData`

将表达式树编译为可序列化的 JSON 结构。

**参数：**

- `expression` - 要编译的表达式
- `variables` - 表达式中使用的所有变量映射或数组
- `options` - 编译选项（可选）
  - `inline?: boolean` - 是否启用内联优化，将只被引用一次的子表达式内联到使用位置（默认：true）

**返回值：** CompiledData 数组

**示例：**

```typescript
const x = variable<number>();
const y = variable<number>();
const sum = expr({ x, y })("x + y");
const product = expr({ x, y })("x * y");
const result = expr({ sum, product })("sum + product");

const compiled = compile(result, { x, y });
// [["x", "y"], "$[0]+$[1]", "$[0]*$[1]", "$[2]+$[3]"]

// 禁用内联优化
const noInline = compile(result, { x, y }, { inline: false });
// [["x", "y"], "$[0]+$[1]", "$[0]*$[1]", "$[2]+$[3]"]
```

### `evaluate<TResult>(data: CompiledData, values: Record<string, unknown>): TResult`

执行编译后的表达式。

**参数：**

- `data` - 编译后的表达式数据
- `values` - 变量值映射，对应编译数据中的变量名顺序

**返回值：** 表达式计算结果

**示例：**

```typescript
const x = variable<number>();
const y = variable<number>();
const sum = expr({ x, y })("x + y");
const product = expr({ x, y })("x * y");
const result = expr({ sum, product })("sum + product");

const compiled = compile(result, { x, y });
const value = evaluate(compiled, { x: 5, y: 3 });
// => 23  ((5+3) + (5*3) = 8 + 15 = 23)
```

### `t(strings: TemplateStringsArray, ...values: unknown[]): Proxify<string>`

使用标签模板函数创建包含变量的字符串表达式。

**参数：**

- `strings` - 模板字符串的静态部分
- `values` - 模板中插值的变量和表达式

**返回值：** 字符串类型的 Proxy Expression

**示例：**

```typescript
const name = variable<string>();
const count = variable<number>();

const greeting = t`Hello, ${name}!`;
const message = t`You have ${count} items.`;

const compiled = compile(greeting, { name });
const result = evaluate(compiled, { name: "Alice" });
// => "Hello, Alice!"
```

### `lambda<Args, R>(builder: LambdaBuilder<Args, R>): Lambda<Args, R>`

创建类型安全的 lambda 表达式，用于数组方法（map、filter、reduce 等）。

**参数：**

- `builder` - Lambda 构建函数，接收参数代理，返回函数体表达式

**返回值：** Lambda 表达式，可在数组方法中使用

**示例：**

```typescript
import { lambda } from "@codehz/json-expr";

// 单参数 lambda
const numbers = variable<number[]>();
const doubled = numbers.map(lambda<[number], number>((n) => expr({ n })("n * 2")));

const compiled = compile(doubled, { numbers });
const result = evaluate(compiled, { numbers: [1, 2, 3] });
// => [2, 4, 6]

// 多参数 lambda（reduce）
const sum = numbers.reduce(
  lambda<[number, number], number>((acc, val) => expr({ acc, val })("acc + val")),
  0
);

// 捕获外部变量
const multiplier = variable<number>();
const scaled = numbers.map(lambda<[number], number>((n) => expr({ n, multiplier })("n * multiplier")));
```

### `wrap<T>(value: T): Proxify<T>`

将静态值包装为 Proxy Expression，使其可以像 Variable 一样调用方法和访问属性。

**参数：**

- `value` - 要包装的静态值（支持原始值、对象、数组、Date、RegExp、BigInt、URL、Map、Set、TypedArray 等）

**返回值：** Proxy Expression，可以继续链式调用

**示例：**

```typescript
// 包装 RegExp
const pattern = wrap(/^[a-z]+$/i);
const input = variable<string>();
const isValid = pattern.test(input);

const compiled = compile(isValid, { input });
evaluate(compiled, { input: "hello" }); // => true
evaluate(compiled, { input: "hello123" }); // => false

// 包装 Date
const now = wrap(new Date("2024-01-01"));
const year = now.getFullYear();

// 包装数组
const staticNumbers = wrap([1, 2, 3, 4, 5]);
const x = variable<number>();
const doubled = staticNumbers.map(lambda((n: number) => expr({ n, x })("n * x")));

// 包装对象
const config = wrap({ port: 8080, host: "localhost" });
const port = config.port; // 直接访问属性

// 包装 Map
const map = wrap(
  new Map([
    ["a", 1],
    ["b", 2],
  ])
);
const key = variable<string>();
const value = map.get(key);

// 链式调用
const text = wrap("  hello world  ");
const result = text.trim().toUpperCase().replace("HELLO", "HI");
// => "HI WORLD"
```

## 高级用法

### 包装静态值（wrap）

`wrap()` 函数可以将任意静态值转换为 Proxy Expression，使其可以像 Variable 一样调用方法和访问属性。这在需要对常量值执行操作时非常有用。

**基本用法：**

```typescript
// 不使用 wrap（传统方式）
interface Validator {
  match(text: string, pattern: RegExp): boolean;
}
const validator = variable<Validator>();
const result = validator.match("hello", /^[a-z]+$/i);

// 使用 wrap（推荐方式）
const pattern = wrap(/^[a-z]+$/i);
const input = variable<string>();
const result = pattern.test(input);
```

**支持的类型：**

```typescript
// 原始值
const num = wrap(42);
const str = wrap("hello");
const bool = wrap(true);

// Date 和 RegExp
const date = wrap(new Date("2024-01-01"));
const year = date.getFullYear();

const regex = wrap(/\d+/g);
const text = variable<string>();
const matches = text.match(regex);

// BigInt
const bigNum = wrap(123456789n);
const x = variable<bigint>();
const sum = expr({ bigNum, x })("bigNum + x");

// URL
const url = wrap(new URL("https://example.com/path"));
const host = url.hostname;
const port = url.port;

// Map 和 Set
const map = wrap(
  new Map([
    ["key1", 100],
    ["key2", 200],
  ])
);
const key = variable<string>();
const value = map.get(key);

const set = wrap(new Set([1, 2, 3]));
const num = variable<number>();
const has = set.has(num);

// TypedArray
const arr = wrap(new Uint8Array([10, 20, 30]));
const index = variable<number>();
const value = expr({ arr, index })("arr[index]");

// 数组和对象
const numbers = wrap([1, 2, 3, 4, 5]);
const multiplier = variable<number>();
const scaled = numbers.map(lambda((n: number) => expr({ n, multiplier })("n * multiplier")));

const config = wrap({ port: 8080, host: "localhost" });
const port = config.port;
```

**链式调用：**

```typescript
const text = wrap("  Hello, World!  ");
const result = text.trim().toLowerCase().replace("world", "universe");
// => "hello, universe!"
```

**与 variable 结合：**

```typescript
const staticData = wrap({ users: ["alice", "bob", "charlie"] });
const index = variable<number>();
const username = expr({ staticData, index })("staticData.users[index]");

const compiled = compile(username, { index });
evaluate(compiled, { index: 1 }); // => "bob"
```

### Proxy 变量系统

`variable()` 创建的变量是 Proxy 对象，支持链式属性访问和方法调用，所有操作都会自动转换为表达式。

**属性访问：**

```typescript
const config = variable<{
  timeout: number;
  retries: number;
  database: {
    host: string;
    port: number;
  };
}>();

// 链式属性访问
const timeout = config.timeout; // 自动转换为表达式
const dbHost = config.database.host; // 支持嵌套访问

const compiled = compile(timeout, { config });
const result = evaluate(compiled, {
  config: { timeout: 5000, retries: 3, database: { host: "localhost", port: 5432 } },
});
// => 5000
```

**方法调用：**

```typescript
const calculator = variable<{
  add(a: number, b: number): number;
  multiply(x: number, y: number): number;
}>();

// 方法调用
const sum = calculator.add(1, 2);
const product = calculator.multiply(5, 3);

// 链式方法调用
const builder = variable<{
  setName(name: string): typeof builder;
  build(): { name: string };
}>();
const result = builder.setName("test").build();

// 编译并执行
const compiled = compile(sum, { calculator });
const value = evaluate(compiled, {
  calculator: {
    add: (a, b) => a + b,
    multiply: (x, y) => x * y,
  },
});
// => 3
```

**数组方法：**

数组变量支持所有标准数组方法，并自动处理类型推导：

```typescript
const numbers = variable<number[]>();
const users = variable<{ id: number; name: string }[]>();

// map
const doubled = numbers.map((n) => expr({ n })("n * 2"));

// filter
const activeUsers = users.filter((u) => expr({ u })("u.active"));

// reduce
const sum = numbers.reduce(
  lambda<[number, number], number>((acc, val) => expr({ acc, val })("acc + val")),
  0
);

// find, some, every, sort 等
const firstMatch = users.find((u) => expr({ u })("u.id === 1"));
const hasAdmins = users.some((u) => expr({ u })("u.role === 'admin'"));
const allActive = users.every((u) => expr({ u })("u.active"));
const sorted = numbers.toSorted(lambda<[number, number], number>((a, b) => expr({ a, b })("a - b")));
```

### 内置全局对象

表达式中可以直接使用以下内置对象（无需在上下文中定义）：

- `Math`, `JSON`, `Date`, `RegExp`
- `Number`, `String`, `Boolean`, `Array`, `Object`
- `undefined`, `NaN`, `Infinity`
- `isNaN`, `isFinite`, `parseInt`, `parseFloat`

```typescript
const x = variable<number>();

const sqrtExpr = expr({ x })("Math.sqrt(x)");
const compiled = compile(sqrtExpr, { x });
const result = evaluate(compiled, { x: 16 });
// => 4
```

### 支持的运算符和语法

**算术运算符：**

- `+`, `-`, `*`, `/`, `%`, `**` (幂运算)

**比较运算符：**

- `==`, `===`, `!=`, `!==`, `<`, `>`, `<=`, `>=`

**逻辑运算符：**

- `&&`, `||`, `!`, `??` (空值合并)

**位运算符：**

- `&`, `|`, `^`, `~`, `<<`, `>>`, `>>>`

**其他运算符：**

- `? :` (三元表达式)
- `in` (属性存在检查)
- `instanceof` (类型检查)
- `typeof` (类型检测)
- `?.` (可选链)
- `?.()` (可选调用)
- `?.[]` (可选元素访问)

**语法特性：**

- 对象字面量：`{ key: value, ... }`
- 数组字面量：`[element1, element2, ...]`
- 箭头函数：`(param) => expression`
- 函数调用：`func(arg1, arg2, ...)`
- 成员访问：`obj.prop`, `obj["prop"]`, `arr[0]`
- 模板字面量（通过 `t` 标签函数）
- 分组括号：`(expression)`

### 条件表达式

```typescript
const score = variable<number>();
const gradeExpr = expr({ score })("score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'F'");

const compiled = compile(gradeExpr, { score });
const grade = evaluate(compiled, { score: 85 });
// => "B"
```

### 数组和对象操作

```typescript
const numbers = variable<number[]>();

const sumExpr = expr({ numbers })("numbers.reduce((a, b) => a + b, 0)");

const compiled = compile(sumExpr, { numbers });
const sum = evaluate(compiled, { numbers: [1, 2, 3, 4, 5] });
// => 15
```

### 链式表达式组合

```typescript
const a = variable<number>();
const b = variable<number>();

const sum = expr({ a, b })("a + b");
const product = expr({ a, b })("a * b");
const difference = expr({ a, b })("a - b");

const complex = expr({ sum, product, difference })("sum * product - difference");

const compiled = compile(complex, { a, b });
const result = evaluate(compiled, { a: 2, b: 3 });
// => (2+3) * (2*3) - (2-3) = 5 * 6 - (-1) = 30 + 1 = 31
```

### 短路求值（控制流优化）

编译器支持为 `&&`、`||`、`??` 和三元表达式生成短路求值代码，避免不必要的计算：

```typescript
const a = variable<boolean>();
const b = variable<boolean>();

// 逻辑或短路
const orExpr = expr({ a, b })("a || b");
const compiled = compile(orExpr, { a, b });

// 当 a 为 true 时，b 不会被求值
// 编译数据包含控制流节点：
// [["a", "b"], ["br", "$[0]", 1], "$[1]", ["phi"]]

// 空值合并
const x = variable<number | null>();
const y = variable<number>();
const coalesce = expr({ x, y })("x ?? y");

// 三元表达式
const condition = variable<boolean>();
const result = variable<number>();
const alternative = variable<number>();
const ternary = expr({ condition, result, alternative })("condition ? result : alternative");
```

### 自动内联优化

编译器自动将只被引用一次的子表达式内联到使用位置，减少中间计算：

```typescript
const x = variable<number>();
const y = variable<number>();

const sum = expr({ x, y })("x + y");
const product = expr({ x, y })("x * y");
const result = expr({ sum, product })("sum + product");

// 自动内联后，编译结果为：
// [["x", "y"], "($[0]+$[1])+($[0]*$[1])"]
// 而不是 [["x", "y"], "$[0]+$[1]", "$[0]*$[1]", "$[2]+$[3]"]

const compiled = compile(result, { x, y });
const value = evaluate(compiled, { x: 2, y: 3 });
// => 11
```

### 直接编译对象和数组

`compile` 函数支持直接编译包含 Proxy 的对象和数组：

```typescript
const x = variable<number>();
const y = variable<number>();
const sum = expr({ x, y })("x + y");

// 编译对象
const objCompiled = compile({ result: sum, original: { x, y } }, { x, y });
const objResult = evaluate(objCompiled, { x: 10, y: 20 });
// => { result: 30, original: { x: 10, y: 20 } }

// 编译数组
const arrCompiled = compile([x, sum, 100], { x, y });
const arrResult = evaluate(arrCompiled, { x: 5, y: 3 });
// => [5, 8, 100]
```

## 序列化和传输

编译后的数据可以轻松进行 JSON 序列化，适合网络传输或持久化存储：

```typescript
// 编译表达式
const compiled = compile(result, { x, y });

// 序列化
const json = JSON.stringify(compiled);
// "[["x","y"],"$[0]+$[1]","$[0]*$[1]","$[2]+$[3]"]"

// 存储或传输...

// 反序列化
const deserialized = JSON.parse(json);

// 执行
const value = evaluate(deserialized, { x: 5, y: 3 });
```

## 编译数据格式

### V1 格式（基础表达式）

基础格式为 JSON 数组：`[variableNames, ...expressions]`

```typescript
// 输入
const sum = expr({ x, y })("x + y");
const compiled = compile(sum, { x, y });

// 输出
// [["x", "y"], "$[0]+$[1]"]
//  $[0] 引用 x，$[1] 引用 y
```

### V2 格式（控制流节点）

启用短路求值时，生成包含控制流节点的格式：

```typescript
// 输入
const result = expr({ a, b })("a || b");
const compiled = compile(result, { a, b });

// 输出
// [
//   ["a", "b"],
//   ["br", "$[0]", 1],  // 如果 $[0] 为 truthy，跳过 1 条指令
//   "$[1]",             // 否则求值 $[1]
//   ["phi"]           // 取最近求值结果
// ]
```

**控制流节点类型：**

- `["br", condition, offset]` - 条件跳转，条件为真时跳过 offset 条指令
- `["jmp", offset]` - 无条件跳转，跳过 offset 条指令
- `["phi"]` - 取最近求值结果（用于合并分支）

## 错误处理

### 编译时错误

编译器会检测并报告以下错误：

```typescript
const x = variable<number>();
const y = variable<number>();

// 错误：引用未定义的变量
const invalid = expr({ x, y })("x + y + z");
compile(invalid, { x, y });
// => Error: Undefined variable(s): z

// 错误：变量名冲突
const xy = variable<number>();
const conflict = expr({ xy, x })("xy + x");
// 正确处理：编译器能区分 xy 和 x
const compiled = compile(conflict, { xy, x });
// => [["xy", "x"], "$[0]+$[1]"]
```

### 运行时错误

求值器会验证输入并报告运行时错误：

```typescript
const x = variable<number>();
const y = variable<number>();

const sum = expr({ x, y })("x + y");
const compiled = compile(sum, { x, y });

// 错误：缺少必需变量
evaluate(compiled, { x: 2 });
// => Error: Missing required variable: y

// 错误：无效的编译数据
evaluate([], { x: 1 });
// => Error: Invalid compiled data: must have at least variable names
```

## 类型安全

项目充分利用 TypeScript 的类型系统进行编译时检查和类型推导：

```typescript
const x = variable<number>();
const y = variable<string>();

// 类型错误会在编译时捕获
// const invalid = expr({ x, y })("z + y"); // Error: 'z' not in context
const valid = expr({ x })("-x"); // 编译器推导为 number
```

## 实际应用示例

### 动态表单验证规则

```typescript
const formData = variable<{
  username: string;
  password: string;
  confirmPassword: string;
  age: number;
}>();

// 创建验证规则表达式
const isUsernameValid = expr({ formData })("formData.username.length >= 3 && formData.username.length <= 20");

const isPasswordValid = expr({ formData })("formData.password.length >= 8 && /[A-Z]/.test(formData.password)");

const doPasswordsMatch = expr({ formData })("formData.password === formData.confirmPassword");

const isAgeValid = expr({ formData })("formData.age >= 18 && formData.age <= 120");

const isFormValid = expr({
  isUsernameValid,
  isPasswordValid,
  doPasswordsMatch,
  isAgeValid,
})("isUsernameValid && isPasswordValid && doPasswordsMatch && isAgeValid");

// 编译一次，多次执行
const compiled = compile(isFormValid, { formData });

// 在表单输入时实时验证
evaluate(compiled, {
  formData: {
    username: "john_doe",
    password: "Secure123",
    confirmPassword: "Secure123",
    age: 25,
  },
}); // => true
```

### 数据转换管道

```typescript
const rawData = variable<any[]>();
const config = variable<{
  minValue: number;
  maxValue: number;
  transform: (x: number) => number;
}>();

// 构建数据处理管道
const filtered = rawData.filter(
  lambda<[any], boolean>((item) =>
    expr({ item, config })("item.value >= config.minValue && item.value <= config.maxValue")
  )
);

const transformed = filtered.map(
  lambda<[any], number>((item) => expr({ item, config })("config.transform(item.value)"))
);

const sorted = transformed.toSorted(lambda<[number, number], number>((a, b) => expr({ a, b })("a - b")));

const pipeline = compile(sorted, { rawData, config });

// 执行数据处理
const result = evaluate(pipeline, {
  rawData: [{ value: 10 }, { value: 5 }, { value: 20 }, { value: 15 }],
  config: { minValue: 8, maxValue: 18, transform: (x: number) => x * 2 },
});
// => [10, 20, 30] (5 被过滤，10*2=20, 15*2=30, 20 被过滤)
```

### 规则引擎

```typescript
// 定义规则条件
const user = variable<{
  age: number;
  role: string;
  balance: number;
}>();

const isEligible = expr({ user })(
  "(user.age >= 18 && user.age <= 65) && (user.role === 'premium' || user.balance > 10000)"
);

const discountRate = expr({ user, isEligible })("isEligible ? (user.role === 'premium' ? 0.2 : 0.1) : 0");

const rule = compile(discountRate, { user });

// 应用规则
const discount = evaluate(rule, {
  user: { age: 30, role: "premium", balance: 5000 },
});
// => 0.2 (20% 折扣)
```

## 性能考虑

- **编译时间**：编译过程涉及依赖分析和拓扑排序，通常快速完成
- **执行时间**：表达式通过 `new Function()` 编译为原生 JavaScript，执行性能接近原生代码
- **内存占用**：编译数据为纯 JSON，占用空间小，适合在网络上传输
- **缓存机制**：求值器缓存已编译的函数，重复执行时性能更优

### 最佳实践

1. **编译一次，多次执行**：对于重复使用的表达式，先编译后多次求值

   ```typescript
   const compiled = compile(expression, variables);
   // 缓存 compiled，多次调用 evaluate
   evaluate(compiled, values1);
   evaluate(compiled, values2);
   ```

2. **利用短路求值**：短路求值已默认启用，对于条件表达式可以避免不必要的计算

3. **利用自动内联**：编译器会自动内联只引用一次的子表达式，无需手动优化

4. **优先使用 Proxy 链式调用**：对于对象属性访问，使用 `config.timeout` 比 `expr({ config })("config.timeout")` 更简洁且类型更安全

## 项目结构

```
src/
├── index.ts          # 导出入口
├── variable.ts       # variable<T>() 函数
├── expr.ts           # expr() 函数
├── template.ts       # t() 标签模板函数
├── lambda.ts         # lambda() 函数（数组方法支持）
├── compile.ts        # 编译器（内联优化、短路求值）
├── evaluate.ts       # 运行时求值
├── parser.ts         # 表达式 AST 解析器
├── type-parser.ts    # TypeScript 类型级表达式解析
├── proxy-variable.ts # Proxy 变量实现
├── proxy-metadata.ts # Proxy 元数据管理
└── types.ts          # 类型定义（Variable、Expression、Lambda 等）
```

## 开发

### 安装依赖

```bash
bun install
```

### 运行测试

```bash
bun test
```

### 代码检查

```bash
bun run lint
bun run type-check
```

### 代码格式化

```bash
bun run format
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
