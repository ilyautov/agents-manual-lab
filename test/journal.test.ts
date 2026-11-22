import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crashMatrix, replay, runToCompletion } from '../src/journal.ts';

test('без падений: один возврат, одно письмо, журнал из 5 записей', () => {
  const r = runToCompletion([], true);
  assert.deepEqual([r.refunds, r.messages, r.journal.length, r.restarts], [1, 1, 5, 0]);
  assert.equal(replay(r.journal).size, 5);
});

test('падение после возврата до записи в журнал: без ключа возврат двойной', () => {
  const naive = runToCompletion(['create_refund:after_effect'], false);
  assert.equal(naive.refunds, 2);
  assert.equal(naive.refunded, 7980);
  const keyed = runToCompletion(['create_refund:after_effect'], true);
  assert.equal(keyed.refunds, 1);
  assert.equal(keyed.refunded, 3990);
});

test('120 сценариев падений (15 одиночных и 105 пар): с ключами эффект ровно один раз в каждом', () => {
  const keyed = crashMatrix(true);
  assert.deepEqual([keyed.points, keyed.singles, keyed.pairs, keyed.scenarios], [15, 15, 105, 120]);
  assert.deepEqual([keyed.exact, keyed.doubleRefund, keyed.doubleMessage], [120, 0, 0]);
});

test('без ключей двойной возврат в 15 сценариях из 120: везде, где есть падение после эффекта возврата', () => {
  const naive = crashMatrix(false);
  assert.equal(naive.doubleRefund, 15);
  assert.equal(naive.doubleMessage, 15);
});
