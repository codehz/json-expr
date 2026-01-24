// 函数导出
export { compile, type CompileOptions } from "./compile";
export { constant } from "./constant";
export { evaluate } from "./evaluate";
export { expr } from "./expr";
export { isProxy, isProxyExpression, isProxyVariable } from "./proxy-metadata";
export { t } from "./template";
export { getVariableId, variable } from "./variable";

// 类型导出
export type {
  BranchNode,
  CompileContext,
  CompiledData,
  CompiledExpression,
  ControlFlowNode,
  ExprNode,
  Expression,
  InferContextType,
  InferExpressionType,
  InferVariableType,
  JumpNode,
  PhiNode,
  Proxify,
  ProxyExpression,
  Variable,
} from "./types";

export type {
  ContextTypeMap,
  ExpressionType,
  ExtractType,
  InferExpressionResult,
  ParseExpression,
  ValidateExpression,
} from "./type-parser";
