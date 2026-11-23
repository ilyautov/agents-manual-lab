import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalVeto, runAgent, scenarios } from '../src/agent.ts';
import { makeWorld, TICKETS } from '../src/shop.ts';

const s = scenarios();

test('малый возврат: 5 шагов, 4 вызова, один возврат, одно письмо', () => {
  assert.deepEqual([s.small.state, s.small.steps, s.small.toolCalls, s.small.refunds, s.small.messages], ['done', 5, 4, 1, 1]);
  assert.deepEqual(s.small.transitions.slice(0, 3), ['idle>planning', 'planning>acting', 'acting>observing']);
});

test('guard goal_met: письмо отправлено, а положенного возврата нет, переход отклонён', () => {
  const policy = { eligible: true, amount: 1990, reason: 'в пределах срока возврата' };
  assert.equal(goalVeto({ policy, notified: true }), 'возврат положен, но не создан');
  assert.equal(goalVeto({ policy, notified: true, refundId: 'R-1' }), null);
  assert.equal(goalVeto({ policy, notified: true, human: 'rejected' }), null);
  assert.equal(goalVeto({ policy: { ...policy, eligible: false }, notified: false }), 'клиент не уведомлён');
});

test('ложное завершение без возврата: вето не роняет прогон, агент доделывает возврат', () => {
  const r = runAgent(TICKETS.small, { falseFinish: true });
  assert.deepEqual([r.state, r.vetoes, r.refunds, r.messages, r.steps], ['done', 1, 1, 1, 6]);
  assert.ok(!r.transitions.includes('planning>done') || r.transitions.indexOf('planning>done') === r.transitions.length - 1);
  assert.ok(r.spans.some((x) => x.name === 'guard.veto'));
});

test('время инструментов и пауз повторов входит в бюджет времени', () => {
  assert.equal(s.outageNoLimit.budgetMs, s.outageNoLimit.agentMs);
  assert.ok(s.outageNoLimit.budgetMs > 30_000);
});

test('крупный возврат ждёт человека: одобрил, отклонил, промолчал', () => {
  assert.equal(s.largeApproved.state, 'done');
  assert.equal(s.largeApproved.refunded, 12500);
  assert.ok(s.largeApproved.transitions.includes('planning>waiting_approval'));
  assert.deepEqual([s.largeRejected.state, s.largeRejected.refunds, s.largeRejected.messages], ['done', 0, 1]);
  assert.deepEqual([s.largeSilent.state, s.largeSilent.refunds], ['handed_off', 0]);
});

test('вне срока возврата: отказ и письмо клиенту', () => {
  assert.deepEqual([s.late.state, s.late.refunds, s.late.messages, s.late.steps], ['done', 0, 1, 4]);
});

test('инъекция в письме: runtime блокирует, вернули ровно стоимость заказа', () => {
  assert.deepEqual(s.injection.blocked, ['amount_exceeds_order']);
  assert.equal(s.injection.refunded, 2490);
  assert.equal(s.injection.steps, 6);
  const safe = runAgent(TICKETS.injection, { gullible: false });
  assert.equal(safe.blocked.length, 0);
});

test('таймаут после списания: повтор с тем же ключом, возврат один', () => {
  assert.deepEqual([s.timeoutAfter.refunds, s.timeoutAfter.toolCalls, s.timeoutAfter.state], [1, 5, 'done']);
  assert.deepEqual([s.flaky.refunds, s.flaky.toolCalls], [1, 6]);
});

test('лимит перепланирований: 6 шагов против 11 без лимита', () => {
  assert.deepEqual([s.outage.state, s.outage.steps, s.outage.toolCalls], ['failed', 6, 14]);
  assert.deepEqual([s.outageNoLimit.state, s.outageNoLimit.steps, s.outageNoLimit.toolCalls], ['handed_off', 11, 34]);
  assert.equal(s.outage.cost.toFixed(3), '0.076');
  assert.equal(s.outageNoLimit.cost.toFixed(3), '0.178');
});

test('крошечный бюджет: штатная передача человеку, а не обрыв', () => {
  assert.equal(s.tinyBudget.state, 'handed_off');
  assert.ok(s.tinyBudget.spans.some((x) => x.name === 'handoff'));
  assert.ok(s.tinyBudget.cost <= 0.03);
});

test('история клиента: три возврата за 30 дней ведут к человеку, даже при малой сумме', () => {
  const world = makeWorld();
  world.customers.set('C-5', { id: 'C-5', name: 'Дмитрий', email: 'dmitry@example.com', refundsLast30d: 3 });
  world.orders.set('A-1006', { id: 'A-1006', customerId: 'C-5', item: 'лампа', total: 1990, deliveredDaysAgo: 2, refunded: 0, version: 1 });
  const ticket = { id: 'T-6', orderId: 'A-1006', customerId: 'C-5', email: 'Лампа не работает, верните деньги.' };
  const approved = runAgent(ticket, {}, world);
  assert.deepEqual([approved.state, approved.approvals, approved.refunds, approved.refunded], ['done', 1, 1, 1990]);
  const world2 = makeWorld();
  world2.customers.set('C-5', { id: 'C-5', name: 'Дмитрий', email: 'dmitry@example.com', refundsLast30d: 3 });
  world2.orders.set('A-1006', { id: 'A-1006', customerId: 'C-5', item: 'лампа', total: 1990, deliveredDaysAgo: 2, refunded: 0, version: 1 });
  const rejected = runAgent(ticket, { approval: 'rejected' }, world2);
  assert.deepEqual([rejected.state, rejected.refunds, rejected.messages], ['done', 0, 1]);
});
