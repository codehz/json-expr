# @codehz/json-expr

一个可序列化为 JSON 的表达式 DSL 库，提供类型安全的表达式构建、编译和求值。

[![npm version](https://img.shields.io/npm/v/@codehz/json-expr.svg)](https://www.npmjs.com/package/@codehz/json-expr)

## 特性

- 🎯 **类型安全** - 使用 TypeScript 和 Zod 进行完整的类型推导和验证
- 📦 **可序列化** - 编译后的表达式为纯 JSON 格式，易于传输和存储
- 🔧 **灵活的表达式** - 支持任意 JavaScript 表达式，包括函数调用和对象属性访问
- ⚡ **高性能** - 使用 `new Function()` 进行优化执行
- 🧩 **可组合** - 表达式可以相互组合，形成复杂的计算树
- 🔐 **类型验证** - 运行时通过 Zod schema 进行数据验证

## 快速开始

### 安装

```bash
bun install @codehz/json-expr
```

### 基本用法

```typescript
import { z } from "zod";
import { variable, expr, compile, evaluate, constant } from "@codehz/json-expr";

// 定义类型化变量
const x = variable(z.number());
const y = variable(z.number());

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

变量是表达式中的占位符，通过 Zod schema 定义其类型和验证规则。

```typescript
const age = variable(z.number().int().min(0).max(150));
const name = variable(z.string().min(1));
const config = variable(
  z.object({
    debug: z.boolean(),
    timeout: z.number(),
  })
);
```

### Expression（表达式）

表达式对变量或其他表达式进行运算，使用字符串形式描述。

```typescript
const x = variable(z.number());
const y = variable(z.number());

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

### `constant<T>(value: T): Expression<{}, T>`

创建一个编译期常量表达式。这是 `expr({})(JSON.stringify(value))` 的快速路径，用于在表达式中嵌入静态值，避免在运行时传入或在多处重复编写。

**参数：**

- `value` - 要嵌入的常量值（必须是 JSON 可序列化的：string、number、boolean、null、数组或对象）

**返回值：** Expression 对象

**示例：**

```typescript
import { constant, expr, variable, compile, evaluate } from "@codehz/json-expr";
import { z } from "zod";

// 创建常量
const PI = constant(3.14159);
const config = constant({ maxRetries: 3, timeout: 5000 });

// 在表达式中使用常量
const radius = variable(z.number());
const area = expr({ PI, radius })("PI * radius * radius");

const compiled = compile(area, { radius });
const result = evaluate(compiled, { radius: 2 });
// => 12.56636
```

### `variable<T>(schema: T): Variable<T>`

创建一个类型化变量。

**参数：**

- `schema` - Zod schema，定义变量的类型和验证规则

**返回值：** Variable 对象

**示例：**

```typescript
const num = variable(z.number());
const str = variable(z.string());
const date = variable(z.date());
```

### `expr<TContext>(context: TContext): (source: string) => Expression<TContext, TResult>`

创建表达式，采用柯里化设计以支持完整的类型推导。

**参数：**

- `context` - 上下文对象，包含变量和/或其他表达式的映射

**返回值：** 函数，接收表达式源码字符串并返回 Expression 对象

**示例：**

```typescript
const x = variable(z.number());
const y = variable(z.number());

const sum = expr({ x, y })("x + y");
const result = expr({ sum, x })("sum * x");
```

### `compile<TResult>(expression: Expression<any, TResult>, variables: Record<string, Variable<any>>, options?: CompileOptions): CompiledData`

将表达式树编译为可序列化的 JSON 结构。

**参数：**

- `expression` - 要编译的表达式
- `variables` - 表达式中使用的所有变量映射
- `options` - 编译选项（可选）
  - `inline?: boolean` - 是否启用内联优化，将只被引用一次的子表达式内联到使用位置（默认：true）
  - `shortCircuit?: boolean` - 是否启用短路求值，为 &&, ||, ??, 和三元表达式生成控制流节点（默认：true）

**返回值：** CompiledData 数组

**示例：**

```typescript
const x = variable(z.number());
const y = variable(z.number());
const sum = expr({ x, y })("x + y");
const product = expr({ x, y })("x * y");
const result = expr({ sum, product })("sum + product");

const compiled = compile(result, { x, y });
// [["x", "y"], "($0+$1)", "($0*$1)", "$2+$3"]

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
const compiled = compile(result, { x, y });
const value = evaluate(compiled, { x: 5, y: 3 });
// => 23  ((5+3) + (5*3) = 8 + 15 = 23)
```

## 高级用法

### 传入对象和内置对象

支持在上下文中传入对象（如 Math）以在表达式中访问其属性和方法：

```typescript
const x = variable(z.number());

const sqrtExpr = expr({ x, Math: variable(z.any()) })("Math.sqrt(x)");
const compiled = compile(sqrtExpr, { x, Math: variable(z.any()) });
const result = evaluate(compiled, { x: 16, Math });
// => 4
```

### 条件表达式

```typescript
const score = variable(z.number());
const gradeExpr = expr({ score })("score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'F'");

const compiled = compile(gradeExpr, { score });
const grade = evaluate(compiled, { score: 85 });
// => "B"
```

### 数组和对象操作

```typescript
const numbers = variable(z.array(z.number()));

const sumExpr = expr({ numbers })("numbers.reduce((a, b) => a + b, 0)");

const compiled = compile(sumExpr, { numbers });
const sum = evaluate(compiled, { numbers: [1, 2, 3, 4, 5] });
// => 15
```

### 链式表达式组合

```typescript
const a = variable(z.number());
const b = variable(z.number());

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
const x = variable(z.number());
const y = variable(z.string());

// 提供完整的类型推导和自动补全
const sum = expr({ x, y })("x + y");
```

## 性能考虑

- **编译时间**：编译过程涉及依赖分析和拓扑排序，通常快速完成
- **执行时间**：表达式通过 `new Function()` 编译为原生 JavaScript，执行性能接近原生代码
- **内存占用**：编译数据为纯 JSON，占用空间小，适合在网络上传输

## 项目结构

```
src/
├── index.ts              # 导出入口
├── variable.ts           # variable 函数实现
├── expr.ts               # expr 函数实现
├── compile.ts            # compile 函数实现
├── evaluate.ts           # evaluate 函数实现
├── parser.ts             # 表达式解析器
├── type-parser.ts        # 类型解析器
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
