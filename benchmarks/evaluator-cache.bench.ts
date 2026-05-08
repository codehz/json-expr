import { compile, evaluate, expr, variable } from "../src/index";

/**
 * 基准测试：求值器缓存策略优化
 *
 * 测试混合缓存策略（WeakMap + LRU）的性能表现
 */

// 准备测试数据
const x = variable<number>();
const y = variable<number>();
const sum = expr({ x, y })("x + y");
const product = expr({ x, y })("x * y");
const complex = expr({ x, y })("(x + y) * (x - y) + x / y");

const compiledSum = compile(sum, { x, y });
const _compiledProduct = compile(product, { x, y });
const _compiledComplex = compile(complex, { x, y });

console.log("=== 求值器缓存策略基准测试 ===\n");

// 场景 1：相同引用多次 evaluate（WeakMap 直接命中）
console.log("场景 1：相同引用多次 evaluate（WeakMap 缓存命中）");
{
  const iterations = 1_000_000;
  const values = { x: 42, y: 3 };

  // 预热缓存
  evaluate<number>(compiledSum, values);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    evaluate<number>(compiledSum, values);
  }
  const duration = performance.now() - start;

  console.log(`  执行 ${iterations.toLocaleString()} 次`);
  console.log(`  总耗时: ${duration.toFixed(2)}ms`);
  console.log(`  每次平均: ${((duration / iterations) * 1000).toFixed(3)}μs`);
  console.log(`  每秒可执行: ${Math.round(iterations / (duration / 1000)).toLocaleString()} 次\n`);
}

// 场景 2：相同内容不同引用多次 evaluate（LRU 缓存命中）
console.log("场景 2：相同内容不同引用多次 evaluate（LRU 缓存命中）");
{
  const iterations = 100_000;
  const values = { x: 42, y: 3 };

  // 预热：先 evaluate 一次原始引用
  evaluate<number>(compiledSum, values);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    // 每次创建新的引用（模拟从 JSON 解析或网络接收）
    const clonedData = [[...compiledSum[0]], ...compiledSum.slice(1)] as typeof compiledSum;
    evaluate<number>(clonedData, values);
  }
  const duration = performance.now() - start;

  console.log(`  执行 ${iterations.toLocaleString()} 次`);
  console.log(`  总耗时: ${duration.toFixed(2)}ms`);
  console.log(`  每次平均: ${((duration / iterations) * 1000).toFixed(3)}μs`);
  console.log(`  每秒可执行: ${Math.round(iterations / (duration / 1000)).toLocaleString()} 次\n`);
}

// 场景 3：大量不同表达式（LRU 淘汰策略）
console.log("场景 3：大量不同表达式（LRU 淘汰策略）");
{
  const expressionCount = 500;
  const iterationsPerExpr = 100;

  // 生成大量不同的表达式
  const expressions: (typeof compiledSum)[] = [];
  for (let i = 0; i < expressionCount; i++) {
    const e = expr({ x, y })(`x + y + ${i}`);
    expressions.push(compile(e, { x, y }));
  }

  const start = performance.now();
  for (let round = 0; round < iterationsPerExpr; round++) {
    for (let i = 0; i < expressionCount; i++) {
      evaluate<number>(expressions[i]!, { x: i, y: round });
    }
  }
  const duration = performance.now() - start;
  const totalIterations = expressionCount * iterationsPerExpr;

  console.log(`  表达式数量: ${expressionCount}`);
  console.log(`  每表达式执行次数: ${iterationsPerExpr}`);
  console.log(`  总执行次数: ${totalIterations.toLocaleString()}`);
  console.log(`  总耗时: ${duration.toFixed(2)}ms`);
  console.log(`  每次平均: ${((duration / totalIterations) * 1000).toFixed(3)}μs`);
  console.log(`  每秒可执行: ${Math.round(totalIterations / (duration / 1000)).toLocaleString()} 次\n`);
}

// 场景 4：复杂表达式（短路求值、lambda）
console.log("场景 4：复杂表达式（短路求值）");
{
  const cond = expr({ x, y })("x > 0 && y > 0");
  const result = expr({ cond, x, y })("cond ? x * y : 0");
  const compiled = compile(result, { x, y });

  const iterations = 500_000;

  // 预热
  evaluate<number>(compiled, { x: 1, y: 2 });

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    evaluate<number>(compiled, { x: (i % 10) - 5, y: i % 7 });
  }
  const duration = performance.now() - start;

  console.log(`  执行 ${iterations.toLocaleString()} 次`);
  console.log(`  总耗时: ${duration.toFixed(2)}ms`);
  console.log(`  每次平均: ${((duration / iterations) * 1000).toFixed(3)}μs`);
  console.log(`  每秒可执行: ${Math.round(iterations / (duration / 1000)).toLocaleString()} 次\n`);
}

// 场景 5：缓存预热后的重复执行（真实使用模式）
console.log("场景 5：真实使用模式（编译一次，重复执行）");
{
  const iterations = 5_000_000;

  // 模拟真实场景：先编译，然后多次执行
  const compiled = compile(sum, { x, y });

  // 预热缓存（第一次 evaluate 会编译并缓存）
  evaluate<number>(compiled, { x: 1, y: 2 });

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    evaluate<number>(compiled, { x: i, y: i * 2 });
  }
  const duration = performance.now() - start;

  console.log(`  执行 ${iterations.toLocaleString()} 次`);
  console.log(`  总耗时: ${duration.toFixed(2)}ms`);
  console.log(`  每次平均: ${((duration / iterations) * 1000).toFixed(3)}μs`);
  console.log(`  每秒可执行: ${Math.round(iterations / (duration / 1000)).toLocaleString()} 次\n`);
}

console.log("=== 基准测试完成 ===");
console.log("\n优化要点：");
console.log("1. 一级缓存（WeakMap）：相同引用零序列化开销，O(1) 查找");
console.log("2. 二级缓存（LRU Map）：内容匹配，支持 JSON 反序列化等场景");
console.log("3. 内存安全：LRU 有 128 条上限，避免无界内存增长");
console.log("4. 自动 GC：WeakMap 在 CompiledData 不再被引用时自动释放");
