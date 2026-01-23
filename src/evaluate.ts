import type { CompiledData } from "./types";

/**
 * 缓存已构造的求值函数，以提升重复执行性能
 */
const evaluatorCache = new Map<string, (values: unknown[]) => unknown>();

/**
 * 执行编译后的表达式
 *
 * @template TResult - 表达式结果类型
 * @param data - 编译后的数据结构 [变量名列表, 表达式1, 表达式2, ...]
 * @param values - 变量值映射，按变量名提供值
 * @returns 最后一个表达式的求值结果
 *
 * @throws 如果运行时类型验证失败或表达式执行出错
 *
 * @example
 * ```ts
 * const compiled = [["x", "y"], "$0+$1", "$1*2"]
 * const result = evaluate<number>(compiled, { x: 2, y: 3 })
 * // => 6  (3 * 2)
 * ```
 */
export function evaluate<TResult>(data: CompiledData, values: Record<string, unknown>): TResult {
  if (data.length < 1) {
    throw new Error("Invalid compiled data: must have at least variable names");
  }

  const [variableNames, ...expressions] = data;

  if (!Array.isArray(variableNames)) {
    throw new Error("Invalid compiled data: first element must be variable names array");
  }

  // 验证所有必需的变量都已提供
  for (const varName of variableNames) {
    if (typeof varName !== "string") {
      throw new Error("Invalid compiled data: variable names must be strings");
    }
    if (!(varName in values)) {
      throw new Error(`Missing required variable: ${varName}`);
    }
  }

  // 创建值数组，按变量名顺序填入传入的值
  const valueArray: unknown[] = [];
  for (const varName of variableNames) {
    valueArray.push(values[varName]);
  }

  // 获取或构造求值函数
  const cacheKey = JSON.stringify(data);
  let evaluator = evaluatorCache.get(cacheKey);

  if (!evaluator) {
    // 构造求值函数
    const functionBody = buildEvaluatorFunctionBody(expressions, variableNames.length);
    evaluator = new Function("$values", functionBody) as (values: unknown[]) => unknown;
    evaluatorCache.set(cacheKey, evaluator);
  }

  // 执行求值函数
  try {
    const result = evaluator(valueArray);
    return result as TResult;
  } catch (error) {
    throw new Error(`Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 构造求值函数体
 *
 * @param expressions - 表达式列表
 * @param variableCount - 变量数量
 * @returns 函数体字符串
 *
 * @example
 * ```ts
 * buildEvaluatorFunctionBody(["$0+$1", "$2*2"], 2)
 * // 返回执行 $0+$1 并存储到 $values[2]，然后执行 $2*2 的函数体
 * ```
 */
function buildEvaluatorFunctionBody(expressions: string[], variableCount: number): string {
  if (expressions.length === 0) {
    throw new Error("No expressions to evaluate");
  }

  const lines: string[] = [];

  // 为了使 $0, $1 等能在函数体中访问，我们需要创建局部变量
  // 或者使用代理访问值数组
  lines.push("const $0 = $values[0];");
  for (let i = 1; i < variableCount; i++) {
    lines.push(`const $${i} = $values[${i}];`);
  }

  // 依次对每个表达式求值，结果追加到值数组
  for (let i = 0; i < expressions.length; i++) {
    const exprSource = expressions[i];
    const resultIndex = variableCount + i;

    lines.push(`const $${resultIndex} = ${exprSource};`);
    lines.push(`$values[${resultIndex}] = $${resultIndex};`);
  }

  // 返回最后一个表达式的结果（即最后一个元素）
  lines.push(`return $values[$values.length - 1];`);

  return lines.join("\n");
}
