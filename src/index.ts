// 函数导出
export { expr } from "./api/expr";
export { lambda } from "./api/lambda";
export { t } from "./api/template";
export { variable } from "./api/variable";
export { wrap } from "./api/wrap";
export { compile, type CompileOptions } from "./core/compile";
export { evaluate } from "./core/evaluate";

// 类型导出
export type {
  CompiledData,
  CompiledExpression,
  ExprValue,
  FnNode,
  InferLambdaArgs,
  InferLambdaReturn,
  Lambda,
  LambdaBuilder,
  Proxify,
  ProxyExpression,
  Variable,
} from "./types";
