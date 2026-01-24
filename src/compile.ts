import { generate, transformIdentifiers, type ASTNode } from "./parser";
import { serializeArgumentToAST } from "./proxy-variable";
import type { BranchNode, CompiledData, CompiledExpression, JumpNode, LambdaBodyResult, PhiNode } from "./types";
import { getVariableId } from "./variable";

const ALLOWED_GLOBALS = new Set([
  "Math",
  "JSON",
  "Date",
  "RegExp",
  "Number",
  "String",
  "Boolean",
  "Array",
  "Object",
  "undefined",
  "NaN",
  "Infinity",
  "isNaN",
  "isFinite",
  "parseInt",
  "parseFloat",
  "BigInt",
  "URL",
  "URLSearchParams",
  "Map",
  "Set",
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
  "ArrayBuffer",
  "DataView",
]);

/**
 * 编译选项
 */
export interface CompileOptions {
  /**
   * 是否启用短路求值
   * 为 &&, ||, ??, 和三元表达式生成控制流节点
   * @default true
   */
  shortCircuit?: boolean;
}

/**
 * 将 Proxy Expression 编译为可序列化的 JSON 结构
 *
 * @template TResult - 表达式结果类型
 * @param expression - Proxy Expression，或包含 Proxy 的对象/数组/原始值
 * @param variables - 所有使用的变量定义
 * @param options - 编译选项
 * @returns 编译后的数据结构 [变量名列表, 表达式1, 表达式2, ...]
 *
 * @throws 如果传入无效的表达式或未定义的变量引用
 *
 * @example
 * ```ts
 * const x = variable<number>()
 * const y = variable<number>()
 * const sum = expr({ x, y })("x + y")
 * const result = expr({ sum, x })("sum * x")
 * const compiled = compile(result, { x, y })
 * // => [["x", "y"], "($0+$1)*$0"]
 * ```
 */
export function compile<TResult>(
  expression: LambdaBodyResult<TResult>,
  variables: Record<string, unknown>,
  options: CompileOptions = {}
): CompiledData {
  const { shortCircuit = true } = options;

  const ast = serializeArgumentToAST(expression);

  // 建立变量名到索引的映射
  const variableOrder: string[] = [];
  const variableToIndex = new Map<string, number>();
  const descToName = new Map<string, string>();

  for (const [name, value] of Object.entries(variables)) {
    if (!variableToIndex.has(name)) {
      variableToIndex.set(name, variableOrder.length);
      variableOrder.push(name);
    }
    const id = getVariableId(value);
    if (id?.description) {
      descToName.set(id.description, name);
    }
  }

  // 转换 AST：将占位符替换为变量名，然后替换为 $N
  const undefinedVars: string[] = [];
  const transformed = transformIdentifiers(ast, (name) => {
    const placeholderMatch = name.match(/^\$\$VAR_(.+)\$\$$/);
    const resolvedName = placeholderMatch ? descToName.get(placeholderMatch[1]!) : name;

    if (placeholderMatch && !resolvedName) throw new Error(`Unknown variable placeholder: ${name}`);

    const index = variableToIndex.get(resolvedName!);
    if (index !== undefined) return `$${index}`;

    if (!ALLOWED_GLOBALS.has(resolvedName!)) undefinedVars.push(resolvedName!);
    return resolvedName!;
  });

  if (undefinedVars.length > 0) {
    const uniqueVars = [...new Set(undefinedVars)];
    throw new Error(`Undefined variable(s): ${uniqueVars.join(", ")}`);
  }

  // 生成编译后的表达式
  const expressions: CompiledExpression[] = [];

  if (shortCircuit) {
    let nextIndex = variableOrder.length;

    function compileAst(node: ASTNode): number {
      if (node.type === "BinaryExpr" && (node.operator === "||" || node.operator === "&&" || node.operator === "??")) {
        return compileShortCircuit(node);
      }
      if (node.type === "ConditionalExpr") {
        return compileConditional(node);
      }
      const exprStr = generate(node);
      expressions.push(exprStr);
      return nextIndex++;
    }

    function compileShortCircuit(node: ASTNode & { type: "BinaryExpr" }): number {
      const leftIdx = compileAst(node.left);

      const branchConditions: Record<string, string> = {
        "||": `$${leftIdx}`,
        "&&": `!$${leftIdx}`,
        "??": `$${leftIdx}!=null`,
      };

      const branchIdx = expressions.length;
      expressions.push(["br", branchConditions[node.operator], 0] as BranchNode);
      nextIndex++;

      compileAst(node.right);
      const skipCount = expressions.length - branchIdx - 1;
      (expressions[branchIdx] as BranchNode)[2] = skipCount;

      const phiIdx = nextIndex++;
      expressions.push(["phi"] as PhiNode);

      return phiIdx;
    }

    function compileConditional(node: ASTNode & { type: "ConditionalExpr" }): number {
      const testIdx = compileAst(node.test);

      const branchIdx = expressions.length;
      expressions.push(["br", `$${testIdx}`, 0] as BranchNode);
      nextIndex++;

      compileAst(node.alternate);

      const jmpIdx = expressions.length;
      expressions.push(["jmp", 0] as JumpNode);
      nextIndex++;

      compileAst(node.consequent);
      const thenEndIdx = expressions.length;

      (expressions[branchIdx] as BranchNode)[2] = jmpIdx - branchIdx;
      (expressions[jmpIdx] as JumpNode)[1] = thenEndIdx - jmpIdx - 1;

      const phiIdx = nextIndex++;
      expressions.push(["phi"] as PhiNode);

      return phiIdx;
    }

    compileAst(transformed);
  } else {
    expressions.push(generate(transformed));
  }

  return [variableOrder, ...expressions];
}
