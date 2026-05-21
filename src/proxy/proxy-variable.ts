// proxy-variable.ts
import type { Proxify } from "../types";
import type {
  ArrayExpr,
  ASTNode,
  CallExpr,
  Identifier,
  MemberExpr,
  NumberLiteral,
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

interface SerializedArgument {
  ast: ASTNode;
  deps: ReadonlySet<symbol>;
  deferredAsts?: ReadonlyMap<string, ASTNode>;
}

const EMPTY_DEPS: ReadonlySet<symbol> = new Set<symbol>();

function leaf(ast: ASTNode): SerializedArgument {
  return { ast, deps: EMPTY_DEPS };
}

function accumulate(
  child: SerializedArgument,
  deps: Set<symbol>,
  deferredAsts: Map<string, ASTNode> | undefined
): Map<string, ASTNode> | undefined {
  for (const dep of child.deps) deps.add(dep);
  if (child.deferredAsts) {
    if (!deferredAsts) deferredAsts = new Map<string, ASTNode>();
    for (const [name, ast] of child.deferredAsts) deferredAsts.set(name, ast);
  }
  return deferredAsts;
}

function serializeWithMetadata(arg: unknown): SerializedArgument {
  if ((typeof arg === "object" || typeof arg === "function") && arg !== null) {
    const meta = getProxyMetadata(arg);
    if (meta) {
      const deps = new Set(meta.dependencies ?? []);
      const deferredAsts = meta.deferredAsts ? new Map(meta.deferredAsts) : undefined;
      if (meta.ast) return { ast: meta.ast, deps, deferredAsts };
      if (meta.rootVariable) return { ast: placeholder(meta.rootVariable), deps, deferredAsts };
    }
  }

  if (Array.isArray(arg)) {
    const elements: ASTNode[] = [];
    const deps = new Set<symbol>();
    let deferredAsts: Map<string, ASTNode> | undefined;
    for (const item of arg) {
      const serialized = serializeWithMetadata(item);
      elements.push(serialized.ast);
      deferredAsts = accumulate(serialized, deps, deferredAsts);
    }
    return { ast: arrayExpr(elements), deps, deferredAsts };
  }

  if (typeof arg === "object" && arg !== null) {
    if (arg instanceof Date) return leaf(callExpr(identifier("Date"), [numberLiteral(arg.getTime())]));

    if (arg instanceof RegExp) {
      const args = [stringLiteral(arg.source)];
      if (arg.flags) args.push(stringLiteral(arg.flags));
      return leaf(callExpr(identifier("RegExp"), args));
    }

    if (typeof URL !== "undefined" && arg instanceof URL) {
      return leaf(callExpr(identifier("URL"), [stringLiteral(arg.href)]));
    }

    if (typeof URLSearchParams !== "undefined" && arg instanceof URLSearchParams) {
      const entries: ASTNode[] = [];
      arg.forEach((value, key) => {
        entries.push(arrayExpr([stringLiteral(key), stringLiteral(value)]));
      });
      return leaf(callExpr(identifier("URLSearchParams"), [arrayExpr(entries)]));
    }

    if (arg instanceof Map) {
      const entries: ASTNode[] = [];
      const deps = new Set<symbol>();
      let deferredAsts: Map<string, ASTNode> | undefined;
      for (const [key, value] of arg) {
        const serializedKey = serializeWithMetadata(key);
        const serializedValue = serializeWithMetadata(value);
        entries.push(arrayExpr([serializedKey.ast, serializedValue.ast]));
        deferredAsts = accumulate(serializedKey, deps, deferredAsts);
        deferredAsts = accumulate(serializedValue, deps, deferredAsts);
      }
      return { ast: callExpr(identifier("Map"), [arrayExpr(entries)]), deps, deferredAsts };
    }

    if (arg instanceof Set) {
      const values: ASTNode[] = [];
      const deps = new Set<symbol>();
      let deferredAsts: Map<string, ASTNode> | undefined;
      for (const value of arg) {
        const serialized = serializeWithMetadata(value);
        values.push(serialized.ast);
        deferredAsts = accumulate(serialized, deps, deferredAsts);
      }
      return { ast: callExpr(identifier("Set"), [arrayExpr(values)]), deps, deferredAsts };
    }

    const typedArrayConstructor = getTypedArrayConstructor(arg);
    if (typedArrayConstructor) {
      const values: ASTNode[] = [];
      const deps = new Set<symbol>();
      let deferredAsts: Map<string, ASTNode> | undefined;
      for (const value of arg as Iterable<unknown>) {
        const serialized = serializeWithMetadata(value);
        values.push(serialized.ast);
        deferredAsts = accumulate(serialized, deps, deferredAsts);
      }
      return {
        ast: callExpr(identifier(typedArrayConstructor.name), [arrayExpr(values)]),
        deps,
        deferredAsts,
      };
    }

    if (arg instanceof ArrayBuffer) {
      const values = Array.from(new Uint8Array(arg)).map(numberLiteral);
      return leaf(memberExpr(callExpr(identifier("Uint8Array"), [arrayExpr(values)]), identifier("buffer")));
    }

    if (arg instanceof DataView) {
      return leaf(callExpr(identifier("DataView"), [serializeWithMetadata(arg.buffer).ast]));
    }

    const deps = new Set<symbol>();
    let deferredAsts: Map<string, ASTNode> | undefined;
    const properties = Object.entries(arg).map(([k, v]) => {
      const serialized = serializeWithMetadata(v);
      deferredAsts = accumulate(serialized, deps, deferredAsts);
      const isValidIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k);
      const key: ASTNode = isValidIdentifier ? identifier(k) : stringLiteral(k);
      return { key, value: serialized.ast, computed: false, shorthand: false };
    });
    return { ast: { type: "ObjectExpr", properties }, deps, deferredAsts };
  }

  if (arg === null) return leaf({ type: "NullLiteral" });
  if (arg === undefined) return leaf(identifier("undefined"));
  if (typeof arg === "boolean") return leaf({ type: "BooleanLiteral", value: arg });
  if (typeof arg === "number") return leaf(numberLiteral(arg));
  if (typeof arg === "string") return leaf(stringLiteral(arg));
  if (typeof arg === "bigint") return leaf(callExpr(identifier("BigInt"), [stringLiteral(arg.toString())]));

  throw new Error(`Unsupported argument type: ${typeof arg}`);
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
  return serializeWithMetadata(arg).ast;
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
function createProxyHandler<T>(
  ast: ASTNode,
  deps: Set<symbol>,
  deferredAsts?: Map<string, ASTNode>
): ProxyHandler<Proxify<T>> {
  return {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      const newAst = memberExpr(ast, identifier(String(prop)));
      return createProxyExpressionWithAST<unknown>(newAst, deps, deferredAsts);
    },
    apply(_target, _thisArg, args) {
      const serializedArgs = args.map(serializeWithMetadata);
      const callAst = callExpr(
        ast,
        serializedArgs.map((item) => item.ast)
      );
      const newDeps = new Set(deps);
      let deferredAsts: Map<string, ASTNode> | undefined;
      for (const item of serializedArgs) {
        deferredAsts = accumulate(item, newDeps, deferredAsts);
      }
      return createProxyExpressionWithAST<T>(callAst, newDeps, deferredAsts);
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
  const proxy = new Proxy(function () {} as unknown as Proxify<T>, createProxyHandler<T>(ast, deps, deferredAsts));

  setProxyMetadata(proxy, {
    type: "expression",
    ast,
    dependencies: deps,
    deferredAsts,
  });

  return proxy;
}
