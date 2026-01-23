import { z } from "zod";
import { collectIdentifiers, generate, parse, type ASTNode } from "./parser";
import type {
  BranchNode,
  CompileContext,
  CompiledData,
  CompiledExpression,
  Expression,
  ExprNode,
  JumpNode,
  PhiNode,
  Variable,
} from "./types";

/**
 * 编译选项
 */
export interface CompileOptions {
  /**
   * 是否启用内联优化
   * 将只被引用一次的子表达式内联到使用位置
   * @default true
   */
  inline?: boolean;

  /**
   * 是否启用短路求值
   * 为 &&, ||, ??, 和三元表达式生成控制流节点
   * @default true
   */
  shortCircuit?: boolean;
}

/**
 * 表达式上下文类型约束
 */
type ExpressionContext = Record<string, Variable<z.ZodType> | Expression<Record<string, unknown>, unknown>>;

/**
 * 将表达式树编译为可序列化的 JSON 结构
 *
 * @template TResult - 表达式结果类型
 * @param expression - 根表达式
 * @param variables - 所有使用的变量定义
 * @param options - 编译选项
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
 * // => [["x", "y"], "($0+$1)*2"]  // 内联优化后
 * ```
 */
export function compile<TResult>(
  expression: Expression<ExpressionContext, TResult>,
  variables: Record<string, Variable<z.ZodType>>,
  options: CompileOptions = {}
): CompiledData {
  const { inline = true, shortCircuit = true } = options;
  // 创建编译上下文
  const context: CompileContext = {
    variableOrder: [],
    nodeToIndex: new Map(),
    expressions: [],
  };

  // 第一步：为每个表达式分配唯一 ID
  const exprIdMap = new WeakMap<Expression<Record<string, unknown>, unknown>, symbol>();
  const getExprId = (expr: Expression<Record<string, unknown>, unknown>): symbol => {
    if (!exprIdMap.has(expr)) {
      exprIdMap.set(expr, Symbol("expr"));
    }
    const id = exprIdMap.get(expr);
    if (id === undefined) {
      throw new Error("Expression ID not found");
    }
    return id;
  };

  // 为所有变量创建 node
  const nodeMap = new Map<symbol, ExprNode>();
  const variableNodes = new Map<string, ExprNode>();
  const visited = new Set<symbol>();
  const visiting = new Set<symbol>();

  for (const [name, variable] of Object.entries(variables)) {
    const id = Symbol(`var:${name}`);
    const node: ExprNode = {
      id,
      tag: "variable",
      schema: variable.schema,
    };
    nodeMap.set(id, node);
    variableNodes.set(name, node);
  }

  // 第二步：递归收集所有依赖的节点，并检测循环依赖
  const exprNodes = new Map<symbol, ExprNode>();
  const collectNodes = (expr: Expression<Record<string, unknown>, unknown>): ExprNode => {
    const exprId = getExprId(expr);

    if (visited.has(exprId)) {
      return nodeMap.get(exprId)!;
    }

    if (visiting.has(exprId)) {
      throw new Error("Circular dependency detected in expressions");
    }

    visiting.add(exprId);

    const contextNodes: Record<string, ExprNode> = {};

    // 收集表达式上下文中的所有节点
    for (const [key, contextItem] of Object.entries(expr.context)) {
      const item = contextItem as Variable<z.ZodType> | Expression<Record<string, unknown>, unknown>;
      if (item._tag === "variable") {
        const varNode = variableNodes.get(key);
        if (!varNode) {
          throw new Error(`Undefined variable reference: ${key}`);
        }
        contextNodes[key] = varNode;
      } else if (item._tag === "expression") {
        contextNodes[key] = collectNodes(item);
      }
    }

    const node: ExprNode = {
      id: exprId,
      tag: "expression",
      context: contextNodes,
      source: expr.source,
    };

    nodeMap.set(exprId, node);
    exprNodes.set(exprId, node);
    visited.add(exprId);
    visiting.delete(exprId);

    return node;
  };

  // 收集根表达式的所有节点
  const rootNode = collectNodes(expression);

  // 第三步：拓扑排序，确保依赖的节点在前
  const sortedExprNodes: ExprNode[] = [];
  const exprVisited = new Set<symbol>();

  const topologicalSort = (node: ExprNode) => {
    if (exprVisited.has(node.id)) {
      return;
    }

    exprVisited.add(node.id);

    if (node.tag === "expression" && node.context) {
      for (const contextNode of Object.values(node.context)) {
        topologicalSort(contextNode);
      }
    }

    if (node.tag === "expression") {
      sortedExprNodes.push(node);
    }
  };

  topologicalSort(rootNode);

  // 第四步：分配变量索引 0 ~ N-1
  for (const [name, varNode] of variableNodes.entries()) {
    if (!context.nodeToIndex.has(varNode.id)) {
      context.nodeToIndex.set(varNode.id, context.variableOrder.length);
      context.variableOrder.push(name);
    }
  }

  // 第五步：计算每个表达式节点的引用次数
  const refCount = new Map<symbol, number>();
  for (const exprNode of sortedExprNodes) {
    refCount.set(exprNode.id, 0);
  }

  for (const exprNode of sortedExprNodes) {
    if (exprNode.context) {
      for (const contextNode of Object.values(exprNode.context)) {
        if (contextNode.tag === "expression") {
          refCount.set(contextNode.id, (refCount.get(contextNode.id) ?? 0) + 1);
        }
      }
    }
  }

  // 判断哪些表达式可以内联（只被引用一次且不是根节点）
  const canInline = (node: ExprNode): boolean => {
    if (!inline) return false;
    if (node.id === rootNode.id) return false; // 根节点不能内联
    return (refCount.get(node.id) ?? 0) === 1;
  };

  // 第六步：为所有不能内联的表达式分配索引
  let exprIndex = 0;
  for (const exprNode of sortedExprNodes) {
    if (!canInline(exprNode)) {
      const index = context.variableOrder.length + exprIndex;
      context.nodeToIndex.set(exprNode.id, index);
      exprIndex++;
    }
  }

  // 第七步：为每个表达式生成 AST，并根据内联选项处理
  const nodeAstMap = new Map<symbol, ASTNode>();

  // 为变量生成 AST（始终是 $N 标识符）
  for (const [, varNode] of variableNodes.entries()) {
    const index = context.nodeToIndex.get(varNode.id)!;
    nodeAstMap.set(varNode.id, { type: "Identifier", name: `$${index}` });
  }

  // 为每个表达式生成 AST（按拓扑顺序，确保依赖的节点已处理）
  for (const exprNode of sortedExprNodes) {
    if (!exprNode.context || !exprNode.source) {
      throw new Error("Invalid expression node");
    }

    // 检查表达式源码中是否引用了未定义的变量
    const usedVariables = extractVariableNames(exprNode.source);
    for (const varName of usedVariables) {
      if (!(varName in exprNode.context)) {
        throw new Error(
          `Undefined variable reference: ${varName} (available: ${Object.keys(exprNode.context).join(", ")})`
        );
      }
    }

    // 解析表达式为 AST
    const ast = parse(exprNode.source);

    // 转换标识符：将上下文中的名称替换为对应的 AST 节点
    const transformed = inlineTransform(ast, (name) => {
      const contextNode = exprNode.context![name];
      if (!contextNode) return null;

      if (contextNode.tag === "variable") {
        // 变量始终替换为 $N
        return nodeAstMap.get(contextNode.id) ?? null;
      } else {
        // 表达式节点：如果可内联，返回其 AST；否则返回 $N
        if (canInline(contextNode)) {
          return nodeAstMap.get(contextNode.id) ?? null;
        } else {
          const index = context.nodeToIndex.get(contextNode.id)!;
          return { type: "Identifier", name: `$${index}` } as ASTNode;
        }
      }
    });

    nodeAstMap.set(exprNode.id, transformed);
  }

  // 第八步：生成最终表达式列表
  if (shortCircuit) {
    // 短路求值模式：为每个不能内联的表达式生成控制流指令
    const expressions: CompiledExpression[] = [];
    let nextIndex = context.variableOrder.length;

    // 用于追踪已经编译过的节点
    const compiledNodeIndices = new Map<symbol, number>();

    // 编译单个 AST 节点到指令序列，返回结果所在的索引
    const compileAst = (ast: ASTNode): number => {
      // 检查是否需要短路处理
      if (ast.type === "BinaryExpr" && (ast.operator === "||" || ast.operator === "&&" || ast.operator === "??")) {
        return compileShortCircuit(ast);
      }

      if (ast.type === "ConditionalExpr") {
        return compileConditional(ast);
      }

      // 普通表达式：直接生成
      const exprStr = generate(ast);
      const idx = nextIndex++;
      expressions.push(exprStr);
      return idx;
    };

    // 编译短路运算符 (&&, ||, ??)
    const compileShortCircuit = (node: ASTNode & { type: "BinaryExpr" }): number => {
      // 递归编译左操作数
      const leftIdx = compileAst(node.left);

      // 生成跳转条件
      let branchCondition: string;
      if (node.operator === "||") {
        // || : 如果左边为 true，跳过右边
        branchCondition = `$${leftIdx}`;
      } else if (node.operator === "&&") {
        // && : 如果左边为 false，跳过右边
        branchCondition = `!$${leftIdx}`;
      } else {
        // ?? : 如果左边非 null/undefined，跳过右边
        branchCondition = `$${leftIdx}!=null`;
      }

      // 记录 br 指令的位置，稍后填入正确的 offset
      const branchIdx = expressions.length;
      expressions.push(["br", branchCondition, 0] as BranchNode); // 占位，offset 稍后修复
      nextIndex++;

      // 递归编译右操作数
      compileAst(node.right);

      // 修复 br 的 offset：跳过右操作数的所有指令
      const skipCount = expressions.length - branchIdx - 1;
      (expressions[branchIdx] as BranchNode)[2] = skipCount;

      // 生成 phi 节点
      const phiIdx = nextIndex++;
      expressions.push(["phi"] as PhiNode);

      return phiIdx;
    };

    // 编译三元表达式
    const compileConditional = (node: ASTNode & { type: "ConditionalExpr" }): number => {
      // 编译条件
      const testIdx = compileAst(node.test);

      // 生成条件跳转：如果条件为 true，跳到 then 分支
      // 但在我们的布局中，else 分支在前，then 分支在后
      // 所以：如果条件为 true，跳过 else 分支
      const branchIdx = expressions.length;
      expressions.push(["br", `$${testIdx}`, 0] as BranchNode); // 占位
      nextIndex++;

      // 编译 else 分支（alternate）
      compileAst(node.alternate);

      // 生成 jmp 跳过 then 分支
      const jmpIdx = expressions.length;
      expressions.push(["jmp", 0] as JumpNode); // 占位
      nextIndex++;

      // 编译 then 分支（consequent）
      compileAst(node.consequent);
      const thenEndIdx = expressions.length;

      // 修复 br 的 offset：跳过 else 分支和 jmp 指令
      (expressions[branchIdx] as BranchNode)[2] = jmpIdx - branchIdx;

      // 修复 jmp 的 offset：跳过 then 分支
      (expressions[jmpIdx] as JumpNode)[1] = thenEndIdx - jmpIdx - 1;

      // 生成 phi 节点
      const phiIdx = nextIndex++;
      expressions.push(["phi"] as PhiNode);

      return phiIdx;
    };

    // 为每个不能内联的表达式生成指令
    for (const exprNode of sortedExprNodes) {
      if (!canInline(exprNode)) {
        const ast = nodeAstMap.get(exprNode.id)!;
        const resultIdx = compileAst(ast);
        compiledNodeIndices.set(exprNode.id, resultIdx);
      }
    }

    context.expressions = expressions;
  } else {
    // 原始模式：直接生成表达式字符串
    for (const exprNode of sortedExprNodes) {
      if (!canInline(exprNode)) {
        const ast = nodeAstMap.get(exprNode.id)!;
        context.expressions.push(generate(ast));
      }
    }
  }

  // 第九步：组合结果
  const result: CompiledData = [context.variableOrder, ...context.expressions];

  return result;
}

/**
 * 将 AST 中的标识符替换为对应的 AST 节点（用于内联优化）
 *
 * @param node - 要转换的 AST 节点
 * @param getReplacementAst - 根据标识符名称返回替换的 AST 节点，返回 null 表示不替换
 * @returns 转换后的 AST 节点
 */
function inlineTransform(node: ASTNode, getReplacementAst: (name: string) => ASTNode | null): ASTNode {
  switch (node.type) {
    case "Identifier": {
      const replacement = getReplacementAst(node.name);
      return replacement ?? node;
    }

    case "BinaryExpr":
      return {
        ...node,
        left: inlineTransform(node.left, getReplacementAst),
        right: inlineTransform(node.right, getReplacementAst),
      };

    case "UnaryExpr":
      return {
        ...node,
        argument: inlineTransform(node.argument, getReplacementAst),
      };

    case "ConditionalExpr":
      return {
        ...node,
        test: inlineTransform(node.test, getReplacementAst),
        consequent: inlineTransform(node.consequent, getReplacementAst),
        alternate: inlineTransform(node.alternate, getReplacementAst),
      };

    case "MemberExpr":
      return {
        ...node,
        object: inlineTransform(node.object, getReplacementAst),
        property: node.computed ? inlineTransform(node.property, getReplacementAst) : node.property,
      };

    case "CallExpr":
      return {
        ...node,
        callee: inlineTransform(node.callee, getReplacementAst),
        arguments: node.arguments.map((arg) => inlineTransform(arg, getReplacementAst)),
      };

    case "ArrayExpr":
      return {
        ...node,
        elements: node.elements.map((el) => inlineTransform(el, getReplacementAst)),
      };

    case "ObjectExpr":
      return {
        ...node,
        properties: node.properties.map((prop) => ({
          ...prop,
          key: prop.computed ? inlineTransform(prop.key, getReplacementAst) : prop.key,
          value: inlineTransform(prop.value, getReplacementAst),
        })),
      };

    default:
      return node;
  }
}

/**
 * 允许在表达式中直接使用的全局对象
 * 这些对象不需要在上下文中定义
 */
const ALLOWED_GLOBALS = new Set([
  // Math 对象及其方法
  "Math",
  // JSON 对象
  "JSON",
  // 基本类型构造函数
  "Number",
  "String",
  "Boolean",
  "Array",
  "Object",
  // 其他常用全局对象
  "Date",
  "RegExp",
  // 全局值
  "undefined",
  "NaN",
  "Infinity",
  // 类型检查
  "isNaN",
  "isFinite",
  "parseInt",
  "parseFloat",
]);

/**
 * 从表达式源码中提取所有使用的变量名
 * 通过 AST 解析实现精确提取
 * 排除允许的全局对象
 *
 * @param source - 表达式源码字符串
 * @returns 使用的变量名列表（去重，不含全局对象）
 *
 * @example
 * ```ts
 * extractVariableNames("x + y * Math.PI")
 * // => ["x", "y"]  // Math 被排除
 * ```
 */
function extractVariableNames(source: string): string[] {
  const ast = parse(source);
  const identifiers = collectIdentifiers(ast);
  // 过滤掉允许的全局对象
  return Array.from(identifiers).filter((name) => !ALLOWED_GLOBALS.has(name));
}
