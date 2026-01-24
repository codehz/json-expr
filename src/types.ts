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
 * 将类型 T 转换为 Proxy 包装类型
 * - 始终包含 ProxyExpression<T> 标记，用于 compile 函数类型检查
 * - 函数类型：保持函数签名，但参数允许 Proxy 或原始值，返回值递归应用 Proxify
 * - 对象类型：映射所有属性为 Proxify
 * - 原始类型：保持不变（返回 ProxyExpression 包装）
 */
export type Proxify<T> = ProxyExpression<T> &
  (T extends (...args: infer Args) => infer R
    ? (...args: ProxifyArgs<Args>) => Proxify<R>
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
