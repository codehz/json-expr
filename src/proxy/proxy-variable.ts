// proxy-variable.ts
import type { Proxify } from "../types";
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
  Placeholder,
  StringLiteral,
} from "../types/ast-types";
import { getProxyMetadata, setProxyMetadata } from "./proxy-metadata";

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

/**
 * 创建占位符 AST 节点
 */
function placeholder(id: symbol): Placeholder {
  return { type: "Placeholder", id };
}

/**
 * 创建标识符 AST 节点
 */
function identifier(name: string): Identifier {
  return { type: "Identifier", name };
}

/**
 * 创建数字字面量 AST 节点
 */
function numberLiteral(value: number): NumberLiteral {
  return { type: "NumberLiteral", value, raw: String(value) };
}

/**
 * 创建字符串字面量 AST 节点
 */
function stringLiteral(value: string, quote: "'" | '"' | "`" = '"'): StringLiteral {
  return { type: "StringLiteral", value, quote };
}

/**
 * 创建成员表达式 AST 节点
 */
function memberExpr(object: ASTNode, property: Identifier): MemberExpr {
  return { type: "MemberExpr", object, property, computed: false, optional: false };
}

/**
 * 创建调用表达式 AST 节点
 */
function callExpr(callee: ASTNode, arguments_: ASTNode[]): CallExpr {
  return { type: "CallExpr", callee, arguments: arguments_, optional: false };
}

/**
 * 创建数组表达式 AST 节点
 */
function arrayExpr(elements: ASTNode[]): ArrayExpr {
  return { type: "ArrayExpr", elements };
}

/**
 * 检查对象是否为 TypedArray 实例
 */
function getTypedArrayConstructor(value: unknown): TypedArrayConstructor | null {
  for (const constructorName of typedArrayConstructors) {
    const Constructor = globalThis[constructorName as keyof typeof globalThis] as TypedArrayConstructor;
    if (Constructor && value instanceof Constructor) {
      return Constructor;
    }
  }
  return null;
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
      // 否则是根 variable，返回占位符节点
      if (meta.rootVariable) {
        return placeholder(meta.rootVariable);
      }
    }
  }

  // 2. 数组递归处理
  if (Array.isArray(arg)) {
    return arrayExpr(arg.map(serializeArgumentToAST));
  }

  // 3. 特殊内置对象类型
  if (typeof arg === "object" && arg !== null) {
    // Date: new Date(timestamp)
    if (arg instanceof Date) {
      return callExpr(identifier("Date"), [numberLiteral(arg.getTime())]);
    }

    // RegExp: new RegExp(source, flags)
    if (arg instanceof RegExp) {
      const args = [stringLiteral(arg.source)];
      if (arg.flags) args.push(stringLiteral(arg.flags));
      return callExpr(identifier("RegExp"), args);
    }

    // URL: new URL(href)
    if (typeof URL !== "undefined" && arg instanceof URL) {
      return callExpr(identifier("URL"), [stringLiteral(arg.href)]);
    }

    // URLSearchParams: new URLSearchParams(entries)
    if (typeof URLSearchParams !== "undefined" && arg instanceof URLSearchParams) {
      const entries: ASTNode[] = [];
      arg.forEach((value, key) => {
        entries.push(arrayExpr([stringLiteral(key), stringLiteral(value)]));
      });
      return callExpr(identifier("URLSearchParams"), [arrayExpr(entries)]);
    }

    // Map: new Map(entries)
    if (arg instanceof Map) {
      const entries: ASTNode[] = [];
      arg.forEach((value, key) => {
        entries.push(arrayExpr([serializeArgumentToAST(key), serializeArgumentToAST(value)]));
      });
      return callExpr(identifier("Map"), [arrayExpr(entries)]);
    }

    // Set: new Set(values)
    if (arg instanceof Set) {
      const values: ASTNode[] = [];
      arg.forEach((value) => values.push(serializeArgumentToAST(value)));
      return callExpr(identifier("Set"), [arrayExpr(values)]);
    }

    // TypedArray: new Uint8Array([...])
    const typedArrayConstructor = getTypedArrayConstructor(arg);
    if (typedArrayConstructor) {
      const values = [...(arg as Iterable<unknown>)].map(serializeArgumentToAST);
      const constructorName = typedArrayConstructor.name;
      return callExpr(identifier(constructorName), [arrayExpr(values)]);
    }

    // ArrayBuffer: new Uint8Array([...]).buffer
    if (arg instanceof ArrayBuffer) {
      const uint8Array = new Uint8Array(arg);
      const values = Array.from(uint8Array).map(numberLiteral);
      return memberExpr(callExpr(identifier("Uint8Array"), [arrayExpr(values)]), identifier("buffer"));
    }

    // DataView: new DataView(buffer)
    if (arg instanceof DataView) {
      return callExpr(identifier("DataView"), [serializeArgumentToAST(arg.buffer)]);
    }

    // 普通对象递归处理
    const properties = Object.entries(arg).map(([k, v]) => {
      const isValidIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k);
      const key: ASTNode = isValidIdentifier ? identifier(k) : stringLiteral(k);
      return { key, value: serializeArgumentToAST(v), computed: false, shorthand: false };
    });
    return { type: "ObjectExpr", properties } as ObjectExpr;
  }

  // 4. 原始值
  if (arg === null) return { type: "NullLiteral" } as NullLiteral;
  if (arg === undefined) return identifier("undefined");
  if (typeof arg === "boolean") return { type: "BooleanLiteral", value: arg } as BooleanLiteral;
  if (typeof arg === "number") return numberLiteral(arg);
  if (typeof arg === "string") return stringLiteral(arg);
  if (typeof arg === "bigint") return callExpr(identifier("BigInt"), [stringLiteral(arg.toString())]);

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
 * 创建 Proxy 的公共 handler
 */
function createProxyHandler<T>(ast: ASTNode, deps: Set<symbol>): ProxyHandler<Proxify<T>> {
  return {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      const newAst = memberExpr(ast, identifier(String(prop)));
      return createProxyExpressionWithAST<unknown>(newAst, deps);
    },
    apply(_target, _thisArg, args) {
      const callAst = callExpr(ast, args.map(serializeArgumentToAST));
      const newDeps = new Set(deps);
      collectDepsFromArgs(args, newDeps);
      return createProxyExpressionWithAST<T>(callAst, newDeps);
    },
  };
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
  const ast = placeholder(id);

  const proxy = new Proxy(function () {} as unknown as Proxify<T>, createProxyHandler<T>(ast, deps));

  setProxyMetadata(proxy, {
    type: "variable",
    rootVariable: id,
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
export function createProxyExpressionWithAST<T>(
  ast: ASTNode,
  deps: Set<symbol>,
  deferredAsts?: Map<string, ASTNode>
): Proxify<T> {
  const proxy = new Proxy(function () {} as unknown as Proxify<T>, createProxyHandler<T>(ast, deps));

  setProxyMetadata(proxy, {
    type: "expression",
    ast,
    dependencies: deps,
    deferredAsts,
  });

  return proxy;
}
