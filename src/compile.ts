import { generate, parse, type ASTNode } from "./parser";
import { serializeArgument } from "./proxy-variable";
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
 * 将占位符替换为实际变量名
 *
 * @param source - 包含占位符的表达式源码
 * @param context - 变量名到值的映射
 * @returns 替换后的源码
 */
function preprocessExpression(source: string, context: Record<string, unknown>): string {
  // 建立 Symbol description -> 变量名 映射
  const descToName = new Map<string, string>();

  for (const [name, value] of Object.entries(context)) {
    const id = getVariableId(value);
    if (id && id.description) {
      descToName.set(id.description, name);
    }
  }

  // 替换 $$VAR_xxx$$ 占位符
  return source.replace(/\$\$VAR_([^$]+)\$\$/g, (match, desc: string) => {
    const name = descToName.get(desc);
    if (!name) {
      throw new Error(`Unknown variable placeholder: ${match}`);
    }
    return name;
  });
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

  // 序列化并预处理：支持 Proxy, Object, Array 和原始值
  const rawSource = serializeArgument(expression);
  const source = preprocessExpression(rawSource, variables);

  // 建立变量名到索引的映射
  const variableOrder: string[] = [];
  const variableToIndex = new Map<string, number>();

  for (const name of Object.keys(variables)) {
    if (!variableToIndex.has(name)) {
      variableToIndex.set(name, variableOrder.length);
      variableOrder.push(name);
    }
  }

  // 解析表达式为 AST
  const ast = parse(source);

  // 转换 AST：将变量引用替换为 $N
  const undefinedVars: string[] = [];
  const transformed = transformIdentifiers(ast, (name) => {
    const index = variableToIndex.get(name);
    if (index !== undefined) {
      return { type: "Identifier", name: `$${index}` } as ASTNode;
    }
    // 检查是否为允许的全局对象
    if (!ALLOWED_GLOBALS.has(name)) {
      undefinedVars.push(name);
    }
    return null;
  });

  if (undefinedVars.length > 0) {
    throw new Error(`Undefined variable(s): ${[...new Set(undefinedVars)].join(", ")}`);
  }

  // 生成编译后的表达式
  const expressions: CompiledExpression[] = [];

  if (shortCircuit) {
    // 短路求值模式：生成控制流节点
    let nextIndex = variableOrder.length;

    function compileAst(node: ASTNode): number {
      // 检查是否需要短路处理
      if (node.type === "BinaryExpr" && (node.operator === "||" || node.operator === "&&" || node.operator === "??")) {
        return compileShortCircuit(node);
      }

      if (node.type === "ConditionalExpr") {
        return compileConditional(node);
      }

      // 普通表达式：直接生成
      const exprStr = generate(node);
      const idx = nextIndex++;
      expressions.push(exprStr);
      return idx;
    }

    function compileShortCircuit(node: ASTNode & { type: "BinaryExpr" }): number {
      // 递归编译左操作数
      const leftIdx = compileAst(node.left);

      // 生成跳转条件
      let branchCondition: string;
      switch (node.operator) {
        case "||":
          branchCondition = `$${leftIdx}`;
          break;
        case "&&":
          branchCondition = `!$${leftIdx}`;
          break;
        default:
          branchCondition = `$${leftIdx}!=null`;
      }

      const branchIdx = expressions.length;
      expressions.push(["br", branchCondition, 0] as BranchNode);
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
    // 原始模式：直接生成表达式字符串
    expressions.push(generate(transformed));
  }

  return [variableOrder, ...expressions];
}

/**
 * 将 AST 中的标识符替换为对应的 AST 节点
 *
 * @param node - 要转换的 AST 节点
 * @param getReplacementAst - 根据标识符名称返回替换的 AST 节点，返回 null 表示不替换
 * @returns 转换后的 AST 节点
 */
function transformIdentifiers(node: ASTNode, getReplacementAst: (name: string) => ASTNode | null): ASTNode {
  switch (node.type) {
    case "Identifier": {
      const replacement = getReplacementAst(node.name);
      return replacement ?? node;
    }

    case "BinaryExpr":
      return {
        ...node,
        left: transformIdentifiers(node.left, getReplacementAst),
        right: transformIdentifiers(node.right, getReplacementAst),
      };

    case "UnaryExpr":
      return {
        ...node,
        argument: transformIdentifiers(node.argument, getReplacementAst),
      };

    case "ConditionalExpr":
      return {
        ...node,
        test: transformIdentifiers(node.test, getReplacementAst),
        consequent: transformIdentifiers(node.consequent, getReplacementAst),
        alternate: transformIdentifiers(node.alternate, getReplacementAst),
      };

    case "MemberExpr":
      return {
        ...node,
        object: transformIdentifiers(node.object, getReplacementAst),
        property: node.computed ? transformIdentifiers(node.property, getReplacementAst) : node.property,
      };

    case "CallExpr":
      return {
        ...node,
        callee: transformIdentifiers(node.callee, getReplacementAst),
        arguments: node.arguments.map((arg) => transformIdentifiers(arg, getReplacementAst)),
      };

    case "ArrayExpr":
      return {
        ...node,
        elements: node.elements.map((el) => transformIdentifiers(el, getReplacementAst)),
      };

    case "ObjectExpr":
      return {
        ...node,
        properties: node.properties.map((prop) => ({
          ...prop,
          key: prop.computed ? transformIdentifiers(prop.key, getReplacementAst) : prop.key,
          value: transformIdentifiers(prop.value, getReplacementAst),
        })),
      };

    case "ArrowFunctionExpr": {
      // 箭头函数：参数名不替换，只替换函数体中的非参数标识符
      const paramNames = new Set(node.params.map((p) => p.name));
      return {
        ...node,
        body: transformIdentifiers(node.body, (name) => {
          // 如果是参数名，不替换
          if (paramNames.has(name)) return null;
          return getReplacementAst(name);
        }),
      };
    }

    default:
      return node;
  }
}
