import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalCard, approvalReasons, resolve, sampleRefunds, thresholdTable } from '../src/approval.ts';

const req = { ticketId: 'T-2', orderId: 'A-1002', customer: 'Борис', item: 'кофемашина', amount: 12500, orderTotal: 12500, deliveredDaysAgo: 3, refundsLast30d: 0, customerText: 'Кофемашина течёт' };

test('возврат 12 500 ₽ выше порога требует одобрения, карточка содержит решение и последствия', () => {
  const reasons = approvalReasons(req);
  assert.equal(reasons.length, 1);
  const card = approvalCard(req, reasons);
  assert.equal(card.decision, 'Вернуть 12\u00a0500\u00a0₽? Клиент: Борис. Товар: кофемашина. Заказ A-1002.');
  assert.equal(card.actions.length, 3);
  assert.deepEqual(approvalReasons({ ...req, amount: 1990 }), []);
});

test('молчание человека не превращается в одобрение', () => {
  assert.equal(resolve(undefined, 24 * 3600_000, 24 * 3600_000), 'expired');
  assert.equal(resolve('approved', 10, 24 * 3600_000), 'approved');
  assert.throws(() => resolve(undefined, 10, 1000));
});

test('таблица порогов на 1000 возвратах', () => {
  const amounts = sampleRefunds(1000, 11);
  const t = thresholdTable(amounts, [2000, 5000, 10000, 20000]);
  assert.deepEqual(t.map((r) => r.reviews), [587, 209, 64, 9]);
  assert.deepEqual(t.map((r) => Math.round(r.shareMoney * 100)), [87, 54, 26, 6]);
});
