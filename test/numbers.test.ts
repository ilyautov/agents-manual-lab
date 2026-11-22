import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNumbers, fmt, int, pct } from '../scripts/numbers.ts';

test('форматирование по-русски', () => {
  assert.equal(fmt(0.3585), '0,36');
  assert.equal(pct(0.3585), '36%');
  assert.equal(int(12500), '12 500');
});

test('ключевые числа книги', () => {
  const n = buildNumbers();
  assert.equal(n.rel.p95n20, '0,36');
  assert.equal(n.rel.p99n20, '0,82');
  assert.equal(n.journal.scenarios, 120);
  assert.equal(n.eval.mcnemarP, '0,096');
  assert.equal(n.dag.makespan, '2 250');
  const strings: string[] = [];
  const walk = (o: unknown): void => {
    if (typeof o === 'string') strings.push(o);
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk(n);
  assert.deepEqual(strings.filter((x) => /\d\.\d/.test(x)), [], 'десятичная точка вместо запятой');
});
