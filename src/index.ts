// 函数导出
export { compile, type CompileOptions } from "./compile";
export { evaluate } from "./evaluate";
export { expr } from "./expr";
export { lambda } from "./lambda";
export { t } from "./template";
export { compileAndEvaluate } from "./test-helper";
export { variable } from "./variable";
export { wrap } from "./wrap";

// 类型导出
export type {
  CompiledData,
  CompiledExpression,
  InferLambdaArgs,
  InferLambdaReturn,
  Lambda,
  LambdaBuilder,
  Proxify,
  ProxyExpression,
  Variable,
} from "./types";
