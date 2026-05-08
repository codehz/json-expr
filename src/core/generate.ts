/**
 * 代码生成逻辑
 */

import type { ASTNode, Placeholder } from "../types/ast-types.js";
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

export interface GenerateOptions {
  rewriteNode?: (node: ASTNode, ctx: GenerateContext) => ASTNode;
}

export interface ExprIdentifierTransformResult {
  ast: ASTNode;
  deferredAsts?: Map<string, ASTNode>;
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
export function generate(node: ASTNode, options: GenerateOptions = {}): string {
  const ctx = createGenerateContext();
  return generateWithContext(node, ctx, options);
}

/** 需要空格分隔的关键字运算符 */
const KEYWORD_BINARY_OPERATORS = new Set(["in", "instanceof"]);
const KEYWORD_UNARY_OPERATORS = new Set(["typeof", "void"]);

/**
 * 带上下文的代码生成
 */
export function generateWithContext(node: ASTNode, ctx: GenerateContext, options: GenerateOptions = {}): string {
  const rewritten = options.rewriteNode?.(node, ctx) ?? node;

  switch (rewritten.type) {
    case "NumberLiteral":
      return rewritten.raw;

    case "StringLiteral":
      return JSON.stringify(rewritten.value);

    case "BooleanLiteral":
      return rewritten.value ? "true" : "false";

    case "NullLiteral":
      return "null";

    case "Identifier":
      return rewritten.name;

    case "Placeholder":
      return ctx.paramMapping.get(rewritten.id) ?? `$$${rewritten.id.description}$$`;

    case "BinaryExpr": {
      const left = wrapIfNeededWithContext(rewritten.left, rewritten, "left", ctx, options);
      const right = wrapIfNeededWithContext(rewritten.right, rewritten, "right", ctx, options);
      const sep = KEYWORD_BINARY_OPERATORS.has(rewritten.operator) ? " " : "";
      return `${left}${sep}${rewritten.operator}${sep}${right}`;
    }

    case "UnaryExpr": {
      if (!rewritten.prefix) {
        return generateWithContext(rewritten.argument, ctx, options) + rewritten.operator;
      }
      const arg = wrapIfNeededWithContext(rewritten.argument, rewritten, "argument", ctx, options);
      const sep = KEYWORD_UNARY_OPERATORS.has(rewritten.operator) ? " " : "";
      return `${rewritten.operator}${sep}${arg}`;
    }

    case "ConditionalExpr": {
      const test = wrapIfNeededWithContext(rewritten.test, rewritten, "test", ctx, options);
      const consequent = wrapIfNeededWithContext(rewritten.consequent, rewritten, "consequent", ctx, options);
      const alternate = wrapIfNeededWithContext(rewritten.alternate, rewritten, "alternate", ctx, options);
      return `${test}?${consequent}:${alternate}`;
    }

    case "MemberExpr": {
      const object = wrapIfNeededWithContext(rewritten.object, rewritten, "object", ctx, options);
      const property = generateWithContext(rewritten.property, ctx, options);
      const accessor = rewritten.optional ? "?." : rewritten.computed ? "" : ".";
      return rewritten.computed ? `${object}${accessor}[${property}]` : `${object}${accessor}${property}`;
    }

    case "CallExpr": {
      const callee = wrapIfNeededWithContext(rewritten.callee, rewritten, "callee", ctx, options);
      const args = rewritten.arguments.map((arg) => generateWithContext(arg, ctx, options)).join(",");
      const isNew = rewritten.callee.type === "Identifier" && BUILTIN_CONSTRUCTORS.has(rewritten.callee.name);
      const prefix = isNew ? "new " : "";
      const optional = rewritten.optional ? "?." : "";
      return `${prefix}${callee}${optional}(${args})`;
    }

    case "ArrayExpr":
      return `[${rewritten.elements.map((el) => generateWithContext(el, ctx, options)).join(",")}]`;

    case "ObjectExpr": {
      const props = rewritten.properties.map((prop) => {
        if (prop.shorthand) return generateWithContext(prop.key, ctx, options);
        const key = prop.computed
          ? `[${generateWithContext(prop.key, ctx, options)}]`
          : generateWithContext(prop.key, ctx, options);
        return `${key}:${generateWithContext(prop.value, ctx, options)}`;
      });
      return `{${props.join(",")}}`;
    }

    case "ArrowFunctionExpr":
      return generateArrowFunction(rewritten, ctx, options);

    default: {
      const unknownNode = rewritten as { type?: string };
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
  ctx: GenerateContext,
  options: GenerateOptions
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
    node.body.type === "ObjectExpr"
      ? `(${generateWithContext(node.body, ctx, options)})`
      : generateWithContext(node.body, ctx, options);

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
  ctx: GenerateContext,
  options: GenerateOptions = {}
): string {
  const rewrittenChild = options.rewriteNode?.(child, ctx) ?? child;
  const code = generateWithContext(rewrittenChild, ctx, options);

  if (needsParens(rewrittenChild, parent, position)) {
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
 * expr() 专用：将 context 中的变量替换为 Placeholder。
 */
export function transformExprVariables(node: ASTNode, nameToId: ReadonlyMap<string, symbol>): ASTNode {
  return transformIdentifiers(node, (name) => {
    const id = nameToId.get(name);
    return id ? ({ type: "Placeholder", id } satisfies Placeholder) : name;
  });
}

/**
 * expr() 专用：单次遍历完成变量替换、子表达式引用计数和延迟编译收集。
 */
export function transformExprIdentifiers(
  node: ASTNode,
  nameToId: ReadonlyMap<string, symbol>,
  nameToExprAST: ReadonlyMap<string, ASTNode>
): ExprIdentifierTransformResult {
  const refCounts = new Map<string, number>();
  const candidateRefs = new Map<string, ASTNode[]>();

  const ast = transformExprIdentifiersWithScope(node, nameToId, nameToExprAST, refCounts, candidateRefs);
  let deferredAsts: Map<string, ASTNode> | undefined;

  for (const [name, refs] of candidateRefs) {
    const count = refCounts.get(name) ?? 0;
    if (count <= 1) {
      replaceNode(refs[0]!, nameToExprAST.get(name)!);
      continue;
    }

    if (!deferredAsts) deferredAsts = new Map<string, ASTNode>();
    deferredAsts.set(name, nameToExprAST.get(name)!);
  }

  return { ast, deferredAsts };
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

function transformExprIdentifiersWithScope(
  node: ASTNode,
  nameToId: ReadonlyMap<string, symbol>,
  nameToExprAST: ReadonlyMap<string, ASTNode>,
  refCounts: Map<string, number>,
  candidateRefs: Map<string, ASTNode[]>,
  shadowedNames?: ReadonlySet<string>
): ASTNode {
  switch (node.type) {
    case "Identifier": {
      if (shadowedNames?.has(node.name)) return node;

      const id = nameToId.get(node.name);
      if (id) {
        return { type: "Placeholder", id } satisfies Placeholder;
      }

      const exprAST = nameToExprAST.get(node.name);
      if (!exprAST) return node;

      refCounts.set(node.name, (refCounts.get(node.name) ?? 0) + 1);
      const candidateNode: ASTNode = { ...node };
      const refs = candidateRefs.get(node.name);
      if (refs) {
        refs.push(candidateNode);
      } else {
        candidateRefs.set(node.name, [candidateNode]);
      }
      return candidateNode;
    }

    case "Placeholder":
      return node;

    case "BinaryExpr": {
      const left = transformExprIdentifiersWithScope(
        node.left,
        nameToId,
        nameToExprAST,
        refCounts,
        candidateRefs,
        shadowedNames
      );
      const right = transformExprIdentifiersWithScope(
        node.right,
        nameToId,
        nameToExprAST,
        refCounts,
        candidateRefs,
        shadowedNames
      );
      return left === node.left && right === node.right ? node : { ...node, left, right };
    }

    case "UnaryExpr": {
      const argument = transformExprIdentifiersWithScope(
        node.argument,
        nameToId,
        nameToExprAST,
        refCounts,
        candidateRefs,
        shadowedNames
      );
      return argument === node.argument ? node : { ...node, argument };
    }

    case "ConditionalExpr": {
      const test = transformExprIdentifiersWithScope(
        node.test,
        nameToId,
        nameToExprAST,
        refCounts,
        candidateRefs,
        shadowedNames
      );
      const consequent = transformExprIdentifiersWithScope(
        node.consequent,
        nameToId,
        nameToExprAST,
        refCounts,
        candidateRefs,
        shadowedNames
      );
      const alternate = transformExprIdentifiersWithScope(
        node.alternate,
        nameToId,
        nameToExprAST,
        refCounts,
        candidateRefs,
        shadowedNames
      );
      return test === node.test && consequent === node.consequent && alternate === node.alternate
        ? node
        : { ...node, test, consequent, alternate };
    }

    case "MemberExpr": {
      const object = transformExprIdentifiersWithScope(
        node.object,
        nameToId,
        nameToExprAST,
        refCounts,
        candidateRefs,
        shadowedNames
      );
      const property = node.computed
        ? transformExprIdentifiersWithScope(
            node.property,
            nameToId,
            nameToExprAST,
            refCounts,
            candidateRefs,
            shadowedNames
          )
        : node.property;
      return object === node.object && property === node.property ? node : { ...node, object, property };
    }

    case "CallExpr": {
      const callee = transformExprIdentifiersWithScope(
        node.callee,
        nameToId,
        nameToExprAST,
        refCounts,
        candidateRefs,
        shadowedNames
      );
      const arguments_ = mapAstNodes(node.arguments, (arg) =>
        transformExprIdentifiersWithScope(arg, nameToId, nameToExprAST, refCounts, candidateRefs, shadowedNames)
      );
      return callee === node.callee && arguments_ === node.arguments
        ? node
        : { ...node, callee, arguments: arguments_ };
    }

    case "ArrayExpr": {
      const elements = mapAstNodes(node.elements, (el) =>
        transformExprIdentifiersWithScope(el, nameToId, nameToExprAST, refCounts, candidateRefs, shadowedNames)
      );
      return elements === node.elements ? node : { ...node, elements };
    }

    case "ObjectExpr": {
      const properties = mapObjectProperties(node.properties, (prop) => {
        const key = prop.computed
          ? transformExprIdentifiersWithScope(
              prop.key,
              nameToId,
              nameToExprAST,
              refCounts,
              candidateRefs,
              shadowedNames
            )
          : prop.key;
        const value = transformExprIdentifiersWithScope(
          prop.value,
          nameToId,
          nameToExprAST,
          refCounts,
          candidateRefs,
          shadowedNames
        );
        return key === prop.key && value === prop.value ? prop : { ...prop, key, value };
      });
      return properties === node.properties ? node : { ...node, properties };
    }

    case "ArrowFunctionExpr": {
      const paramNames = node.params.filter((p): p is { type: "Identifier"; name: string } => p.type === "Identifier");
      const nextShadowedNames =
        paramNames.length === 0
          ? shadowedNames
          : new Set([...(shadowedNames ?? []), ...paramNames.map((param) => param.name)]);
      const body = transformExprIdentifiersWithScope(
        node.body,
        nameToId,
        nameToExprAST,
        refCounts,
        candidateRefs,
        nextShadowedNames
      );
      return body === node.body ? node : { ...node, body };
    }

    default:
      return node;
  }
}

function replaceNode(target: ASTNode, replacement: ASTNode): void {
  const record = target as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    delete record[key];
  }
  Object.assign(record, replacement);
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
