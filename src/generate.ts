/**
 * 代码生成逻辑
 */

import type { ASTNode } from "./ast-types";
import { BUILTIN_CONSTRUCTORS, PRECEDENCE, RIGHT_ASSOCIATIVE } from "./ast-types";

/**
 * 代码生成上下文
 * 用于在嵌套 lambda 中分配唯一参数名
 */
export interface GenerateContext {
  /** lambda 参数计数器，用于生成唯一参数名 */
  lambdaParamCounter: number;
  /** 占位符 Symbol 到实际参数名的映射 */
  paramMapping: Map<symbol, string>;
}

/**
 * 创建新的生成上下文
 */
export function createGenerateContext(): GenerateContext {
  return {
    lambdaParamCounter: 0,
    paramMapping: new Map(),
  };
}

/**
 * 从 AST 生成规范化的代码
 */
export function generate(node: ASTNode): string {
  const ctx = createGenerateContext();
  return generateWithContext(node, ctx);
}

/**
 * 带上下文的代码生成
 */
export function generateWithContext(node: ASTNode, ctx: GenerateContext): string {
  switch (node.type) {
    case "NumberLiteral":
      return node.raw;

    case "StringLiteral":
      // 使用双引号，转义必要的字符
      return JSON.stringify(node.value);

    case "BooleanLiteral":
      return node.value ? "true" : "false";

    case "NullLiteral":
      return "null";

    case "Identifier":
      return node.name;

    case "Placeholder": {
      // 查找 lambda 参数映射
      const mappedName = ctx.paramMapping.get(node.id);
      if (mappedName) return mappedName;
      // 未编译的占位符输出为特殊格式（用于测试/调试）
      return `$$${node.id.description}$$`;
    }

    case "BinaryExpr": {
      const left = wrapIfNeededWithContext(node.left, node, "left", ctx);
      const right = wrapIfNeededWithContext(node.right, node, "right", ctx);
      // 关键字运算符需要空格
      if (node.operator === "in" || node.operator === "instanceof") {
        return `${left} ${node.operator} ${right}`;
      }
      return `${left}${node.operator}${right}`;
    }

    case "UnaryExpr":
      if (node.prefix) {
        const arg = wrapIfNeededWithContext(node.argument, node, "argument", ctx);
        // 对于关键字运算符（typeof, void）需要空格
        if (node.operator === "typeof" || node.operator === "void") {
          return `${node.operator} ${arg}`;
        }
        return `${node.operator}${arg}`;
      }
      return generateWithContext(node.argument, ctx) + node.operator;

    case "ConditionalExpr": {
      const test = wrapIfNeededWithContext(node.test, node, "test", ctx);
      const consequent = wrapIfNeededWithContext(node.consequent, node, "consequent", ctx);
      const alternate = wrapIfNeededWithContext(node.alternate, node, "alternate", ctx);
      return `${test}?${consequent}:${alternate}`;
    }

    case "MemberExpr": {
      const object = wrapIfNeededWithContext(node.object, node, "object", ctx);
      const property = generateWithContext(node.property, ctx);
      return node.computed
        ? `${object}${node.optional ? "?." : ""}[${property}]`
        : `${object}${node.optional ? "?." : "."}${property}`;
    }

    case "CallExpr": {
      const callee = wrapIfNeededWithContext(node.callee, node, "callee", ctx);
      const args = node.arguments.map((arg) => generateWithContext(arg, ctx)).join(",");
      const isNew = node.callee.type === "Identifier" && BUILTIN_CONSTRUCTORS.has(node.callee.name);
      return `${isNew ? "new " : ""}${callee}${node.optional ? "?." : ""}(${args})`;
    }

    case "ArrayExpr":
      return `[${node.elements.map((el) => generateWithContext(el, ctx)).join(",")}]`;

    case "ObjectExpr": {
      const props = node.properties.map((prop) => {
        if (prop.shorthand) {
          return generateWithContext(prop.key, ctx);
        }
        const key = prop.computed ? `[${generateWithContext(prop.key, ctx)}]` : generateWithContext(prop.key, ctx);
        return `${key}:${generateWithContext(prop.value, ctx)}`;
      });
      return `{${props.join(",")}}`;
    }

    case "ArrowFunctionExpr": {
      // 为每个参数分配唯一的参数名
      const paramNames: string[] = [];
      const placeholderIds: symbol[] = [];

      for (const param of node.params) {
        if (param.type === "Placeholder") {
          // Placeholder 参数：分配唯一名称并建立映射
          const uniqueName = `_${ctx.lambdaParamCounter++}`;
          paramNames.push(uniqueName);
          placeholderIds.push(param.id);
          ctx.paramMapping.set(param.id, uniqueName);
        } else {
          // Identifier 参数：直接使用名称
          paramNames.push(param.name);
        }
      }

      const paramsStr = paramNames.length === 1 ? paramNames[0]! : `(${paramNames.join(",")})`;
      const body =
        node.body.type === "ObjectExpr"
          ? `(${generateWithContext(node.body, ctx)})`
          : generateWithContext(node.body, ctx);

      // 清理 Placeholder 参数映射
      for (const id of placeholderIds) {
        ctx.paramMapping.delete(id);
      }

      return `${paramsStr}=>${body}`;
    }

    default: {
      const unknownNode = node as { type?: string };
      const nodeType = unknownNode.type ?? "unknown";
      throw new Error(`Unknown node type: ${nodeType}`);
    }
  }
}

/**
 * 判断是否需要括号包裹，并生成代码（带上下文版本）
 */
export function wrapIfNeededWithContext(
  child: ASTNode,
  parent: ASTNode,
  position: "left" | "right" | "argument" | "object" | "callee" | "test" | "consequent" | "alternate",
  ctx: GenerateContext
): string {
  const code = generateWithContext(child, ctx);

  if (needsParens(child, parent, position)) {
    return `(${code})`;
  }
  return code;
}

/**
 * 判断子节点是否需要括号
 */
export function needsParens(child: ASTNode, parent: ASTNode, position: string): boolean {
  switch (parent.type) {
    case "BinaryExpr": {
      if (child.type === "ConditionalExpr" || child.type === "UnaryExpr") return true;
      if (child.type === "BinaryExpr") {
        const childPrec = PRECEDENCE[child.operator] ?? 0;
        const parentPrec = PRECEDENCE[parent.operator] ?? 0;
        if (childPrec < parentPrec) return true;
        if (childPrec === parentPrec && position === "right" && !RIGHT_ASSOCIATIVE.has(parent.operator)) return true;
      }
      return false;
    }

    case "UnaryExpr":
      return position === "argument" && (child.type === "BinaryExpr" || child.type === "ConditionalExpr");

    case "MemberExpr":
    case "CallExpr": {
      if (position !== "object" && position !== "callee") return false;
      if (["BinaryExpr", "ConditionalExpr", "UnaryExpr", "ArrowFunctionExpr", "ObjectExpr"].includes(child.type)) {
        return true;
      }
      // 处理 (42).toString() 这种整数紧跟点号的情况
      if (child.type === "NumberLiteral" && parent.type === "MemberExpr" && !parent.computed) {
        return !child.raw.includes(".") && !child.raw.includes("e") && !child.raw.includes("x");
      }
      return false;
    }

    case "ConditionalExpr":
      return position === "test" && child.type === "ConditionalExpr";

    default:
      return false;
  }
}

/**
 * 转换 AST 中的标识符
 * 回调函数可以返回：
 * - string: 替换标识符名称
 * - ASTNode: 内联该 AST 节点（用于子表达式内联）
 */
export function transformIdentifiers(node: ASTNode, transform: (name: string) => string | ASTNode): ASTNode {
  switch (node.type) {
    case "Identifier": {
      const result = transform(node.name);
      // 如果返回 ASTNode，直接内联；否则替换名称
      return typeof result === "string" ? { ...node, name: result } : result;
    }

    case "Placeholder":
      // Placeholder 不是 Identifier，保持不变
      return node;

    case "BinaryExpr":
      return {
        ...node,
        left: transformIdentifiers(node.left, transform),
        right: transformIdentifiers(node.right, transform),
      };

    case "UnaryExpr":
      return {
        ...node,
        argument: transformIdentifiers(node.argument, transform),
      };

    case "ConditionalExpr":
      return {
        ...node,
        test: transformIdentifiers(node.test, transform),
        consequent: transformIdentifiers(node.consequent, transform),
        alternate: transformIdentifiers(node.alternate, transform),
      };

    case "MemberExpr":
      return {
        ...node,
        object: transformIdentifiers(node.object, transform),
        // 只有 computed 属性需要转换
        property: node.computed ? transformIdentifiers(node.property, transform) : node.property,
      };

    case "CallExpr":
      return {
        ...node,
        callee: transformIdentifiers(node.callee, transform),
        arguments: node.arguments.map((arg) => transformIdentifiers(arg, transform)),
      };

    case "ArrayExpr":
      return {
        ...node,
        elements: node.elements.map((el) => transformIdentifiers(el, transform)),
      };

    case "ObjectExpr":
      return {
        ...node,
        properties: node.properties.map((prop) => ({
          ...prop,
          key: prop.computed ? transformIdentifiers(prop.key, transform) : prop.key,
          value: transformIdentifiers(prop.value, transform),
        })),
      };

    case "ArrowFunctionExpr": {
      // 箭头函数：只转换 Identifier 参数名，Placeholder 参数保持不变
      // 只转换函数体中的非参数标识符
      const paramNames = new Set(
        node.params.filter((p): p is { type: "Identifier"; name: string } => p.type === "Identifier").map((p) => p.name)
      );
      return {
        ...node,
        body: transformIdentifiers(node.body, (name) => (paramNames.has(name) ? name : transform(name))),
      };
    }

    default:
      return node;
  }
}

/**
 * 转换 AST 中的占位符节点
 * 回调函数接收 symbol，返回 Identifier 节点的名称
 * 如果返回 null/undefined，则保留原始 Placeholder 节点
 */
export function transformPlaceholders(node: ASTNode, transform: (id: symbol) => string | null | undefined): ASTNode {
  switch (node.type) {
    case "Placeholder": {
      const name = transform(node.id);
      return name != null ? { type: "Identifier", name } : node;
    }

    case "Identifier":
      return node;

    case "BinaryExpr":
      return {
        ...node,
        left: transformPlaceholders(node.left, transform),
        right: transformPlaceholders(node.right, transform),
      };

    case "UnaryExpr":
      return {
        ...node,
        argument: transformPlaceholders(node.argument, transform),
      };

    case "ConditionalExpr":
      return {
        ...node,
        test: transformPlaceholders(node.test, transform),
        consequent: transformPlaceholders(node.consequent, transform),
        alternate: transformPlaceholders(node.alternate, transform),
      };

    case "MemberExpr":
      return {
        ...node,
        object: transformPlaceholders(node.object, transform),
        property: node.computed ? transformPlaceholders(node.property, transform) : node.property,
      };

    case "CallExpr":
      return {
        ...node,
        callee: transformPlaceholders(node.callee, transform),
        arguments: node.arguments.map((arg) => transformPlaceholders(arg, transform)),
      };

    case "ArrayExpr":
      return {
        ...node,
        elements: node.elements.map((el) => transformPlaceholders(el, transform)),
      };

    case "ObjectExpr":
      return {
        ...node,
        properties: node.properties.map((prop) => ({
          ...prop,
          key: prop.computed ? transformPlaceholders(prop.key, transform) : prop.key,
          value: transformPlaceholders(prop.value, transform),
        })),
      };

    case "ArrowFunctionExpr": {
      // 箭头函数：参数保持不变（Placeholder 参数在代码生成时处理）
      // 函数体中的 Placeholder 需要转换，但要排除参数本身的 symbol
      const paramSymbols = new Set(node.params.filter((p) => p.type === "Placeholder").map((p) => p.id));
      return {
        ...node,
        body: transformPlaceholders(node.body, (id) => (paramSymbols.has(id) ? null : transform(id))),
      };
    }

    default:
      return node;
  }
}

/**
 * 收集 AST 中所有使用的标识符名称
 */
export function collectIdentifiers(node: ASTNode): Set<string> {
  const identifiers = new Set<string>();

  function visit(n: ASTNode): void {
    switch (n.type) {
      case "Identifier":
        identifiers.add(n.name);
        break;

      case "BinaryExpr":
        visit(n.left);
        visit(n.right);
        break;

      case "UnaryExpr":
        visit(n.argument);
        break;

      case "ConditionalExpr":
        visit(n.test);
        visit(n.consequent);
        visit(n.alternate);
        break;

      case "MemberExpr":
        visit(n.object);
        if (n.computed) {
          visit(n.property);
        }
        break;

      case "CallExpr":
        visit(n.callee);
        n.arguments.forEach(visit);
        break;

      case "ArrayExpr":
        n.elements.forEach(visit);
        break;

      case "ObjectExpr":
        n.properties.forEach((prop) => {
          if (prop.computed) {
            visit(prop.key);
          }
          visit(prop.value);
        });
        break;

      case "ArrowFunctionExpr": {
        // 箭头函数：收集参数名和函数体中的标识符
        // 但从闭包角度，只需收集非参数的自由变量
        // 只考虑 Identifier 参数，Placeholder 参数在编译时处理
        const paramNames = new Set(
          n.params.filter((p): p is { type: "Identifier"; name: string } => p.type === "Identifier").map((p) => p.name)
        );
        const bodyIdentifiers = collectIdentifiers(n.body);
        for (const id of bodyIdentifiers) {
          if (!paramNames.has(id)) {
            identifiers.add(id);
          }
        }
        break;
      }
    }
  }

  visit(node);
  return identifiers;
}
