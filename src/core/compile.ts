import { getVariableId } from "../api/variable";
import { getProxyMetadata } from "../proxy/proxy-metadata";
import { serializeArgumentToAST } from "../proxy/proxy-variable";
import type { BranchNode, CompiledData, CompiledExpression, ExprValue, FnNode, JumpNode, PhiNode } from "../types";
import type { ASTNode } from "../types/ast-types";
import { generate } from "./generate";

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

interface RewriteScope {
  placeholderNames: ReadonlyMap<symbol, string>;
  deferredAsts?: ReadonlyMap<string, ASTNode>;
  deferredIndexMap?: ReadonlyMap<string, number>;
  onDeferredReference?: (name: string) => number;
  undefinedVars?: string[];
  shadowedNames?: ReadonlySet<string>;
}

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
  /** 顶层 rewrite 作用域 */
  baseScope: RewriteScope;
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
  // 提取推迟编译的子表达式（因引用计数 >1 未内联）
  let deferredAsts: Map<string, ASTNode> | undefined;
  if ((typeof expression === "object" || typeof expression === "function") && expression !== null) {
    const meta = getProxyMetadata(expression);
    deferredAsts = meta?.deferredAsts;
  }

  const ast = serializeArgumentToAST(expression);

  // 建立变量名到索引的映射
  const variableOrder: string[] = [];
  const variableToIndex = new Map<string, number>();
  const placeholderNames = new Map<symbol, string>();

  for (const [name, value] of Object.entries(variables)) {
    if (!variableToIndex.has(name)) {
      const index = variableOrder.length;
      variableToIndex.set(name, index);
      variableOrder.push(name);
    }
    const id = getVariableId(value);
    if (id) {
      placeholderNames.set(id, `$[${variableToIndex.get(name)!}]`);
    }
  }

  // 生成编译后的表达式（短路求值总是启用）
  const topLevelExprs: CompiledExpression[] = [];
  const baseScope: RewriteScope = {
    placeholderNames,
  };
  const ctx: CompileCtx = {
    nextParamIndex: 0,
    expressionStack: [topLevelExprs],
    nextIndex: variableOrder.length,
    variableCount: variableOrder.length,
    baseScope,
  };

  // 先编译所有 deferred 子表达式，获得其索引映射
  const deferredIndexMap = new Map<string, number>();
  if (deferredAsts && deferredAsts.size > 0) {
    compileDeferredExprs(deferredAsts, ctx, baseScope, deferredIndexMap);
  }

  const undefinedVars: string[] = [];
  const transformed = rewriteAstForCompile(ast, {
    ...baseScope,
    deferredIndexMap,
    undefinedVars,
  });

  if (undefinedVars.length > 0) {
    throw new Error(`Undefined variable(s): ${[...new Set(undefinedVars)].join(", ")}`);
  }

  compileAst(transformed, ctx, baseScope);

  return [variableOrder, ...topLevelExprs];
}

/**
 * 获取当前表达式列表
 */
function currentExprs(ctx: CompileCtx): CompiledExpression[] {
  return ctx.expressionStack[ctx.expressionStack.length - 1]!;
}

/**
 * 编译推迟的子表达式（因引用计数 >1 未内联）
 * 使用递归处理，自动按依赖拓扑顺序编译
 */
function compileDeferredExprs(
  deferredAsts: Map<string, ASTNode>,
  ctx: CompileCtx,
  baseScope: RewriteScope,
  deferredIndexMap: Map<string, number>
): void {
  const processing = new Set<string>();

  function compileOne(name: string): number {
    if (processing.has(name)) {
      throw new Error(`Circular reference in deferred expressions: ${name}`);
    }
    const existing = deferredIndexMap.get(name);
    if (existing !== undefined) return existing;

    const ast = deferredAsts.get(name);
    if (!ast) throw new Error(`Unknown deferred expression: ${name}`);

    processing.add(name);

    const undefinedVars: string[] = [];
    const transformed = rewriteAstForCompile(ast, {
      ...baseScope,
      deferredAsts,
      deferredIndexMap,
      onDeferredReference: compileOne,
      undefinedVars,
    });

    if (undefinedVars.length > 0) {
      throw new Error(
        `Undefined variable(s) in deferred expression "${name}": ${[...new Set(undefinedVars)].join(", ")}`
      );
    }

    const idx = compileAst(transformed, ctx, baseScope);
    deferredIndexMap.set(name, idx);
    processing.delete(name);
    return idx;
  }

  for (const name of deferredAsts.keys()) {
    compileOne(name);
  }
}

function rewriteAstForCompile(node: ASTNode, scope: RewriteScope): ASTNode {
  switch (node.type) {
    case "Placeholder": {
      const name = scope.placeholderNames.get(node.id);
      return name ? { type: "Identifier", name } : node;
    }

    case "Identifier": {
      if (scope.shadowedNames?.has(node.name)) {
        return node;
      }

      const resolved = resolveIdentifierName(node.name, scope);
      return resolved === node.name ? node : { ...node, name: resolved };
    }

    case "BinaryExpr": {
      const left = rewriteAstForCompile(node.left, scope);
      const right = rewriteAstForCompile(node.right, scope);
      return left === node.left && right === node.right ? node : { ...node, left, right };
    }

    case "UnaryExpr": {
      const argument = rewriteAstForCompile(node.argument, scope);
      return argument === node.argument ? node : { ...node, argument };
    }

    case "ConditionalExpr": {
      const test = rewriteAstForCompile(node.test, scope);
      const consequent = rewriteAstForCompile(node.consequent, scope);
      const alternate = rewriteAstForCompile(node.alternate, scope);
      return test === node.test && consequent === node.consequent && alternate === node.alternate
        ? node
        : { ...node, test, consequent, alternate };
    }

    case "MemberExpr": {
      const object = rewriteAstForCompile(node.object, scope);
      const property = node.computed ? rewriteAstForCompile(node.property, scope) : node.property;
      return object === node.object && property === node.property ? node : { ...node, object, property };
    }

    case "CallExpr": {
      const callee = rewriteAstForCompile(node.callee, scope);
      const arguments_ = mapAstNodes(node.arguments, (arg) => rewriteAstForCompile(arg, scope));
      return callee === node.callee && arguments_ === node.arguments
        ? node
        : { ...node, callee, arguments: arguments_ };
    }

    case "ArrayExpr": {
      const elements = mapAstNodes(node.elements, (el) => rewriteAstForCompile(el, scope));
      return elements === node.elements ? node : { ...node, elements };
    }

    case "ObjectExpr": {
      const properties = mapObjectProperties(node.properties, (prop) => {
        const key = prop.computed ? rewriteAstForCompile(prop.key, scope) : prop.key;
        const value = rewriteAstForCompile(prop.value, scope);
        return key === prop.key && value === prop.value ? prop : { ...prop, key, value };
      });
      return properties === node.properties ? node : { ...node, properties };
    }

    case "ArrowFunctionExpr":
      return node;

    default:
      return node;
  }
}

function resolveIdentifierName(name: string, scope: RewriteScope): string {
  if (/^\$\[\d+\]$/.test(name) || /^_\d+$/.test(name)) {
    return name;
  }

  const deferredIdx = scope.deferredIndexMap?.get(name);
  if (deferredIdx !== undefined) return `$[${deferredIdx}]`;

  if (scope.deferredAsts?.has(name) && scope.onDeferredReference) {
    return `$[${scope.onDeferredReference(name)}]`;
  }

  if (!ALLOWED_GLOBALS.has(name)) {
    scope.undefinedVars?.push(name);
  }
  return name;
}

function extendShadowedNames(
  shadowedNames: ReadonlySet<string> | undefined,
  names: string[]
): ReadonlySet<string> | undefined {
  if (names.length === 0) {
    return shadowedNames;
  }

  return new Set([...(shadowedNames ?? []), ...names]);
}

function mapAstNodes<T extends ASTNode>(nodes: T[], transform: (node: T) => T): T[] {
  let result: T[] | undefined;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const transformed = transform(node);

    if (result) {
      result.push(transformed);
      continue;
    }

    if (transformed !== node) {
      result = nodes.slice(0, i);
      result.push(transformed);
    }
  }

  return result ?? nodes;
}

function mapObjectProperties<T>(properties: T[], transform: (property: T) => T): T[] {
  let result: T[] | undefined;

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i]!;
    const transformed = transform(property);

    if (result) {
      result.push(transformed);
      continue;
    }

    if (transformed !== property) {
      result = properties.slice(0, i);
      result.push(transformed);
    }
  }

  return result ?? properties;
}

/**
 * 提取 AST 中所有 ArrowFunctionExpr 节点，编译为 FnNode，
 * 并将原始位置替换为 $[N] 标识符引用。
 */
function compileAst(node: ASTNode, ctx: CompileCtx, scope: RewriteScope): number {
  if (node.type === "BinaryExpr" && (node.operator === "||" || node.operator === "&&" || node.operator === "??")) {
    return compileShortCircuit(node, ctx, scope);
  }
  if (node.type === "ConditionalExpr") {
    return compileConditional(node, ctx, scope);
  }
  if (node.type === "ArrowFunctionExpr") {
    return compileArrowFunction(node, ctx, scope);
  }

  const exprStr = generate(node, {
    rewriteNode: (current) => {
      if (current.type !== "ArrowFunctionExpr") return current;
      const idx = compileArrowFunction(current, ctx, scope);
      return { type: "Identifier", name: `$[${idx}]` };
    },
  });
  currentExprs(ctx).push(exprStr);
  return ctx.nextIndex++;
}

function compileShortCircuit(node: ASTNode & { type: "BinaryExpr" }, ctx: CompileCtx, scope: RewriteScope): number {
  const exprs = currentExprs(ctx);
  const leftIdx = compileAst(node.left, ctx, scope);

  const condition = BRANCH_CONDITIONS[node.operator]?.(leftIdx);
  if (!condition) {
    throw new Error(`Unexpected operator: ${node.operator}`);
  }

  const branchIdx = exprs.length;
  exprs.push(["br", condition, 0] as BranchNode);
  ctx.nextIndex++;

  compileAst(node.right, ctx, scope);
  const skipCount = exprs.length - branchIdx - 1;
  (exprs[branchIdx] as BranchNode)[2] = skipCount;

  const phiIdx = ctx.nextIndex++;
  exprs.push(["phi"] as PhiNode);

  return phiIdx;
}

function compileConditional(node: ASTNode & { type: "ConditionalExpr" }, ctx: CompileCtx, scope: RewriteScope): number {
  const exprs = currentExprs(ctx);
  const testIdx = compileAst(node.test, ctx, scope);

  const branchIdx = exprs.length;
  exprs.push(["br", `$[${testIdx}]`, 0] as BranchNode);
  ctx.nextIndex++;

  compileAst(node.alternate, ctx, scope);

  const jmpIdx = exprs.length;
  exprs.push(["jmp", 0] as JumpNode);
  ctx.nextIndex++;

  compileAst(node.consequent, ctx, scope);
  const thenEndIdx = exprs.length;

  (exprs[branchIdx] as BranchNode)[2] = jmpIdx - branchIdx;
  (exprs[jmpIdx] as JumpNode)[1] = thenEndIdx - jmpIdx - 1;

  const phiIdx = ctx.nextIndex++;
  exprs.push(["phi"] as PhiNode);

  return phiIdx;
}

function compileArrowFunction(
  node: ASTNode & { type: "ArrowFunctionExpr" },
  ctx: CompileCtx,
  scope: RewriteScope
): number {
  // 为这个 FnNode 分配全局索引
  const fnIndex = ctx.nextIndex++;

  // 为参数分配 _N 名称
  const placeholderNames = new Map(scope.placeholderNames);
  const shadowedNames: string[] = [];
  for (const param of node.params) {
    if (param.type === "Placeholder") {
      placeholderNames.set(param.id, `_${ctx.nextParamIndex++}`);
    } else {
      shadowedNames.push(param.name);
    }
  }

  const lambdaScope: RewriteScope = {
    ...scope,
    placeholderNames,
    shadowedNames: extendShadowedNames(scope.shadowedNames, shadowedNames),
  };

  const transformedBody = rewriteAstForCompile(node.body, lambdaScope);

  // 编译函数体到新的表达式列表
  const lambdaStmts: CompiledExpression[] = [];
  ctx.expressionStack.push(lambdaStmts);
  compileAst(transformedBody, ctx, lambdaScope);
  ctx.expressionStack.pop();

  // 构造 FnNode
  const fnNode: FnNode = ["fn", node.params.length, ...lambdaStmts];
  currentExprs(ctx).push(fnNode);

  return fnIndex;
}
