import type { CompiledData } from "./types"

/**
 * 从表达式源码中提取所有 $N 引用
 * @param source - 表达式源码
 * @returns 包含所有引用的 Set，格式为 "$0", "$1" 等
 */
function extractReferences(source: string): Set<string> {
  const references = new Set<string>()
  // 匹配 $N 形式的引用，其中 N 是一个或多个数字
  const regex = /\$(\d+)/g
  let match
  while ((match = regex.exec(source)) !== null) {
    references.add(match[0])
  }
  return references
}

/**
 * 计算编译产物中每个表达式被引用的次数
 * @param expressions - 表达式列表（不包括变量名列表）
 * @returns Map，键为 "$N"，值为被引用的次数
 */
function countReferences(expressions: string[]): Map<string, number> {
  const referenceCount = new Map<string, number>()

  for (let i = 0; i < expressions.length; i++) {
    const expr = expressions[i]!
    // 使用正则表达式匹配所有 $N，包括重复的
    const regex = /\$(\d+)/g
    let match
    while ((match = regex.exec(expr)) !== null) {
      const ref = match[0]
      referenceCount.set(ref, (referenceCount.get(ref) ?? 0) + 1)
    }
  }

  return referenceCount
}

/**
 * 检查表达式是否需要括号
 * 仅当表达式包含低优先级运算符时才需要括号
 * @param expr - 表达式
 * @returns 是否需要括号
 */
function needsParentheses(expr: string): boolean {
  expr = expr.trim()

  // 如果已经用括号包围，不需要额外括号
  if (/^\(.*\)$/.test(expr)) {
    return false
  }

  // 如果是纯数字或变量引用，不需要括号
  if (/^(\d+(\.\d+)?|\$\d+)$/.test(expr)) {
    return false
  }

  // 检查是否包含低优先级运算符：+ 或 -
  // 但需要注意括号的平衡
  // 一个简单的启发式：如果包含 + 或 - 在括号外，就需要括号
  let parenDepth = 0
  for (let i = 1; i < expr.length; i++) {
    const char = expr[i]
    if (char === "(") parenDepth++
    else if (char === ")") parenDepth--
    else if (parenDepth === 0 && (char === "+" || char === "-")) {
      return true
    }
  }

  return false
}

/**
 * 优化编译产物，将仅被引用一次的表达式内联
 * @param data - 编译后的数据
 * @returns 优化后的编译数据
 *
 * 优化策略：
 * - 识别仅被引用一次的子表达式
 * - 将其内联到使用它的表达式中
 * - 根据优先级添加或移除括号
 * - 保持变量列表不变
 *
 * 示例：
 * 输入: [["x"], "$0+1", "$0+2", "$1*$2"]
 * 输出: [["x"], "($0+1)*($0+2)"]
 */
export function optimize(data: CompiledData): CompiledData {
  if (data.length <= 1) {
    // 只有变量列表，没有表达式
    return data
  }

  const [variableNames, ...expressions] = data
  const variableCount = variableNames.length

  // 计算每个表达式被引用的次数
  const referenceCount = countReferences(expressions)

  // 识别可以内联的表达式（仅被引用一次）
  // 不内联最后一个表达式（通常是最终结果）
  const inlineCandidates = new Set<number>()
  for (let i = 0; i < expressions.length - 1; i++) {
    const exprIndex = variableCount + i
    const refKey = `$${exprIndex}`
    const count = referenceCount.get(refKey) ?? 0
    if (count === 1) {
      inlineCandidates.add(i)
    }
  }

  if (inlineCandidates.size === 0) {
    // 没有表达式可以内联
    return data
  }

  // 记录哪些表达式被内联，以及它们的内联内容
  const inlineMap = new Map<number, string>() // 旧索引 -> 内联内容
  const newExpressions: string[] = []

  // 第一遍：计算要内联的表达式
  for (let i = 0; i < expressions.length; i++) {
    if (inlineCandidates.has(i)) {
      inlineMap.set(variableCount + i, expressions[i]!)
    }
  }

  // 第二遍：处理保留的表达式，进行内联替换
  for (let i = 0; i < expressions.length; i++) {
    if (!inlineCandidates.has(i)) {
      // 这个表达式需要保留
      let source = expressions[i]!

      // 执行内联替换（从大到小，避免 $1 影响 $10）
      const toInline = Array.from(inlineMap.entries())
        .filter(([oldIdx]) => oldIdx < variableCount + i)
        .sort((a, b) => b[0] - a[0])

      for (const [oldIdx, inlineExpr] of toInline) {
        const ref = `$${oldIdx}`
        if (source.includes(ref)) {
          // 检查内联表达式是否需要括号
          let replacement = inlineExpr
          if (needsParentheses(replacement)) {
            replacement = `(${replacement})`
          }
          source = source.replace(new RegExp(`\\${ref}`, "g"), replacement)
        }
      }

      newExpressions.push(source)
    }
  }

  // 返回优化后的编译数据
  return [variableNames, ...newExpressions] as CompiledData
}
