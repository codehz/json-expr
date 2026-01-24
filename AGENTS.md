# json-expr

一个可序列化为 JSON 的表达式 DSL 库，提供类型安全的表达式构建、编译和求值。

## 项目概览

- **类型安全** - 使用 TypeScript 泛型进行完整的类型推导
- **可序列化** - 编译后的表达式为纯 JSON 格式
- **短路求值** - 支持 `&&`、`||`、`??` 和三元表达式的控制流优化
- **内联优化** - 自动内联只被引用一次的子表达式

## 核心 API

```typescript
import { variable, expr, constant, compile, evaluate, t } from "@codehz/json-expr";

// 定义类型化变量（使用 TypeScript 泛型，无需 Zod）
const x = variable<number>();
const y = variable<number>();

// 构建表达式
const sum = expr({ x, y })("x + y");
const result = expr({ sum, x })("sum * x");

// 使用常量
const PI = constant(3.14159);

// 使用模板字符串
const name = variable<string>();
const greeting = t`Hello, ${name}!`;

// 编译并执行
const compiled = compile(result, { x, y });
const value = evaluate(compiled, { x: 2, y: 3 }); // => 10
```

## 项目结构

```
src/
├── index.ts              # 导出入口
├── variable.ts           # variable<T>() 函数
├── expr.ts               # expr() 函数
├── constant.ts           # constant() 函数 - 创建编译期常量表达式
├── template.ts           # t() 标签模板函数 - 支持模板字符串插值
├── compile.ts            # 编译器（内联优化、短路求值）
├── evaluate.ts           # 运行时求值
├── parser.ts             # 表达式 AST 解析器
├── type-parser.ts        # TypeScript 类型级表达式解析
├── proxy-variable.ts     # Proxy 变量实现 - 支持属性访问和方法调用
├── proxy-metadata.ts     # Proxy 元数据管理
├── types.ts              # 类型定义（Variable、Expression、ControlFlowNode 等）
└── *.test.ts             # 测试文件
```

## 编译数据格式

编译后的数据为 JSON 数组：`[variableNames, ...expressions]`

- 变量用 `$N` 引用（N 为索引）
- 支持控制流节点：
  - `["br", condition, offset]` - 条件跳转
  - `["jmp", offset]` - 无条件跳转
  - `["phi"]` - 取最近求值结果

## 允许的全局对象

表达式中可直接使用以下全局对象（无需在上下文中定义）：

- `Math`, `JSON`, `Date`, `RegExp`
- `Number`, `String`, `Boolean`, `Array`, `Object`
- `undefined`, `NaN`, `Infinity`
- `isNaN`, `isFinite`, `parseInt`, `parseFloat`

---

## 开发环境

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## 常用命令

- `bun test` - 运行测试
- `bun run build` - 构建（使用 tsdown）
- `bun run lint` - ESLint 检查
- `bun run lint:fix` - ESLint 自动修复
- `bun run format` - Prettier 格式化
- `bun run type-check` - TypeScript 类型检查
