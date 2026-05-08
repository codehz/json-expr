/**
 * 代码生成逻辑
 */

import type { ASTNode } from "../types/ast-types.js";
import { BUILTIN_CONSTRUCTORS, PRECEDENCE, RIGHT_ASSOCIATIVE } from "../types/ast-types.js";

/**
 * 代码生成上下文
 * 用于在嵌套 lambda 中分配唯一参数名
 */
export interface GenerateContext {
  /** 当前已使用的参数名集合（用于嵌套 lambda 时避免冲突） */
  usedParamNames: Set<string>;
  /** 占位符 Symbol 到实际参数名的映射 */
  paramMapping: Map<symbol, string>;
}

/**
 * 创建新的生成上下文
 */
export function createGenerateContext(): GenerateContext {
  return {
    usedParamNames: new Set(),
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

/** 需要空格分隔的关键字运算符 */
const KEYWORD_BINARY_OPERATORS = new Set(["in", "instanceof"]);
const KEYWORD_UNARY_OPERATORS = new Set(["typeof", "void"]);

/**
 * 带上下文的代码生成
 */
export function generateWithContext(node: ASTNode, ctx: GenerateContext): string {
  switch (node.type) {
    case "NumberLiteral":
      return node.raw;

    case "StringLiteral":
      return JSON.stringify(node.value);

    case "BooleanLiteral":
      return node.value ? "true" : "false";

    case "NullLiteral":
      return "null";

    case "Identifier":
      return node.name;

    case "Placeholder":
      return ctx.paramMapping.get(node.id) ?? `$$${node.id.description}$$`;

    case "BinaryExpr": {
      const left = wrapIfNeededWithContext(node.left, node, "left", ctx);
      const right = wrapIfNeededWithContext(node.right, node, "right", ctx);
      const sep = KEYWORD_BINARY_OPERATORS.has(node.operator) ? " " : "";
      return `${left}${sep}${node.operator}${sep}${right}`;
    }

    case "UnaryExpr": {
      if (!node.prefix) {
        return generateWithContext(node.argument, ctx) + node.operator;
      }
      const arg = wrapIfNeededWithContext(node.argument, node, "argument", ctx);
      const sep = KEYWORD_UNARY_OPERATORS.has(node.operator) ? " " : "";
      return `${node.operator}${sep}${arg}`;
    }

    case "ConditionalExpr": {
      const test = wrapIfNeededWithContext(node.test, node, "test", ctx);
      const consequent = wrapIfNeededWithContext(node.consequent, node, "consequent", ctx);
      const alternate = wrapIfNeededWithContext(node.alternate, node, "alternate", ctx);
      return `${test}?${consequent}:${alternate}`;
    }

    case "MemberExpr": {
      const object = wrapIfNeededWithContext(node.object, node, "object", ctx);
      const property = generateWithContext(node.property, ctx);
      const accessor = node.optional ? "?." : node.computed ? "" : ".";
      return node.computed ? `${object}${accessor}[${property}]` : `${object}${accessor}${property}`;
    }

    case "CallExpr": {
      const callee = wrapIfNeededWithContext(node.callee, node, "callee", ctx);
      const args = node.arguments.map((arg) => generateWithContext(arg, ctx)).join(",");
      const isNew = node.callee.type === "Identifier" && BUILTIN_CONSTRUCTORS.has(node.callee.name);
      const prefix = isNew ? "new " : "";
      const optional = node.optional ? "?." : "";
      return `${prefix}${callee}${optional}(${args})`;
    }

    case "ArrayExpr":
      return `[${node.elements.map((el) => generateWithContext(el, ctx)).join(",")}]`;

    case "ObjectExpr": {
      const props = node.properties.map((prop) => {
        if (prop.shorthand) return generateWithContext(prop.key, ctx);
        const key = prop.computed ? `[${generateWithContext(prop.key, ctx)}]` : generateWithContext(prop.key, ctx);
        return `${key}:${generateWithContext(prop.value, ctx)}`;
      });
      return `{${props.join(",")}}`;
    }

    case "ArrowFunctionExpr":
      return generateArrowFunction(node, ctx);

    default: {
      const unknownNode = node as { type?: string };
      throw new Error(`Unknown node type: ${unknownNode.type ?? "unknown"}`);
    }
  }
}

/**
 * 生成箭头函数代码
 * 为 Placeholder 参数分配唯一名称，避免嵌套 lambda 冲突
 */
function generateArrowFunction(
  node: {
    type: "ArrowFunctionExpr";
    params: ({ type: "Identifier"; name: string } | { type: "Placeholder"; id: symbol })[];
    body: ASTNode;
  },
  ctx: GenerateContext
): string {
  const allocatedParams: { id: symbol; name: string }[] = [];
  const paramNames: string[] = [];

  for (const param of node.params) {
    if (param.type === "Identifier") {
      paramNames.push(param.name);
    } else {
      const name = allocateUniqueName(ctx.usedParamNames);
      paramNames.push(name);
      allocatedParams.push({ id: param.id, name });
      ctx.usedParamNames.add(name);
      ctx.paramMapping.set(param.id, name);
    }
  }

  const paramsStr = paramNames.length === 1 ? paramNames[0]! : `(${paramNames.join(",")})`;
  const bodyStr =
    node.body.type === "ObjectExpr" ? `(${generateWithContext(node.body, ctx)})` : generateWithContext(node.body, ctx);

  // 清理分配的参数名（退出作用域）
  for (const { id, name } of allocatedParams) {
    ctx.paramMapping.delete(id);
    ctx.usedParamNames.delete(name);
  }

  return `${paramsStr}=>${bodyStr}`;
}

/**
 * 分配一个未使用的参数名 (_0, _1, _2, ...)
 */
function allocateUniqueName(usedNames: Set<string>): string {
  let index = 0;
  while (usedNames.has(`_${index}`)) {
    index++;
  }
  return `_${index}`;
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
      if (typeof result !== "string") return result;
      return result === node.name ? node : { ...node, name: result };
    }

    case "Placeholder":
      // Placeholder 不是 Identifier，保持不变
      return node;

    case "BinaryExpr": {
      const left = transformIdentifiers(node.left, transform);
      const right = transformIdentifiers(node.right, transform);
      return left === node.left && right === node.right ? node : { ...node, left, right };
    }

    case "UnaryExpr": {
      const argument = transformIdentifiers(node.argument, transform);
      return argument === node.argument ? node : { ...node, argument };
    }

    case "ConditionalExpr": {
      const test = transformIdentifiers(node.test, transform);
      const consequent = transformIdentifiers(node.consequent, transform);
      const alternate = transformIdentifiers(node.alternate, transform);
      return test === node.test && consequent === node.consequent && alternate === node.alternate
        ? node
        : { ...node, test, consequent, alternate };
    }

    case "MemberExpr": {
      const object = transformIdentifiers(node.object, transform);
      const property = node.computed ? transformIdentifiers(node.property, transform) : node.property;
      return object === node.object && property === node.property ? node : { ...node, object, property };
    }

    case "CallExpr": {
      const callee = transformIdentifiers(node.callee, transform);
      const arguments_ = mapAstNodes(node.arguments, (arg) => transformIdentifiers(arg, transform));
      return callee === node.callee && arguments_ === node.arguments
        ? node
        : { ...node, callee, arguments: arguments_ };
    }

    case "ArrayExpr": {
      const elements = mapAstNodes(node.elements, (el) => transformIdentifiers(el, transform));
      return elements === node.elements ? node : { ...node, elements };
    }

    case "ObjectExpr": {
      const properties = mapObjectProperties(node.properties, (prop) => {
        const key = prop.computed ? transformIdentifiers(prop.key, transform) : prop.key;
        const value = transformIdentifiers(prop.value, transform);
        return key === prop.key && value === prop.value ? prop : { ...prop, key, value };
      });
      return properties === node.properties ? node : { ...node, properties };
    }

    case "ArrowFunctionExpr": {
      // 箭头函数：只转换 Identifier 参数名，Placeholder 参数保持不变
      // 只转换函数体中的非参数标识符
      const paramNames = new Set(
        node.params.filter((p): p is { type: "Identifier"; name: string } => p.type === "Identifier").map((p) => p.name)
      );
      const body = transformIdentifiers(node.body, (name) => (paramNames.has(name) ? name : transform(name)));
      return body === node.body ? node : { ...node, body };
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

    case "BinaryExpr": {
      const left = transformPlaceholders(node.left, transform);
      const right = transformPlaceholders(node.right, transform);
      return left === node.left && right === node.right ? node : { ...node, left, right };
    }

    case "UnaryExpr": {
      const argument = transformPlaceholders(node.argument, transform);
      return argument === node.argument ? node : { ...node, argument };
    }

    case "ConditionalExpr": {
      const test = transformPlaceholders(node.test, transform);
      const consequent = transformPlaceholders(node.consequent, transform);
      const alternate = transformPlaceholders(node.alternate, transform);
      return test === node.test && consequent === node.consequent && alternate === node.alternate
        ? node
        : { ...node, test, consequent, alternate };
    }

    case "MemberExpr": {
      const object = transformPlaceholders(node.object, transform);
      const property = node.computed ? transformPlaceholders(node.property, transform) : node.property;
      return object === node.object && property === node.property ? node : { ...node, object, property };
    }

    case "CallExpr": {
      const callee = transformPlaceholders(node.callee, transform);
      const arguments_ = mapAstNodes(node.arguments, (arg) => transformPlaceholders(arg, transform));
      return callee === node.callee && arguments_ === node.arguments
        ? node
        : { ...node, callee, arguments: arguments_ };
    }

    case "ArrayExpr": {
      const elements = mapAstNodes(node.elements, (el) => transformPlaceholders(el, transform));
      return elements === node.elements ? node : { ...node, elements };
    }

    case "ObjectExpr": {
      const properties = mapObjectProperties(node.properties, (prop) => {
        const key = prop.computed ? transformPlaceholders(prop.key, transform) : prop.key;
        const value = transformPlaceholders(prop.value, transform);
        return key === prop.key && value === prop.value ? prop : { ...prop, key, value };
      });
      return properties === node.properties ? node : { ...node, properties };
    }

    case "ArrowFunctionExpr": {
      // 箭头函数：参数保持不变（Placeholder 参数在代码生成时处理）
      // 函数体中的 Placeholder 需要转换，但要排除参数本身的 symbol
      const paramSymbols = new Set(node.params.filter((p) => p.type === "Placeholder").map((p) => p.id));
      const body = transformPlaceholders(node.body, (id) => (paramSymbols.has(id) ? null : transform(id)));
      return body === node.body ? node : { ...node, body };
    }

    default:
      return node;
  }
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
 * 统计 AST 中各标识符名称的出现次数
 * 用于判断子表达式是否应该内联（引用次数 = 1 则内联，> 1 则推迟为独立编译）
 */
export function countIdentifierReferences(node: ASTNode, counts: Map<string, number>): void {
  switch (node.type) {
    case "Identifier":
      counts.set(node.name, (counts.get(node.name) ?? 0) + 1);
      break;

    case "Placeholder":
      break;

    case "BinaryExpr":
      countIdentifierReferences(node.left, counts);
      countIdentifierReferences(node.right, counts);
      break;

    case "UnaryExpr":
      countIdentifierReferences(node.argument, counts);
      break;

    case "ConditionalExpr":
      countIdentifierReferences(node.test, counts);
      countIdentifierReferences(node.consequent, counts);
      countIdentifierReferences(node.alternate, counts);
      break;

    case "MemberExpr":
      countIdentifierReferences(node.object, counts);
      if (node.computed) countIdentifierReferences(node.property, counts);
      break;

    case "CallExpr":
      countIdentifierReferences(node.callee, counts);
      for (const arg of node.arguments) countIdentifierReferences(arg, counts);
      break;

    case "ArrayExpr":
      for (const el of node.elements) countIdentifierReferences(el, counts);
      break;

    case "ObjectExpr":
      for (const prop of node.properties) {
        if (prop.computed) countIdentifierReferences(prop.key, counts);
        countIdentifierReferences(prop.value, counts);
      }
      break;

    case "ArrowFunctionExpr":
      // 函数体内的标识符计数：排除参数名
      {
        const paramNames = new Set(
          node.params
            .filter((p): p is { type: "Identifier"; name: string } => p.type === "Identifier")
            .map((p) => p.name)
        );
        const bodyCounts = new Map<string, number>();
        countIdentifierReferences(node.body, bodyCounts);
        for (const [name, count] of bodyCounts) {
          if (!paramNames.has(name)) {
            counts.set(name, (counts.get(name) ?? 0) + count);
          }
        }
      }
      break;
  }
}

/**
 * 收集 AST 中所有使用的标识符名称（自由变量）
 */
export function collectIdentifiers(node: ASTNode): Set<string> {
  switch (node.type) {
    case "Identifier":
      return new Set([node.name]);

    case "BinaryExpr":
      return union(collectIdentifiers(node.left), collectIdentifiers(node.right));

    case "UnaryExpr":
      return collectIdentifiers(node.argument);

    case "ConditionalExpr":
      return union(
        collectIdentifiers(node.test),
        collectIdentifiers(node.consequent),
        collectIdentifiers(node.alternate)
      );

    case "MemberExpr": {
      const result = collectIdentifiers(node.object);
      if (node.computed) {
        for (const id of collectIdentifiers(node.property)) {
          result.add(id);
        }
      }
      return result;
    }

    case "CallExpr": {
      const result = collectIdentifiers(node.callee);
      for (const arg of node.arguments) {
        for (const id of collectIdentifiers(arg)) {
          result.add(id);
        }
      }
      return result;
    }

    case "ArrayExpr": {
      const result = new Set<string>();
      for (const el of node.elements) {
        for (const id of collectIdentifiers(el)) {
          result.add(id);
        }
      }
      return result;
    }

    case "ObjectExpr": {
      const result = new Set<string>();
      for (const prop of node.properties) {
        if (prop.computed) {
          for (const id of collectIdentifiers(prop.key)) {
            result.add(id);
          }
        }
        for (const id of collectIdentifiers(prop.value)) {
          result.add(id);
        }
      }
      return result;
    }

    case "ArrowFunctionExpr": {
      // 收集自由变量：函数体中的标识符，排除参数名
      const paramNames = new Set(
        node.params.filter((p): p is { type: "Identifier"; name: string } => p.type === "Identifier").map((p) => p.name)
      );
      const bodyIds = collectIdentifiers(node.body);
      for (const name of paramNames) {
        bodyIds.delete(name);
      }
      return bodyIds;
    }

    default:
      return new Set();
  }
}

/** 合并多个 Set */
function union<T>(...sets: Set<T>[]): Set<T> {
  const result = new Set<T>();
  for (const s of sets) {
    for (const item of s) {
      result.add(item);
    }
  }
  return result;
}
