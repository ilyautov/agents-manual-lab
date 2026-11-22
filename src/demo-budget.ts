import { runUnderBudget, taskCost } from './budget.ts';
for (const n of [4, 8, 12, 20]) {
  const c = taskCost(n);
  console.log(`${String(n).padStart(2)} шагов: ${c.input + c.output} токенов, ${c.cost.toFixed(3)} $`);
}
console.log('лимит 0,20 $:', runUnderBudget({ steps: 100, tokens: 1e9, cost: 0.2, ms: 1e9 }, 30));
