import { z } from "zod"

/**
 * 表示一个类型化变量
 * @template T - Zod schema 类型
 */
export type Variable<T extends z.ZodType = z.ZodType> = {
  _tag: "variable"
  schema: T
  _type: z.infer<T> // 仅用于类型推导，运行时不存在
}

/**
 * 表示一个表达式
 * @template TContext - 表达式上下文类型
 * @template TResult - 表达式结果类型
 */
export type Expression<TContext = Record<string, unknown>, TResult = unknown> = {
  _tag: "expression"
  context: TContext
  source: string
  _type: TResult // 仅用于类型推导，运行时不存在
}

/**
 * 编译后的可序列化结构
 * 数组形式：[string[], ...string[]]
 * - 第一个元素是变量名列表
 * - 后续是表达式序列，使用 $N 引用前面的变量或表达式
 */
export type CompiledData = [variableNames: string[], ...expressions: string[]]

/**
 * 内部表达式节点接口（供编译器使用）
 */
export interface ExprNode {
  id: symbol
  tag: "variable" | "expression"
  schema?: z.ZodType
  context?: Record<string, ExprNode>
  source?: string
}

/**
 * 编译上下文接口（供编译器使用）
 */
export interface CompileContext {
  variableOrder: string[]
  nodeToIndex: Map<symbol, number>
  expressions: string[]
}

/**
 * 从 Variable 推导值类型
 * @template V - Variable 类型
 */
export type InferVariableType<V> = V extends Variable<infer T>
  ? z.infer<T>
  : never

/**
 * 从上下文对象推导各项的类型
 * @template C - 上下文对象类型
 */
export type InferContextType<C> = {
  [K in keyof C]: C[K] extends Variable<infer T>
    ? z.infer<T>
    : C[K] extends Expression<any, infer R>
      ? R
      : never
}

/**
 * 从 Expression 推导结果类型
 * @template E - Expression 类型
 */
export type InferExpressionType<E> = E extends Expression<any, infer R>
  ? R
  : never
