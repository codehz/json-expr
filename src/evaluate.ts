import type { BranchNode, CompiledData, CompiledExpression, ControlFlowNode, JumpNode } from "./types";

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
 * 分析并验证控制流结构，将 br/jmp/phi 翻译为 if-else 语句
 *
 * 控制流节点规则：
 * - br [condition, offset]: 如果条件为真则跳过 offset 条指令
 * - jmp [offset]: 无条件跳过 offset 条指令
 * - phi: 取最近求值的结果（合并点）
 *
 * 翻译策略：
 * - br 节点后跟的 skipCount 行代码是"假分支"（条件为假时执行）
 * - 如果后面有 jmp，则说明有真分支
 * - 使用 !(condition) 来表达"条件为假时执行这部分"
 * - 支持嵌套控制流：在处理块时递归处理可能包含的子 br/jmp
 */
function translateControlFlow(expressions: CompiledExpression[], variableCount: number): string {
  // 验证所有 br 和 jmp 的跳转目标有效
  for (let i = 0; i < expressions.length; i++) {
    const expr = expressions[i];
    if (Array.isArray(expr)) {
      const [type, , offset] = expr;
      if ((type === "br" || type === "jmp") && offset !== undefined) {
        const target = i + offset + 1;
        if (target < 0 || target > expressions.length) {
          throw new Error(
            `Unable to translate: invalid jump target at index ${i}. ` +
              `Target would be ${target}, but expression length is ${expressions.length}`
          );
        }
      }
    }
  }

  const lines: string[] = [
    // 初始化变量
    ...Array.from({ length: variableCount }, (_, i) => `const $${i} = $values[${i}];`),
    "let $lastValue;",
  ];

  // 预先声明所有中间变量
  for (let i = 0; i < expressions.length; i++) {
    lines.push(`let $${variableCount + i};`);
  }

  // 追踪已处理过的指令索引
  const processed = new Set<number>();

  // 递归翻译指定范围内的指令
  function translateRange(start: number, end: number, indent: string = ""): void {
    let i = start;
    while (i < end) {
      if (processed.has(i)) {
        i++;
        continue;
      }

      const expr = expressions[i];
      const varIdx = variableCount + i;

      if (typeof expr === "string") {
        // 普通表达式
        processed.add(i);
        lines.push(`${indent}$${varIdx} = $lastValue = ${expr};`);
        lines.push(`${indent}$values[${varIdx}] = $${varIdx};`);
        i++;
      } else if (!Array.isArray(expr)) {
        i++;
      } else {
        const [type] = expr as ControlFlowNode;

        if (type === "br") {
          processed.add(i);
          const [, condition, skipCount] = expr as BranchNode;

          // br 跳过 skipCount 条指令
          // 假分支范围：[i+1, i+skipCount]（包括边界）
          const falseBlockEnd = i + skipCount;
          let jmpIdx = -1;
          let trueBlockEnd = falseBlockEnd + 1;

          // 检查假分支的最后一条是否是 jmp
          // 假分支最后一条指令：expressions[falseBlockEnd]
          if (falseBlockEnd < expressions.length) {
            const lastInFalseBranch = expressions[falseBlockEnd];
            if (Array.isArray(lastInFalseBranch) && (lastInFalseBranch as JumpNode)[0] === "jmp") {
              jmpIdx = falseBlockEnd;
              const jmpOffset = (lastInFalseBranch as JumpNode)[1];
              trueBlockEnd = jmpIdx + jmpOffset;
              processed.add(jmpIdx);
            }
          }

          const hasElse = jmpIdx >= 0;

          // 生成 if 块
          lines.push(`${indent}if (!(${condition})) {`);

          // 假分支（条件为假时执行）
          translateRange(i + 1, falseBlockEnd + 1, indent + "  ");

          if (hasElse) {
            lines.push(`${indent}} else {`);

            // 真分支（条件为真时执行，即跳过的代码）
            translateRange(jmpIdx + 1, trueBlockEnd + 1, indent + "  ");

            lines.push(`${indent}}`);
            i = trueBlockEnd + 1;
          } else {
            lines.push(`${indent}}`);
            i = falseBlockEnd + 1;
          }
        } else if (type === "phi") {
          // Phi 节点：取最近的值
          processed.add(i);
          lines.push(`${indent}$${varIdx} = $lastValue;`);
          lines.push(`${indent}$values[${varIdx}] = $${varIdx};`);
          i++;
        } else if (type === "jmp") {
          // jmp 不应该单独出现，应该已被 br 处理
          throw new Error(
            `Unable to translate: unexpected jmp at index ${i}. ` +
              `This should have been paired with a preceding br. ` +
              `Unsupported control flow structure.`
          );
        } else {
          throw new Error(`Unable to translate: unknown control flow node type.`);
        }
      }
    }
  }

  translateRange(0, expressions.length);

  lines.push("return $values[$values.length - 1];");
  return lines.join("\n");
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

  return translateControlFlow(expressions, variableCount);
}
