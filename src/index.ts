// 函数导出
export { compile, type CompileOptions } from "./compile";
export { evaluate } from "./evaluate";
export { expr } from "./expr";
export { lambda } from "./lambda";
export { isProxy, isProxyExpression, isProxyVariable } from "./proxy-metadata";
export { t } from "./template";
export { compileAndEvaluate } from "./test-helper";
export { variable } from "./variable";
export { wrap } from "./wrap";

// 类型导出
export type {
  BranchNode,
  CompiledData,
  CompiledExpression,
  ControlFlowNode,
  FilterCallback,
  FindCallback,
  InferLambdaArgs,
  InferLambdaReturn,
  JumpNode,
  Lambda,
  LambdaBuilder,
  LambdaParam,
  MapCallback,
  PhiNode,
  Proxify,
  ProxyExpression,
  ReduceCallback,
  SortCallback,
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
