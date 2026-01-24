// proxy-variable.ts
import type {
  ArrayExpr,
  ASTNode,
  BooleanLiteral,
  CallExpr,
  Identifier,
  MemberExpr,
  NullLiteral,
  NumberLiteral,
  ObjectExpr,
  StringLiteral,
} from "./parser";
import { getProxyMetadata, setProxyMetadata } from "./proxy-metadata";
import type { Proxify } from "./types";

/**
 * TypedArray 构造函数类型
 */
type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor;

/**
 * 使用 Symbol.description 生成占位符
 * 用于在表达式源码中标识变量
 */
function getVariablePlaceholder(id: symbol): string {
  return `$$VAR_${id.description}$$`;
}

/**
 * 序列化参数为 AST 节点
 * - Proxy Variable/Expression：使用 ast 或占位符标识符
 * - 数组：返回 ArrayExpr 节点
 * - 对象：返回 ObjectExpr 节点
 * - 原始值：返回对应的字面量节点
 * - Date, RegExp, BigInt, URL, URLSearchParams, Map, Set, TypedArray, DataView: 构造函数调用
 */
export function serializeArgumentToAST(arg: unknown): ASTNode {
  // 1. 检查是否是 Proxy (通过 getProxyMetadata)
  // 注意：Proxy 包装的是函数，所以 typeof 可能是 "function" 或 "object"
  if ((typeof arg === "object" || typeof arg === "function") && arg !== null) {
    const meta = getProxyMetadata(arg);
    if (meta) {
      // 如果有 ast，直接返回
      if (meta.ast) return meta.ast;
      // 否则是根 variable，返回占位符标识符
      if (meta.rootVariable) {
        return {
          type: "Identifier",
          name: getVariablePlaceholder(meta.rootVariable),
        } as Identifier;
      }
    }
  }

  // 2. 数组递归处理
  if (Array.isArray(arg)) {
    return {
      type: "ArrayExpr",
      elements: arg.map(serializeArgumentToAST),
    } as ArrayExpr;
  }

  // 3. 特殊内置对象类型
  if (typeof arg === "object" && arg !== null) {
    // Date: new Date(timestamp)
    if (arg instanceof Date) {
      return {
        type: "CallExpr",
        callee: { type: "Identifier", name: "Date" } as Identifier,
        arguments: [
          {
            type: "NumberLiteral",
            value: arg.getTime(),
            raw: String(arg.getTime()),
          } as NumberLiteral,
        ],
        optional: false,
      } as CallExpr;
    }

    // RegExp: new RegExp(source, flags)
    if (arg instanceof RegExp) {
      const args: ASTNode[] = [{ type: "StringLiteral", value: arg.source, quote: '"' } as StringLiteral];
      if (arg.flags) {
        args.push({ type: "StringLiteral", value: arg.flags, quote: '"' } as StringLiteral);
      }
      return {
        type: "CallExpr",
        callee: { type: "Identifier", name: "RegExp" } as Identifier,
        arguments: args,
        optional: false,
      } as CallExpr;
    }

    // URL: new URL(href)
    if (typeof URL !== "undefined" && arg instanceof URL) {
      return {
        type: "CallExpr",
        callee: { type: "Identifier", name: "URL" } as Identifier,
        arguments: [{ type: "StringLiteral", value: arg.href, quote: '"' } as StringLiteral],
        optional: false,
      } as CallExpr;
    }

    // URLSearchParams: new URLSearchParams(entries)
    if (typeof URLSearchParams !== "undefined" && arg instanceof URLSearchParams) {
      const entries: ASTNode[] = [];
      arg.forEach((value, key) => {
        entries.push({
          type: "ArrayExpr",
          elements: [
            { type: "StringLiteral", value: key, quote: '"' } as StringLiteral,
            { type: "StringLiteral", value, quote: '"' } as StringLiteral,
          ],
        } as ArrayExpr);
      });
      return {
        type: "CallExpr",
        callee: { type: "Identifier", name: "URLSearchParams" } as Identifier,
        arguments: [{ type: "ArrayExpr", elements: entries } as ArrayExpr],
        optional: false,
      } as CallExpr;
    }

    // Map: new Map(entries)
    if (arg instanceof Map) {
      const entries: ASTNode[] = [];
      arg.forEach((value, key) => {
        entries.push({
          type: "ArrayExpr",
          elements: [serializeArgumentToAST(key), serializeArgumentToAST(value)],
        } as ArrayExpr);
      });
      return {
        type: "CallExpr",
        callee: { type: "Identifier", name: "Map" } as Identifier,
        arguments: [{ type: "ArrayExpr", elements: entries } as ArrayExpr],
        optional: false,
      } as CallExpr;
    }

    // Set: new Set(values)
    if (arg instanceof Set) {
      const values: ASTNode[] = [];
      arg.forEach((value) => {
        values.push(serializeArgumentToAST(value));
      });
      return {
        type: "CallExpr",
        callee: { type: "Identifier", name: "Set" } as Identifier,
        arguments: [{ type: "ArrayExpr", elements: values } as ArrayExpr],
        optional: false,
      } as CallExpr;
    }

    // TypedArray: new Uint8Array([...])
    const typedArrayConstructors = [
      "Int8Array",
      "Uint8Array",
      "Uint8ClampedArray",
      "Int16Array",
      "Uint16Array",
      "Int32Array",
      "Uint32Array",
      "Float32Array",
      "Float64Array",
      "BigInt64Array",
      "BigUint64Array",
    ];

    for (const constructorName of typedArrayConstructors) {
      if (typeof globalThis[constructorName as keyof typeof globalThis] !== "undefined") {
        const Constructor = globalThis[constructorName as keyof typeof globalThis] as TypedArrayConstructor;
        if (arg instanceof Constructor) {
          // 使用扩展运算符处理 bigint 类型的 TypedArray
          const values = [...(arg as Iterable<unknown>)].map((val) => serializeArgumentToAST(val));
          return {
            type: "CallExpr",
            callee: { type: "Identifier", name: constructorName } as Identifier,
            arguments: [{ type: "ArrayExpr", elements: values } as ArrayExpr],
            optional: false,
          } as CallExpr;
        }
      }
    }

    // ArrayBuffer: new Uint8Array([...]).buffer
    if (arg instanceof ArrayBuffer) {
      const uint8Array = new Uint8Array(arg);
      const values = Array.from(uint8Array).map((val) => serializeArgumentToAST(val));
      return {
        type: "MemberExpr",
        object: {
          type: "CallExpr",
          callee: { type: "Identifier", name: "Uint8Array" } as Identifier,
          arguments: [{ type: "ArrayExpr", elements: values } as ArrayExpr],
          optional: false,
        } as CallExpr,
        property: { type: "Identifier", name: "buffer" } as Identifier,
        computed: false,
        optional: false,
      } as MemberExpr;
    }

    // DataView: new DataView(buffer)
    if (arg instanceof DataView) {
      const bufferAst = serializeArgumentToAST(arg.buffer);
      return {
        type: "CallExpr",
        callee: { type: "Identifier", name: "DataView" } as Identifier,
        arguments: [bufferAst],
        optional: false,
      } as CallExpr;
    }
  }

  // 4. 普通对象递归处理
  if (typeof arg === "object" && arg !== null) {
    const properties = Object.entries(arg).map(([k, v]) => {
      // 检查 key 是否为有效标识符
      const isValidIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k);
      const key: ASTNode = isValidIdentifier
        ? ({ type: "Identifier", name: k } as Identifier)
        : ({ type: "StringLiteral", value: k, quote: '"' } as StringLiteral);
      const value = serializeArgumentToAST(v);
      return {
        key,
        value,
        computed: false,
        shorthand: false,
      };
    });
    return {
      type: "ObjectExpr",
      properties,
    } as ObjectExpr;
  }

  // 5. 原始值（包括 null, undefined, number, string, boolean, bigint）
  if (arg === null) {
    return { type: "NullLiteral" } as NullLiteral;
  }
  if (arg === undefined) {
    return { type: "Identifier", name: "undefined" } as Identifier;
  }
  if (typeof arg === "boolean") {
    return { type: "BooleanLiteral", value: arg } as BooleanLiteral;
  }
  if (typeof arg === "number") {
    return { type: "NumberLiteral", value: arg, raw: String(arg) } as NumberLiteral;
  }
  if (typeof arg === "string") {
    return { type: "StringLiteral", value: arg, quote: '"' } as StringLiteral;
  }
  if (typeof arg === "bigint") {
    // BigInt: BigInt("123")
    return {
      type: "CallExpr",
      callee: { type: "Identifier", name: "BigInt" } as Identifier,
      arguments: [{ type: "StringLiteral", value: arg.toString(), quote: '"' } as StringLiteral],
      optional: false,
    } as CallExpr;
  }

  // 其他类型（symbol 等）暂不支持
  throw new Error(`Unsupported argument type: ${typeof arg}`);
}

/**
 * 从参数中收集依赖的 Symbol
 * 递归遍历数组和对象，收集所有 Proxy 的依赖
 */
export function collectDepsFromArgs(args: unknown[], deps: Set<symbol>): void {
  for (const arg of args) {
    // 注意：Proxy 包装的是函数，所以 typeof 可能是 "function" 或 "object"
    if ((typeof arg === "object" || typeof arg === "function") && arg !== null) {
      const meta = getProxyMetadata(arg);
      if (meta?.dependencies) {
        for (const dep of meta.dependencies) {
          deps.add(dep);
        }
      } else if (Array.isArray(arg)) {
        collectDepsFromArgs(arg, deps);
      } else if (typeof arg === "object") {
        collectDepsFromArgs(Object.values(arg), deps);
      }
    }
  }
}

/**
 * 创建根 Variable Proxy
 * 拦截属性访问，返回新的 expression proxy
 * 不可直接调用（apply 应该只在链式调用后可用）
 *
 * @param id - 变量的唯一标识 Symbol
 * @returns Proxy 包装的 Variable
 */
export function createProxyVariable<T>(id: symbol): Proxify<T> {
  const deps = new Set([id]);

  const proxy = new Proxy(function () {} as unknown as Proxify<T>, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      // 属性访问：创建 expression proxy
      return createProxyExpression<unknown>(id, [String(prop)], deps);
    },
    apply() {
      throw new Error("Variable cannot be called directly");
    },
  });

  setProxyMetadata(proxy, {
    type: "variable",
    path: [],
    rootVariable: id,
    dependencies: deps,
  });

  return proxy;
}

/**
 * 创建属性访问后的 Proxy
 * 继续拦截属性访问（链式访问）
 * 拦截 apply 进行方法调用
 *
 * @param rootId - 根变量的 Symbol
 * @param path - 属性访问路径
 * @param deps - 依赖集合
 * @returns Proxy 包装的 Expression
 */
export function createProxyExpression<T>(rootId: symbol, path: string[], deps: Set<symbol>): Proxify<T> {
  // 构建 MemberExpr AST 节点
  let ast: ASTNode = {
    type: "Identifier",
    name: getVariablePlaceholder(rootId),
  } as Identifier;

  for (const prop of path) {
    ast = {
      type: "MemberExpr",
      object: ast,
      property: { type: "Identifier", name: prop } as Identifier,
      computed: false,
      optional: false,
    } as MemberExpr;
  }

  const proxy = new Proxy(function () {} as unknown as Proxify<T>, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      return createProxyExpression<unknown>(rootId, [...path, String(prop)], deps);
    },
    apply(_target, _thisArg, args) {
      // 构建 CallExpr AST 节点
      const callAst: CallExpr = {
        type: "CallExpr",
        callee: ast,
        arguments: args.map(serializeArgumentToAST),
        optional: false,
      };
      // 收集参数中的依赖
      const newDeps = new Set(deps);
      collectDepsFromArgs(args, newDeps);
      return createProxyExpressionWithAST<T>(callAst, newDeps);
    },
  });

  setProxyMetadata(proxy, {
    type: "expression",
    path,
    rootVariable: rootId,
    ast,
    dependencies: deps,
  });

  return proxy;
}

/**
 * 创建带完整 AST 的 Proxy（方法调用后）
 * 可以继续链式访问和调用
 *
 * @param ast - 完整的表达式 AST
 * @param deps - 依赖集合
 * @returns Proxy 包装的 Expression
 */
export function createProxyExpressionWithAST<T>(ast: ASTNode, deps: Set<symbol>): Proxify<T> {
  const proxy = new Proxy(function () {} as unknown as Proxify<T>, {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      // 继续访问：创建新的 MemberExpr
      const newAst: MemberExpr = {
        type: "MemberExpr",
        object: ast,
        property: { type: "Identifier", name: String(prop) } as Identifier,
        computed: false,
        optional: false,
      };
      return createProxyExpressionWithAST<unknown>(newAst, deps);
    },
    apply(_target, _thisArg, args) {
      // 创建 CallExpr AST 节点
      const callAst: CallExpr = {
        type: "CallExpr",
        callee: ast,
        arguments: args.map(serializeArgumentToAST),
        optional: false,
      };
      const newDeps = new Set(deps);
      collectDepsFromArgs(args, newDeps);
      return createProxyExpressionWithAST<T>(callAst, newDeps);
    },
  });

  setProxyMetadata(proxy, {
    type: "expression",
    path: [], // AST 节点不再需要 path 信息
    ast,
    dependencies: deps,
  });

  return proxy;
}
