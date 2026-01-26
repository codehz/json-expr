import type { CompiledData, CompiledExpression, ControlFlowNode, FnNode, JumpNode } from "./types";

/**
 * 缓存已构造的求值函数，以提升重复执行性能
 */
const evaluatorCache = new Map<string, (values: unknown[]) => unknown>();

/**
 * 判断是否是 FnNode
 */
function isFnNode(expr: CompiledExpression): expr is FnNode {
  return Array.isArray(expr) && expr[0] === "fn" && typeof expr[1] === "number";
}

/**
 * 判断是否是控制流节点
 */
function isControlFlowNode(expr: CompiledExpression): expr is ControlFlowNode {
  return Array.isArray(expr) && (expr[0] === "br" || expr[0] === "jmp" || expr[0] === "phi");
}

/**
 * 全局索引计数器
 */
interface IndexCounter {
  value: number;
}

/**
 * 参数计数器，用于在求值时推断 lambda 参数名
 */
interface ParamCounter {
  value: number;
}

/**
 * 生成 lambda 函数代码
 *
 * @param fnNode - FnNode 节点
 * @param indexCounter - 全局索引计数器
 * @param paramCounter - 参数计数器
 * @returns lambda 函数代码字符串
 */
function generateLambdaCode(fnNode: FnNode, indexCounter: IndexCounter, paramCounter: ParamCounter): string {
  const [, paramCount, ...stmts] = fnNode;

  // 分配参数名
  const paramStartIndex = paramCounter.value;
  paramCounter.value += paramCount;

  const params = Array.from({ length: paramCount }, (_, i) => `_${paramStartIndex + i}`).join(",");

  // 生成函数体
  const bodyCode = translateStmts(stmts, indexCounter, paramCounter);

  return `(${params})=>{${bodyCode}}`;
}

/**
 * 翻译表达式列表为 JavaScript 代码
 * 使用全局索引计数器分配 $[N] 槽位
 */
function translateStmts(
  expressions: CompiledExpression[],
  indexCounter: IndexCounter,
  paramCounter: ParamCounter
): string {
  // 验证控制流跳转目标有效
  for (let i = 0; i < expressions.length; i++) {
    const expr = expressions[i];
    if (!expr) continue;
    if (isControlFlowNode(expr)) {
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

  const lines: string[] = ["let $lastValue;"];

  // 预分配索引映射：expressions[i] -> 全局索引
  const indexMap: number[] = [];
  const savedStart = indexCounter.value;
  for (let i = 0; i < expressions.length; i++) {
    indexMap.push(indexCounter.value);
    const expr = expressions[i]!;
    if (isFnNode(expr)) {
      // FnNode 自身占一个索引
      indexCounter.value++;
      // 内部 stmts 也占索引（递归计算）
      countFnNodeIndices(expr, indexCounter);
    } else {
      indexCounter.value++;
    }
  }
  // 重置计数器，在翻译时再递增
  indexCounter.value = savedStart;

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
      if (!expr) {
        i++;
        continue;
      }
      const varIdx = indexMap[i]!;

      if (isFnNode(expr)) {
        // Lambda 函数节点
        processed.add(i);
        // Claim the FnNode's own index
        indexCounter.value++;
        const lambdaCode = generateLambdaCode(expr, indexCounter, paramCounter);
        lines.push(`${indent}$[${varIdx}] = $lastValue = ${lambdaCode};`);
        i++;
      } else if (typeof expr === "string") {
        // 普通表达式
        processed.add(i);
        indexCounter.value++;
        lines.push(`${indent}$[${varIdx}] = $lastValue = ${expr};`);
        i++;
      } else if (!Array.isArray(expr)) {
        i++;
      } else {
        const [type] = expr;

        if (type === "br") {
          processed.add(i);
          indexCounter.value++;
          const [, condition, skipCount] = expr;

          const falseBlockEnd = i + skipCount;
          let jmpIdx = -1;
          let trueBlockEnd = falseBlockEnd + 1;

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

          lines.push(`${indent}if (!(${condition})) {`);
          translateRange(i + 1, falseBlockEnd + 1, indent + "  ");

          if (hasElse) {
            lines.push(`${indent}} else {`);
            translateRange(jmpIdx + 1, trueBlockEnd + 1, indent + "  ");
            lines.push(`${indent}}`);
            i = trueBlockEnd + 1;
          } else {
            lines.push(`${indent}}`);
            i = falseBlockEnd + 1;
          }
        } else if (type === "phi") {
          processed.add(i);
          indexCounter.value++;
          lines.push(`${indent}$[${varIdx}] = $lastValue;`);
          i++;
        } else if (type === "jmp") {
          // jmp 占一个索引位
          indexCounter.value++;
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

  lines.push("return $lastValue;");
  return lines.join("\n");
}

/**
 * 计算 FnNode 内部 stmts 占用的索引数量（递归）
 */
function countFnNodeIndices(fnNode: FnNode, indexCounter: IndexCounter): void {
  const [, , ...stmts] = fnNode;
  for (const stmt of stmts) {
    if (isFnNode(stmt)) {
      indexCounter.value++;
      countFnNodeIndices(stmt, indexCounter);
    } else {
      indexCounter.value++;
    }
  }
}

/**
 * 分析并验证控制流结构，将 br/jmp/phi 翻译为 if-else 语句
 */
function translateControlFlow(expressions: CompiledExpression[], variableCount: number): string {
  const indexCounter: IndexCounter = { value: variableCount };
  const paramCounter: ParamCounter = { value: 0 };
  return translateStmts(expressions, indexCounter, paramCounter);
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
 * const compiled = [["x", "y"], "$[0]+$[1]", "$[1]*2"]
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
    const functionBody = buildEvaluatorFunctionBody(expressions, variableNames.length);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    evaluator = new Function("$", functionBody) as (values: unknown[]) => unknown;
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
 * @param expressions - 表达式列表（可包含控制流节点和 FnNode）
 * @param variableCount - 变量数量
 * @returns 函数体字符串
 */
function buildEvaluatorFunctionBody(expressions: CompiledExpression[], variableCount: number): string {
  if (expressions.length === 0) throw new Error("No expressions to evaluate");

  return translateControlFlow(expressions, variableCount);
}
