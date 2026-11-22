import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAD_PLAN, GOOD_PLAN, validatePlan } from '../src/planning.ts';

test('хороший план проходит проверку', () => {
  assert.deepEqual(validatePlan(GOOD_PLAN), []);
});

test('план после инъекции: 4 ошибки до первого вызова', () => {
  const e = validatePlan(BAD_PLAN);
  assert.equal(e.length, 4);
  assert.ok(e.some((x) => x.includes('нет инструмента export_customers')));
});

test('лимит длины плана', () => {
  const long = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, tool: 'get_order', dependsOn: [] }));
  assert.match(validatePlan(long)[0], /длиннее лимита 6/);
});
