// ============================================================================
// Proxy 类型系统
// ============================================================================

declare const ProxyExpression: unique symbol;

/**
 * Proxy Expression 类型标记（用于类型推导）
 * 这是一个 phantom type，实际运行时是 Proxy 对象
 */
export type ProxyExpression<T = unknown> = {
  readonly [ProxyExpression]: T;
};

/**
 * 特殊全局类型 - 这些类型作为参数时允许直接传入原始值
 * 不需要递归展开其属性
 */
type BuiltinObjects =
  | Date
  | RegExp
  | Error
  | URL
  | URLSearchParams
  | ArrayBuffer
  | SharedArrayBuffer
  | DataView
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

/**
 * 将数组/元组类型的每个元素转换为 ProxifyArg
 * 保留元组的结构信息
 */
type ProxifyArgTuple<T extends readonly unknown[]> = T extends readonly [infer Head, ...infer Tail]
  ? [ProxifyArg<Head>, ...ProxifyArgTuple<Tail>]
  : T extends readonly []
    ? []
    : T extends readonly (infer E)[]
      ? readonly ProxifyArg<E>[]
      : never;

export type ProxifyArg<T> =
  | Proxify<T>
  | (T extends BuiltinObjects | string | number | boolean | bigint | undefined | null
      ? T
      : T extends readonly unknown[]
        ? ProxifyArgTuple<T>
        : T extends Map<infer K, infer V>
          ? Map<ProxifyArg<K>, ProxifyArg<V>>
          : T extends Set<infer E>
            ? Set<ProxifyArg<E>>
            : T extends WeakMap<infer K, infer V>
              ? WeakMap<ProxifyArg<K>, ProxifyArg<V>>
              : T extends WeakSet<infer E>
                ? WeakSet<ProxifyArg<E>>
                : T extends Promise<infer R>
                  ? Promise<ProxifyArg<R>>
                  : T extends (...args: infer _A) => infer _R
                    ? never
                    : { [K in keyof T]: ProxifyArg<T[K]> });

/**
 * 处理函数参数的 Proxy 转换
 * 参数可以是原始值或对应的 Proxy
 */
export type ProxifyArgs<T extends unknown[]> = {
  [K in keyof T]: ProxifyArg<T[K]>;
};

/**
 * 需要保留泛型参数的数组方法名
 * 这些方法需要显式定义以保留类型推导
 */
type GenericMethodNames = keyof GenericArrayMethods<unknown>;

/**
 * 泛型数组方法 - 需要手动定义以保留类型参数
 */
type GenericArrayMethods<E> = {
  map<U>(fn: Proxify<(value: E, index: number, array: E[]) => U>): Proxify<U[]>;
  flatMap<U>(fn: Proxify<(value: E, index: number, array: E[]) => U | readonly U[]>): Proxify<U[]>;
  filter<S extends E>(predicate: Proxify<(value: E, index: number, array: E[]) => value is S>): Proxify<S[]>;
  filter(predicate: Proxify<(value: E, index: number, array: E[]) => unknown>): Proxify<E[]>;
  find(predicate: Proxify<(value: E, index: number, obj: E[]) => unknown>): Proxify<E | undefined>;
  findLast(predicate: Proxify<(value: E, index: number, obj: E[]) => unknown>): Proxify<E | undefined>;
  findIndex(predicate: Proxify<(value: E, index: number, obj: E[]) => unknown>): Proxify<number>;
  findLastIndex(predicate: Proxify<(value: E, index: number, obj: E[]) => unknown>): Proxify<number>;
  reduce<U>(fn: Proxify<(acc: U, val: E, idx: number, arr: E[]) => U>, init: U | Proxify<U>): Proxify<U>;
  reduce(fn: Proxify<(acc: E, val: E, idx: number, arr: E[]) => E>): Proxify<E>;
  reduceRight<U>(fn: Proxify<(acc: U, val: E, idx: number, arr: E[]) => U>, init: U | Proxify<U>): Proxify<U>;
  reduceRight(fn: Proxify<(acc: E, val: E, idx: number, arr: E[]) => E>): Proxify<E>;
  every(predicate: Proxify<(value: E, index: number, array: E[]) => unknown>): Proxify<boolean>;
  some(predicate: Proxify<(value: E, index: number, array: E[]) => unknown>): Proxify<boolean>;
  forEach(fn: Proxify<(value: E, index: number, array: E[]) => void>): Proxify<void>;
  toSorted(compareFn?: Proxify<(a: E, b: E) => number>): Proxify<E[]>;
  sort(compareFn?: Proxify<(a: E, b: E) => number>): Proxify<E[]>;
};

/**
 * 通用方法/属性转换
 * 将对象 T 的所有方法返回值和属性包装为 Proxify
 */
type ProxifyMethods<T> = {
  readonly [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: ProxifyArgs<A>) => Proxify<R>
    : Proxify<T[K]>;
};

/**
 * 字符串类型的 Proxify 版本
 * 将所有字符串方法返回值包装为 Proxify
 * 参数允许为 Proxy 或原始值
 */
export type ProxifiedString = {
  // 显式定义常用字符串方法以确保类型正确
  charAt(pos: number | Proxify<number>): Proxify<string>;
  charCodeAt(index: number | Proxify<number>): Proxify<number>;
  concat(...strings: (string | Proxify<string>)[]): Proxify<string>;
  indexOf(searchString: string | Proxify<string>, position?: number | Proxify<number>): Proxify<number>;
  lastIndexOf(searchString: string | Proxify<string>, position?: number | Proxify<number>): Proxify<number>;
  localeCompare(that: string | Proxify<string>): Proxify<number>;
  match(regexp: string | RegExp | Proxify<string> | Proxify<RegExp>): Proxify<RegExpMatchArray | null>;
  replace(
    searchValue: string | RegExp | Proxify<string> | Proxify<RegExp>,
    replaceValue: string | Proxify<string> | Proxify<(substring: string, ...args: unknown[]) => string>
  ): Proxify<string>;
  replaceAll(
    searchValue: string | RegExp | Proxify<string> | Proxify<RegExp>,
    replaceValue: string | Proxify<string> | Proxify<(substring: string, ...args: unknown[]) => string>
  ): Proxify<string>;
  search(regexp: string | RegExp | Proxify<string> | Proxify<RegExp>): Proxify<number>;
  slice(start?: number | Proxify<number>, end?: number | Proxify<number>): Proxify<string>;
  split(
    separator: string | RegExp | Proxify<string> | Proxify<RegExp>,
    limit?: number | Proxify<number>
  ): Proxify<string[]>;
  substring(start: number | Proxify<number>, end?: number | Proxify<number>): Proxify<string>;
  toLowerCase(): Proxify<string>;
  toLocaleLowerCase(): Proxify<string>;
  toUpperCase(): Proxify<string>;
  toLocaleUpperCase(): Proxify<string>;
  trim(): Proxify<string>;
  trimStart(): Proxify<string>;
  trimEnd(): Proxify<string>;
  padStart(maxLength: number | Proxify<number>, fillString?: string | Proxify<string>): Proxify<string>;
  padEnd(maxLength: number | Proxify<number>, fillString?: string | Proxify<string>): Proxify<string>;
  repeat(count: number | Proxify<number>): Proxify<string>;
  startsWith(searchString: string | Proxify<string>, position?: number | Proxify<number>): Proxify<boolean>;
  endsWith(searchString: string | Proxify<string>, endPosition?: number | Proxify<number>): Proxify<boolean>;
  includes(searchString: string | Proxify<string>, position?: number | Proxify<number>): Proxify<boolean>;
  at(index: number | Proxify<number>): Proxify<string | undefined>;
  codePointAt(pos: number | Proxify<number>): Proxify<number | undefined>;
  normalize(form?: string | Proxify<string>): Proxify<string>;
  matchAll(regexp: RegExp | Proxify<RegExp>): Proxify<IterableIterator<RegExpMatchArray>>;

  // length 属性
  readonly length: Proxify<number>;

  // 其他方法使用索引签名兜底
  [key: string]: unknown;
};

/**
 * 数组类型的 Proxify 版本 - 使用交叉类型
 * 泛型方法单独定义 + 其他方法自动映射
 */
export type ProxifiedArray<E> = GenericArrayMethods<E> & {
  [K in Exclude<keyof E[], GenericMethodNames>]: E[][K] extends (...args: infer A) => infer R
    ? (...args: ProxifyArgs<A>) => Proxify<R>
    : Proxify<E[][K]>;
};

/**
 * 将类型 T 转换为 Proxy 包装类型
 * - 始终包含 ProxyExpression<T> 标记，用于 compile 函数类型检查
 * - 字符串类型：使用 ProxifiedString 特殊处理字符串方法
 * - 数组类型：使用 ProxifiedArray 特殊处理泛型方法
 * - 函数类型：保持函数签名，但参数允许 Proxy 或原始值，返回值递归应用 Proxify
 * - 对象类型：使用 ProxifyMethods 映射所有属性
 * - 原始类型：保持不变（返回 ProxyExpression 包装）
 */
export type Proxify<T> = ProxyExpression<T> &
  (T extends string
    ? ProxifiedString
    : T extends readonly (infer E)[]
      ? ProxifiedArray<E>
      : T extends (...args: infer Args) => infer R
        ? (...args: ProxifyArgs<Args>) => Proxify<R>
        : T extends object
          ? ProxifyMethods<T>
          : unknown);

/**
 * Variable 类型定义
 * 总是返回 Proxy 包装后的类型
 * @template T - 变量的值类型
 */
export type Variable<T = unknown> = Proxify<T>;

/**
 * 条件跳转节点
 * 如果条件为 truthy，跳过 offset 条指令
 */
export type BranchNode = ["br", condition: string, offset: number];

/**
 * 无条件跳转节点
 * 跳过 offset 条指令
 */
export type JumpNode = ["jmp", offset: number];

/**
 * Phi 节点
 * 取最近一次表达式求值的结果
 */
export type PhiNode = ["phi"];

/**
 * 控制流节点类型
 */
export type ControlFlowNode = BranchNode | JumpNode | PhiNode;

/**
 * Lambda 函数节点
 * ["fn", paramCount, ...stmts]
 */
export type FnNode = ["fn", paramCount: number, ...stmts: CompiledExpression[]];

/**
 * 表达式类型（可以是字符串、控制流节点或 Lambda 节点）
 */
export type CompiledExpression = string | ControlFlowNode | FnNode;

/**
 * 编译后的可序列化结构
 * 数组形式：[string[], ...expressions[]]
 * - 第一个元素是变量名列表
 * - 后续是表达式序列，使用 $N 引用前面的变量或表达式
 * - 表达式可以是字符串或控制流节点（br/jmp/phi）
 */
export type CompiledData = [variableNames: string[], ...expressions: CompiledExpression[]];

/**
 * 内部表达式节点接口（供编译器使用）
 */
export interface ExprNode {
  id: symbol;
  tag: "variable" | "expression";
  context?: Record<string, ExprNode>;
  source?: string;
}

/**
 * 编译上下文接口（供编译器使用）
 */
export interface CompileContext {
  variableOrder: string[];
  nodeToIndex: Map<symbol, number>;
  expressions: CompiledExpression[];
}

/**
 * 从 Variable 推导值类型
 * @template V - Variable 类型
 */
export type InferVariableType<V> = V extends Variable<infer T> ? T : never;

/**
 * 从上下文对象推导各项的类型
 * @template C - 上下文对象类型
 */
export type InferContextType<C> = {
  [K in keyof C]: C[K] extends Variable<infer T> ? T : never;
};

// ============================================================================
// Lambda 类型系统
// ============================================================================

/**
 * 递归地去除 Proxify 包装
 * 处理嵌套的对象和数组中的所有 Proxy 类型
 * - 如果是 Proxify<T>，提取并返回 UnproxyDeep<T>
 * - 如果是对象，递归处理每个属性
 * - 如果是数组，递归处理元素
 * - 其他情况返回原值
 */
export type UnproxyDeep<T> =
  T extends ProxyExpression<infer U>
    ? UnproxyDeep<U>
    : T extends readonly (infer E)[]
      ? UnproxyDeep<E>[]
      : T extends object
        ? { [K in keyof T]: UnproxyDeep<T[K]> }
        : T;

/**
 * Lambda 参数代理类型
 * 与普通 Proxify<T> 相同，但标记为 lambda 参数
 */
export type LambdaParam<T> = Proxify<T>;

/**
 * 原始类型
 */
type Primitive = string | number | boolean | null | undefined | symbol | bigint;

/**
 * 深度允许 Proxy 或原始值的类型
 * 用于 lambda 返回值，允许对象/数组中混合 Proxy 和原始值
 */
type DeepPartialProxy<T> = T extends Primitive
  ? T
  : T extends readonly (infer E)[]
    ? readonly (Proxify<E> | DeepPartialProxy<E>)[]
    : T extends object
      ? { [K in keyof T]: Proxify<T[K]> | DeepPartialProxy<T[K]> }
      : T;

/**
 * 表达式值类型
 * 支持：
 * - Proxify<T>: 完整的代理表达式
 * - 原始值: 字符串、数字等
 * - 对象/数组: 可以混合 Proxy 值和原始值
 */
export type ExprValue<T> = Proxify<T> | DeepPartialProxy<T>;

/**
 * Lambda 构建函数签名
 * @template Args - 参数类型元组
 * @template R - 返回值类型
 */
export type LambdaBuilder<Args extends unknown[], R> = (
  ...params: { [K in keyof Args]: LambdaParam<Args[K]> }
) => ExprValue<R>;

/**
 * Lambda 表达式类型
 * 表示一个可序列化的函数
 */
export type Lambda<Args extends unknown[], R> = Proxify<(...args: Args) => R>;

/**
 * 从 Lambda 类型提取参数类型
 */
export type InferLambdaArgs<L> = L extends Lambda<infer Args, unknown> ? Args : never;

/**
 * 从 Lambda 类型提取返回类型
 */
export type InferLambdaReturn<L> = L extends Lambda<unknown[], infer R> ? R : never;
