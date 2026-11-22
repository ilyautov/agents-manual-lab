import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interleavings, raceDemo, REFUND_DAG, runRace, schedule, topoOrder } from '../src/dag.ts';

test('критический путь 2250 мс против 3550 мс последовательно', () => {
  const s = schedule(REFUND_DAG);
  assert.equal(s.sequential, 3550);
  assert.equal(s.makespan, 2250);
  assert.deepEqual(s.criticalPath, ['read_order', 'fraud_check', 'create_refund', 'update_crm']);
  assert.equal(s.speedup.toFixed(2), '1.58');
});

test('цикл в графе обнаруживается', () => {
  assert.throws(() => topoOrder([{ id: 'a', ms: 1, deps: ['b'] }, { id: 'b', ms: 1, deps: ['a'] }]), /цикл/);
});

test('гонка: из 6 порядков операций 4 дают переплату 1500 ₽ без версии, с версией ни одного', () => {
  const r = raceDemo();
  assert.deepEqual([r.orders, r.overpaidOrders, r.overpaidOrdersVersioned], [6, 4, 0]);
  assert.deepEqual([r.naive.refunded, r.naive.overpaid, r.naive.conflicts], [14000, 1500, 0]);
  assert.deepEqual([r.versioned.refunded, r.versioned.conflicts, r.versioned.rejected, r.versioned.reread], [5000, 1, 1, 7500]);
});

test('последовательные записи гонки не дают: второй видит уже уменьшенный остаток', () => {
  const serial = interleavings().filter((o) => o[0].agent === o[1].agent);
  assert.equal(serial.length, 2);
  for (const o of serial) assert.equal(runRace(o, false).overpaid, 0);
});
