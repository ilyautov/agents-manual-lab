import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runUnderBudget, taskCost } from '../src/budget.ts';
import { DEFAULT_LIMITS } from '../src/agent.ts';

test('стоимость растёт быстрее числа шагов: 8 шагов 0,12 $, 20 шагов 0,51 $', () => {
  const a = taskCost(8);
  const b = taskCost(20);
  assert.equal(a.input + a.output, 34000);
  assert.equal(b.input + b.output, 157000);
  assert.equal(a.cost.toFixed(2), '0.12');
  assert.equal(b.cost.toFixed(2), '0.51');
  assert.equal((b.cost / a.cost).toFixed(1), '4.4');
});

test('лимит 0,20 $: агент делает 10 шагов, оставляет резерв и не выходит за лимит', () => {
  const r = runUnderBudget({ ...DEFAULT_LIMITS, steps: 100, tokens: 1e9, cost: 0.2 }, 30);
  assert.equal(r.workSteps, 10);
  assert.equal(r.stopped, 'cost');
  assert.ok(r.withinLimit);
  assert.equal(r.used.cost.toFixed(3), '0.178');
});

test('без упора в лимит остановки нет', () => {
  const r = runUnderBudget({ steps: 100, tokens: 1e9, cost: 10, ms: 1e9 }, 5);
  assert.equal(r.workSteps, 5);
  assert.equal(r.stopped, null);
});
