import { z } from "zod"
import type {
  Expression,
  Variable,
  CompiledData,
  ExprNode,
  CompileContext
} from "./types"

/**
 * 内部节点标识映射，用于追踪已处理的节点
 */
interface NodeInfo {
  node: ExprNode
  refCount: number
}

/**
 * 将表达式树编译为可序列化的 JSON 结构
 * 
 * @template TResult - 表达式结果类型
 * @param expression - 根表达式
 * @param variables - 所有使用的变量定义
 * @returns 编译后的数据结构 [变量名列表, 表达式1, 表达式2, ...]
 * 
 * @throws 如果检测到循环依赖或未定义的变量引用
 * 
 * @example
 * ```ts
 * const x = variable(z.number())
 * const y = variable(z.number())
 * const sum = expr({ x, y })<number>("x + y")
 * const result = expr({ sum })<number>("sum * 2")
 * const compiled = compile(result, { x, y })
 * // => [["x", "y"], "$0+$1", "$1*2"]
 * ```
 */
export function compile<TResult>(
  expression: Expression<any, TResult>,
  variables: Record<string, Variable<any>>
): CompiledData {
  // 创建编译上下文
  const context: CompileContext = {
    variableOrder: [],
    nodeToIndex: new Map(),
    expressions: []
  }

  // 第一步：为每个表达式分配唯一 ID
  const exprIdMap = new WeakMap<Expression<any, any>, symbol>()
  const getExprId = (expr: Expression<any, any>): symbol => {
    if (!exprIdMap.has(expr)) {
      exprIdMap.set(expr, Symbol("expr"))
    }
    return exprIdMap.get(expr)!
  }

  // 为所有变量创建 node
  const nodeMap = new Map<symbol, ExprNode>()
  const variableNodes = new Map<string, ExprNode>()
  const visited = new Set<symbol>()
  const visiting = new Set<symbol>()

  for (const [name, variable] of Object.entries(variables)) {
    const id = Symbol(`var:${name}`)
    const node: ExprNode = {
      id,
      tag: "variable",
      schema: variable.schema
    }
    nodeMap.set(id, node)
    variableNodes.set(name, node)
  }

  // 第二步：递归收集所有依赖的节点，并检测循环依赖
  const exprNodes = new Map<symbol, ExprNode>()
  const collectNodes = (expr: Expression<any, any>): ExprNode => {
    const exprId = getExprId(expr)

    if (visited.has(exprId)) {
      return nodeMap.get(exprId)!
    }

    if (visiting.has(exprId)) {
      throw new Error("Circular dependency detected in expressions")
    }

    visiting.add(exprId)

    const contextNodes: Record<string, ExprNode> = {}

    // 收集表达式上下文中的所有节点
    for (const [key, contextItem] of Object.entries(expr.context)) {
      const item = contextItem as Variable<any> | Expression<any, any>
      if (item._tag === "variable") {
        const varNode = variableNodes.get(key)
        if (!varNode) {
          throw new Error(`Undefined variable reference: ${key}`)
        }
        contextNodes[key] = varNode
      } else if (item._tag === "expression") {
        contextNodes[key] = collectNodes(item as Expression<any, any>)
      }
    }

    const node: ExprNode = {
      id: exprId,
      tag: "expression",
      context: contextNodes,
      source: expr.source
    }

    nodeMap.set(exprId, node)
    exprNodes.set(exprId, node)
    visited.add(exprId)
    visiting.delete(exprId)

    return node
  }

  // 收集根表达式的所有节点
  const rootNode = collectNodes(expression)

  // 第三步：拓扑排序，确保依赖的节点在前
  const sortedExprNodes: ExprNode[] = []
  const exprVisited = new Set<symbol>()

  const topologicalSort = (node: ExprNode) => {
    if (exprVisited.has(node.id)) {
      return
    }

    exprVisited.add(node.id)

    if (node.tag === "expression" && node.context) {
      for (const contextNode of Object.values(node.context)) {
        topologicalSort(contextNode)
      }
    }

    if (node.tag === "expression") {
      sortedExprNodes.push(node)
    }
  }

  topologicalSort(rootNode)

  // 第四步：分配索引
  // 变量分配索引 0 ~ N-1
  for (const [name, varNode] of variableNodes.entries()) {
    if (!context.nodeToIndex.has(varNode.id)) {
      context.nodeToIndex.set(varNode.id, context.variableOrder.length)
      context.variableOrder.push(name)
    }
  }

  // 表达式分配索引 N ~ M
  let exprIndex = 0
  for (const exprNode of sortedExprNodes) {
    const index = context.variableOrder.length + exprIndex
    context.nodeToIndex.set(exprNode.id, index)
    exprIndex++
  }

  // 第五步：生成表达式源码，替换上下文引用
  for (const exprNode of sortedExprNodes) {
    if (!exprNode.context || !exprNode.source) {
      throw new Error("Invalid expression node")
    }

    const mapping: Record<string, number> = {}
    for (const [key, contextNode] of Object.entries(exprNode.context)) {
      const index = context.nodeToIndex.get(contextNode.id)
      if (index === undefined) {
        throw new Error(`Cannot find index for context item: ${key}`)
      }
      mapping[key] = index
    }

    // 检查表达式源码中是否引用了未定义的变量
    const usedVariables = extractVariableNames(exprNode.source)
    for (const varName of usedVariables) {
      if (!(varName in mapping)) {
        throw new Error(
          `Undefined variable reference: ${varName} (available: ${Object.keys(mapping).join(", ")})`
        )
      }
    }

    const compiledSource = replacePlaceholders(exprNode.source, mapping)
    context.expressions.push(compiledSource)
  }

  // 第六步：组合结果
  const result: CompiledData = [
    context.variableOrder,
    ...context.expressions
  ]

  return result
}

/**
 * 将表达式源码中的上下文名替换为 $index 格式
 * 
 * @param source - 原始表达式源码字符串
 * @param mapping - 上下文名到索引的映射
 * @returns 替换后的表达式源码
 * 
 * @example
 * ```ts
 * replacePlaceholders("x + y * 2", { x: 0, y: 1 })
 * // => "$0+$1*2"
 * ```
 */
function replacePlaceholders(
  source: string,
  mapping: Record<string, number>
): string {
  let result = source

  // 按照名称长度从长到短排序，避免部分替换
  const sortedKeys = Object.keys(mapping).sort(
    (a, b) => b.length - a.length
  )

  for (const key of sortedKeys) {
    const index = mapping[key]
    // 使用正则表达式替换，确保只替换完整的标识符
    // 匹配：单词边界前的 key，后面不跟字母数字或下划线
    const regex = new RegExp(`\\b${key}\\b`, "g")
    result = result.replace(regex, `$${index}`)
  }

  return result
}

/**
 * 从表达式源码中提取所有使用的变量名
 * 
 * @param source - 表达式源码字符串
 * @returns 使用的变量名列表（去重）
 * 
 * @example
 * ```ts
 * extractVariableNames("x + y * Math.PI")
 * // => ["x", "y", "Math"]
 * ```
 */
function extractVariableNames(source: string): string[] {
  // 匹配所有标识符（变量名、属性等）
  const identifierRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g
  const matches = source.matchAll(identifierRegex)
  const names = new Set<string>()

  for (const match of matches) {
    if (match[1]) {
      names.add(match[1])
    }
  }

  return Array.from(names)
}
