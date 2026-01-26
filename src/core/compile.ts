import { getVariableId } from "../api/variable";
import { serializeArgumentToAST } from "../proxy/proxy-variable";
import type { BranchNode, CompiledData, CompiledExpression, ExprValue, FnNode, JumpNode, PhiNode } from "../types";
import type { ASTNode } from "../types/ast-types";
import { generate, transformIdentifiers, transformPlaceholders } from "./generate";

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
 * 短路运算符对应的分支条件
 */
const BRANCH_CONDITIONS: Record<string, (idx: number) => string> = {
  "||": (idx) => `$[${idx}]`,
  "&&": (idx) => `!$[${idx}]`,
  "??": (idx) => `$[${idx}]!=null`,
};

/**
 * 编译选项
 */
export interface CompileOptions {}

/**
 * 编译上下文（用于 lambda 参数分配）
 */
interface CompileCtx {
  /** 下一个可用的参数名索引（全局递增） */
  nextParamIndex: number;
  /** 当前正在编译的表达式列表（栈顶为当前 lambda 或顶层） */
  expressionStack: CompiledExpression[][];
  /** 下一个全局表达式索引 */
  nextIndex: number;
  /** 变量数量（用于索引偏移） */
  variableCount: number;
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
 * // => [["x", "y"], "($[0]+$[1])*$[0]"]
 * ```
 */
export function compile<TResult>(
  expression: ExprValue<TResult>,
  variables: Record<string, unknown>,
  _options: CompileOptions = {}
): CompiledData {
  const ast = serializeArgumentToAST(expression);

  // 建立变量名到索引的映射
  const variableOrder: string[] = [];
  const variableToIndex = new Map<string, number>();
  const symbolToName = new Map<symbol, string>();

  for (const [name, value] of Object.entries(variables)) {
    if (!variableToIndex.has(name)) {
      const index = variableOrder.length;
      variableToIndex.set(name, index);
      variableOrder.push(name);
    }
    const id = getVariableId(value);
    if (id) {
      symbolToName.set(id, name);
    }
  }

  // 转换 Placeholder 节点为 $[N] 格式的 Identifier
  const placeholderTransformed = transformPlaceholders(ast, (id) => {
    const name = symbolToName.get(id);
    if (!name) return null; // 不是变量占位符（可能是 lambda 参数），保留
    const index = variableToIndex.get(name);
    return index !== undefined ? `$[${index}]` : null;
  });

  // 检查是否有未定义的 Identifier（非全局对象）
  const undefinedVars: string[] = [];
  const transformed = transformIdentifiers(placeholderTransformed, (name) => {
    // 已经转换为 $[N] 的跳过
    if (/^\$\[\d+\]$/.test(name)) return name;

    // lambda 参数名 _N 跳过
    if (/^_\d+$/.test(name)) return name;

    const index = variableToIndex.get(name);
    if (index !== undefined) return `$[${index}]`;

    if (!ALLOWED_GLOBALS.has(name)) undefinedVars.push(name);
    return name;
  });

  if (undefinedVars.length > 0) {
    throw new Error(`Undefined variable(s): ${[...new Set(undefinedVars)].join(", ")}`);
  }

  // 生成编译后的表达式（短路求值总是启用）
  const topLevelExprs: CompiledExpression[] = [];
  const ctx: CompileCtx = {
    nextParamIndex: 0,
    expressionStack: [topLevelExprs],
    nextIndex: variableOrder.length,
    variableCount: variableOrder.length,
  };

  compileAst(transformed, ctx);

  return [variableOrder, ...topLevelExprs];
}

/**
 * 获取当前表达式列表
 */
function currentExprs(ctx: CompileCtx): CompiledExpression[] {
  return ctx.expressionStack[ctx.expressionStack.length - 1]!;
}

/**
 * 提取 AST 中所有 ArrowFunctionExpr 节点，编译为 FnNode，
 * 并将原始位置替换为 $[N] 标识符引用。
 */
function extractAndCompileArrowFunctions(node: ASTNode, ctx: CompileCtx): ASTNode {
  switch (node.type) {
    case "ArrowFunctionExpr": {
      const idx = compileArrowFunction(node, ctx);
      return { type: "Identifier", name: `$[${idx}]` };
    }

    case "BinaryExpr":
      return {
        ...node,
        left: extractAndCompileArrowFunctions(node.left, ctx),
        right: extractAndCompileArrowFunctions(node.right, ctx),
      };

    case "UnaryExpr":
      return { ...node, argument: extractAndCompileArrowFunctions(node.argument, ctx) };

    case "ConditionalExpr":
      return {
        ...node,
        test: extractAndCompileArrowFunctions(node.test, ctx),
        consequent: extractAndCompileArrowFunctions(node.consequent, ctx),
        alternate: extractAndCompileArrowFunctions(node.alternate, ctx),
      };

    case "MemberExpr":
      return {
        ...node,
        object: extractAndCompileArrowFunctions(node.object, ctx),
        property: node.computed ? extractAndCompileArrowFunctions(node.property, ctx) : node.property,
      };

    case "CallExpr":
      return {
        ...node,
        callee: extractAndCompileArrowFunctions(node.callee, ctx),
        arguments: node.arguments.map((arg) => extractAndCompileArrowFunctions(arg, ctx)),
      };

    case "ArrayExpr":
      return { ...node, elements: node.elements.map((el) => extractAndCompileArrowFunctions(el, ctx)) };

    case "ObjectExpr":
      return {
        ...node,
        properties: node.properties.map((prop) => ({
          ...prop,
          key: prop.computed ? extractAndCompileArrowFunctions(prop.key, ctx) : prop.key,
          value: extractAndCompileArrowFunctions(prop.value, ctx),
        })),
      };

    default:
      return node;
  }
}

function compileAst(node: ASTNode, ctx: CompileCtx): number {
  if (node.type === "BinaryExpr" && (node.operator === "||" || node.operator === "&&" || node.operator === "??")) {
    return compileShortCircuit(node, ctx);
  }
  if (node.type === "ConditionalExpr") {
    return compileConditional(node, ctx);
  }
  if (node.type === "ArrowFunctionExpr") {
    return compileArrowFunction(node, ctx);
  }

  // 提取并编译嵌套的箭头函数，替换为 $[N] 引用
  const processed = extractAndCompileArrowFunctions(node, ctx);

  const exprStr = generate(processed);
  currentExprs(ctx).push(exprStr);
  return ctx.nextIndex++;
}

function compileShortCircuit(node: ASTNode & { type: "BinaryExpr" }, ctx: CompileCtx): number {
  const exprs = currentExprs(ctx);
  const leftIdx = compileAst(node.left, ctx);

  const condition = BRANCH_CONDITIONS[node.operator]?.(leftIdx);
  if (!condition) {
    throw new Error(`Unexpected operator: ${node.operator}`);
  }

  const branchIdx = exprs.length;
  exprs.push(["br", condition, 0] as BranchNode);
  ctx.nextIndex++;

  compileAst(node.right, ctx);
  const skipCount = exprs.length - branchIdx - 1;
  (exprs[branchIdx] as BranchNode)[2] = skipCount;

  const phiIdx = ctx.nextIndex++;
  exprs.push(["phi"] as PhiNode);

  return phiIdx;
}

function compileConditional(node: ASTNode & { type: "ConditionalExpr" }, ctx: CompileCtx): number {
  const exprs = currentExprs(ctx);
  const testIdx = compileAst(node.test, ctx);

  const branchIdx = exprs.length;
  exprs.push(["br", `$[${testIdx}]`, 0] as BranchNode);
  ctx.nextIndex++;

  compileAst(node.alternate, ctx);

  const jmpIdx = exprs.length;
  exprs.push(["jmp", 0] as JumpNode);
  ctx.nextIndex++;

  compileAst(node.consequent, ctx);
  const thenEndIdx = exprs.length;

  (exprs[branchIdx] as BranchNode)[2] = jmpIdx - branchIdx;
  (exprs[jmpIdx] as JumpNode)[1] = thenEndIdx - jmpIdx - 1;

  const phiIdx = ctx.nextIndex++;
  exprs.push(["phi"] as PhiNode);

  return phiIdx;
}

function compileArrowFunction(node: ASTNode & { type: "ArrowFunctionExpr" }, ctx: CompileCtx): number {
  // 为这个 FnNode 分配全局索引
  const fnIndex = ctx.nextIndex++;

  // 为参数分配 _N 名称
  const paramMapping = new Map<symbol, string>();
  for (const param of node.params) {
    if (param.type === "Placeholder") {
      paramMapping.set(param.id, `_${ctx.nextParamIndex++}`);
    }
  }

  // 将函数体中的 lambda 参数 Placeholder 转换为 _N 标识符
  const transformedBody = transformPlaceholders(node.body, (id) => paramMapping.get(id) ?? null);

  // 编译函数体到新的表达式列表
  const lambdaStmts: CompiledExpression[] = [];
  ctx.expressionStack.push(lambdaStmts);
  compileAst(transformedBody, ctx);
  ctx.expressionStack.pop();

  // 构造 FnNode
  const fnNode: FnNode = ["fn", node.params.length, ...lambdaStmts];
  currentExprs(ctx).push(fnNode);

  return fnIndex;
}
