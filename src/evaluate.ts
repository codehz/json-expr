import type { CompiledData, CompiledExpression } from "./types";

/**
 * 缓存已构造的求值函数，以提升重复执行性能
 */
const evaluatorCache = new Map<string, (values: unknown[]) => unknown>();

/**
 * 检测编译数据是否包含控制流节点（V2 格式）
 */
function isV2Format(expressions: CompiledExpression[]): boolean {
  return expressions.some((expr) => Array.isArray(expr));
}

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
export function evaluate<TResult = unknown>(data: CompiledData, values: Record<string, unknown>): TResult {
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
    // 根据格式选择合适的函数体构造器
    const functionBody = isV2Format(expressions)
      ? buildEvaluatorFunctionBodyV2(expressions, variableNames.length)
      : buildEvaluatorFunctionBody(expressions as string[], variableNames.length);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
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
  if (expressions.length === 0) throw new Error("No expressions to evaluate");

  const lines = [
    ...Array.from({ length: variableCount }, (_, i) => `const $${i} = $values[${i}];`),
    ...expressions.map((expr, i) => {
      const idx = variableCount + i;
      return `const $${idx} = ${expr}; $values[${idx}] = $${idx};`;
    }),
    `return $values[$values.length - 1];`,
  ];

  return lines.join("\n");
}

/**
 * 构造带控制流支持的求值函数体（V2 格式）
 *
 * @param expressions - 表达式列表（可包含控制流节点）
 * @param variableCount - 变量数量
 * @returns 函数体字符串
 */
function buildEvaluatorFunctionBodyV2(expressions: CompiledExpression[], variableCount: number): string {
  if (expressions.length === 0) throw new Error("No expressions to evaluate");

  const lines = [
    // 初始化变量
    ...Array.from({ length: variableCount }, (_, i) => `const $${i} = $values[${i}];`),
    "let $pc = 0;",
    "let $lastValue;",
    // 预先声明所有中间变量
    ...expressions.map((_, i) => `let $${variableCount + i};`),
    `while ($pc < ${expressions.length}) {`,
    "  switch ($pc) {",
  ];

  expressions.forEach((expr, i) => {
    const idx = variableCount + i;
    lines.push(`    case ${i}: {`);

    if (typeof expr === "string") {
      lines.push(`      $${idx} = $lastValue = ${expr};`);
      lines.push(`      $values[${idx}] = $${idx};`);
      lines.push("      $pc++; break;");
    } else {
      const [type] = expr;
      switch (type) {
        case "br":
          lines.push(`      if (${expr[1]}) { $pc += ${expr[2] + 1}; } else { $pc++; } break;`);
          break;
        case "jmp":
          lines.push(`      $pc += ${expr[1] + 1}; break;`);
          break;
        case "phi":
          lines.push(`      $${idx} = $values[${idx}] = $lastValue; $pc++; break;`);
          break;
      }
    }
    lines.push("    }");
  });

  lines.push("  }", "}", "return $values[$values.length - 1];");

  return lines.join("\n");
}
