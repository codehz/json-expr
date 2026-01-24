// ============================================================================
// Proxy 类型系统
// ============================================================================

/**
 * Proxy Expression 类型标记（用于类型推导）
 * 这是一个 phantom type，实际运行时是 Proxy 对象
 */
export type ProxyExpression<T = unknown> = {
  readonly __proxyExpression: T;
};

/**
 * 处理函数参数的 Proxy 转换
 * 参数可以是原始值或对应的 Proxy
 */
export type ProxifyArgs<T extends unknown[]> = {
  [K in keyof T]: T[K] | Proxify<T[K]>;
};

/**
 * 数组类型的 Proxify 版本
 * 特殊处理泛型方法（map, filter 等），确保返回值类型正确
 */
export type ProxifiedArray<T> = {
  // 泛型方法需要显式定义以保留泛型参数
  map<U>(
    callbackfn: Proxify<(value: T, index: number, array: T[]) => U> | ((value: T, index: number, array: T[]) => U)
  ): Proxify<U[]>;
  flatMap<U>(
    callbackfn:
      | Proxify<(value: T, index: number, array: T[]) => U | readonly U[]>
      | ((value: T, index: number, array: T[]) => U | readonly U[])
  ): Proxify<U[]>;
  filter<S extends T>(
    predicate:
      | Proxify<(value: T, index: number, array: T[]) => value is S>
      | ((value: T, index: number, array: T[]) => value is S)
  ): Proxify<S[]>;
  filter(
    predicate:
      | Proxify<(value: T, index: number, array: T[]) => unknown>
      | ((value: T, index: number, array: T[]) => unknown)
  ): Proxify<T[]>;
  reduce<U>(
    callbackfn:
      | Proxify<(previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U>
      | ((previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U),
    initialValue: U | Proxify<U>
  ): Proxify<U>;
  reduce(
    callbackfn:
      | Proxify<(previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T>
      | ((previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T)
  ): Proxify<T>;
  reduceRight<U>(
    callbackfn:
      | Proxify<(previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U>
      | ((previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U),
    initialValue: U | Proxify<U>
  ): Proxify<U>;
  reduceRight(
    callbackfn:
      | Proxify<(previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T>
      | ((previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T)
  ): Proxify<T>;
  find<S extends T>(
    predicate:
      | Proxify<(value: T, index: number, obj: T[]) => value is S>
      | ((value: T, index: number, obj: T[]) => value is S)
  ): Proxify<S | undefined>;
  find(
    predicate:
      | Proxify<(value: T, index: number, obj: T[]) => unknown>
      | ((value: T, index: number, obj: T[]) => unknown)
  ): Proxify<T | undefined>;
  findIndex(
    predicate:
      | Proxify<(value: T, index: number, obj: T[]) => unknown>
      | ((value: T, index: number, obj: T[]) => unknown)
  ): Proxify<number>;
  findLast<S extends T>(
    predicate:
      | Proxify<(value: T, index: number, array: T[]) => value is S>
      | ((value: T, index: number, array: T[]) => value is S)
  ): Proxify<S | undefined>;
  findLast(
    predicate:
      | Proxify<(value: T, index: number, array: T[]) => unknown>
      | ((value: T, index: number, array: T[]) => unknown)
  ): Proxify<T | undefined>;
  findLastIndex(
    predicate:
      | Proxify<(value: T, index: number, array: T[]) => unknown>
      | ((value: T, index: number, array: T[]) => unknown)
  ): Proxify<number>;
  every<S extends T>(
    predicate:
      | Proxify<(value: T, index: number, array: T[]) => value is S>
      | ((value: T, index: number, array: T[]) => value is S)
  ): Proxify<boolean>;
  every(
    predicate:
      | Proxify<(value: T, index: number, array: T[]) => unknown>
      | ((value: T, index: number, array: T[]) => unknown)
  ): Proxify<boolean>;
  some(
    predicate:
      | Proxify<(value: T, index: number, array: T[]) => unknown>
      | ((value: T, index: number, array: T[]) => unknown)
  ): Proxify<boolean>;
  forEach(
    callbackfn: Proxify<(value: T, index: number, array: T[]) => void> | ((value: T, index: number, array: T[]) => void)
  ): Proxify<void>;
  toSorted(compareFn?: Proxify<(a: T, b: T) => number> | ((a: T, b: T) => number)): Proxify<T[]>;
  sort(compareFn?: Proxify<(a: T, b: T) => number> | ((a: T, b: T) => number)): Proxify<T[]>;
} & {
  // 其他非泛型属性使用默认映射
  [K in Exclude<keyof T[], keyof ProxifiedArrayMethods<T>>]: Proxify<T[][K]>;
};

/**
 * 数组泛型方法的键（用于排除）
 */
type ProxifiedArrayMethods<T> = {
  map: unknown;
  flatMap: unknown;
  filter: unknown;
  reduce: unknown;
  reduceRight: unknown;
  find: unknown;
  findIndex: unknown;
  findLast: unknown;
  findLastIndex: unknown;
  every: unknown;
  some: unknown;
  forEach: unknown;
  toSorted: unknown;
  sort: unknown;
};

/**
 * 将类型 T 转换为 Proxy 包装类型
 * - 始终包含 ProxyExpression<T> 标记，用于 compile 函数类型检查
 * - 函数类型：保持函数签名，但参数允许 Proxy 或原始值，返回值递归应用 Proxify
 * - 数组类型：使用 ProxifiedArray 特殊处理泛型方法
 * - 对象类型：映射所有属性为 Proxify
 * - 原始类型：保持不变（返回 ProxyExpression 包装）
 */
export type Proxify<T> = ProxyExpression<T> &
  (T extends (...args: infer Args) => infer R
    ? (...args: ProxifyArgs<Args>) => Proxify<R>
    : T extends readonly (infer E)[]
      ? ProxifiedArray<E>
      : T extends object
        ? { [K in keyof T]: Proxify<T[K]> }
        : unknown);

/**
 * Variable 类型定义
 * 总是返回 Proxy 包装后的类型
 * @template T - 变量的值类型
 */
export type Variable<T = unknown> = Proxify<T>;

// ============================================================================
// 旧式类型定义（兼容性保留）
// ============================================================================

/**
 * 旧式变量类型定义
 * @template T - 变量的值类型
 * @deprecated 请使用新的 Proxy 类型系统
 */
export type LegacyVariable<T = unknown> = {
  _tag: "variable";
  _type: T; // 仅用于类型推导，运行时不存在
};

/**
 * 表示一个表达式
 * @template TContext - 表达式上下文类型
 * @template TResult - 表达式结果类型
 * @deprecated 请使用新的 Proxy 类型系统
 */
export type Expression<TContext = Record<string, unknown>, TResult = unknown> = {
  _tag: "expression";
  context: TContext;
  source: string;
  _type: TResult; // 仅用于类型推导，运行时不存在
};

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
 * 表达式类型（可以是字符串或控制流节点）
 */
export type CompiledExpression = string | ControlFlowNode;

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
  [K in keyof C]: C[K] extends Variable<infer T> ? T : C[K] extends Expression<unknown, infer R> ? R : never;
};

/**
 * 从 Expression 推导结果类型
 * @template E - Expression 类型
 */
export type InferExpressionType<E> = E extends Expression<unknown, infer R> ? R : never;

// ============================================================================
// Lambda 类型系统
// ============================================================================

/**
 * Lambda 参数代理类型
 * 与普通 Proxify<T> 相同，但标记为 lambda 参数
 */
export type LambdaParam<T> = Proxify<T>;

/**
 * Lambda 构建函数签名
 * @template Args - 参数类型元组
 * @template R - 返回值类型
 */
export type LambdaBuilder<Args extends unknown[], R> = (
  ...params: { [K in keyof Args]: LambdaParam<Args[K]> }
) => Proxify<R>;

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

/**
 * 常用 Lambda 类型别名
 */
export type MapCallback<T, R> = Lambda<[T, number, T[]], R>;
export type FilterCallback<T> = Lambda<[T, number, T[]], boolean>;
export type ReduceCallback<T, R> = Lambda<[R, T, number, T[]], R>;
export type FindCallback<T> = Lambda<[T, number, T[]], boolean>;
export type SortCallback<T> = Lambda<[T, T], number>;
