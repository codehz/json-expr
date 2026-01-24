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

## 快速开始

### 安装

```bash
bun install @codehz/json-expr
```

### 基本用法

```typescript
import { variable, expr, compile, evaluate } from "@codehz/json-expr";

// 定义类型化变量（使用 TypeScript 泛型）
const x = variable<number>();
const y = variable<number>();

// 构建表达式
const sum = expr({ x, y })("x + y");
const product = expr({ x, y })("x * y");
const result = expr({ sum, product })("sum + product");

// 编译表达式（可序列化为 JSON）
const compiled = compile(result, { x, y });
// => [["x", "y"], "$0+$1", "$0*$1", "$2+$3"]

// 执行编译后的表达式
const value = evaluate(compiled, { x: 2, y: 3 });
// => 11  (2+3 + 2*3 = 5 + 6 = 11)
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
// [["x", "y"], "$0+$1", "$0*$1", "$2+$3"]
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
  - `shortCircuit?: boolean` - 是否启用短路求值，为 &&, ||, ??, 和三元表达式生成控制流节点（默认：true）

**返回值：** CompiledData 数组

**示例：**

```typescript
const x = variable<number>();
const y = variable<number>();
const sum = expr({ x, y })("x + y");
const product = expr({ x, y })("x * y");
const result = expr({ sum, product })("sum + product");

const compiled = compile(result, { x, y });
// [["x", "y"], "$0+$1", "$0*$1", "$2+$3"]

// 禁用内联优化
const noInline = compile(result, { x, y }, { inline: false });
// [["x", "y"], "$0+$1", "$0*$1", "$2+$3"]

// 禁用短路求值
const noShortCircuit = compile(result, { x, y }, { shortCircuit: false });
// 生成的表达式将使用直接的运算符而非控制流节点
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

## 高级用法

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

## 序列化和传输

编译后的数据可以轻松进行 JSON 序列化，适合网络传输或持久化存储：

```typescript
// 编译表达式
const compiled = compile(result, { x, y });

// 序列化
const json = JSON.stringify(compiled);
// "[["x","y"],"$0+$1","$0*$1","$2+$3"]"

// 存储或传输...

// 反序列化
const deserialized = JSON.parse(json);

// 执行
const value = evaluate(deserialized, { x: 5, y: 3 });
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

## 性能考虑

- **编译时间**：编译过程涉及依赖分析和拓扑排序，通常快速完成
- **执行时间**：表达式通过 `new Function()` 编译为原生 JavaScript，执行性能接近原生代码
- **内存占用**：编译数据为纯 JSON，占用空间小，适合在网络上传输

## 项目结构

```
src/
├── index.ts              # 导出入口
├── variable.ts           # variable<T>() 函数
├── expr.ts               # expr() 函数
├── template.ts           # t() 标签模板函数
├── compile.ts            # 编译器（内联优化、短路求值）
├── evaluate.ts           # 运行时求值
├── parser.ts             # 表达式 AST 解析器
├── type-parser.ts        # TypeScript 类型级表达式解析
├── proxy-variable.ts     # Proxy 变量实现
├── proxy-metadata.ts     # Proxy 元数据管理
├── types.ts              # 类型定义
└── *.test.ts             # 测试文件
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
