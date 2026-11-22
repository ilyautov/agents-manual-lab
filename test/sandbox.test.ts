import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCall, evaluateSandbox, secondLine } from '../src/sandbox.ts';
import { makeWorld } from '../src/shop.ts';

test('все 7 вызовов после инъекции блокирует runtime', () => {
  const r = evaluateSandbox(makeWorld().orders.get('A-1004')!);
  assert.equal(r.blocked, 7);
  const rules = r.attacks.map((a) => (a.allowed ? 'none' : a.rule));
  assert.deepEqual(rules, ['amount_exceeds_order', 'foreign_order', 'schema', 'tool_not_allowed_in_phase',
    'tool_not_allowed_in_phase', 'foreign_customer', 'unknown_tool']);
});

test('без первого правила 5 атак проходят, 2 останавливает вторая линия', () => {
  const s = secondLine(makeWorld().orders.get('A-1004')!);
  assert.deepEqual(s.map((x) => x.second), ['none', 'none', 'none', 'policy_not_checked', 'none', 'none', 'tool_not_allowed_in_phase']);
  // атака «чужой заказ» укладывается в остаток своего заказа: её ловит только foreign_order
  assert.equal(s[1].first, 'foreign_order');
});

test('возврат больше одобренной суммы отклоняется, даже если укладывается в остаток заказа', () => {
  const order = makeWorld().orders.get('A-1002')!;
  const ctx = { phase: 'refund' as const, orderId: 'A-1002', customerId: 'C-2', order, policyChecked: true, approvedAmount: 10000 };
  const call = { tool: 'create_refund', args: { orderId: 'A-1002', amount: 12500 } };
  assert.deepEqual(checkCall(ctx, call), { allowed: false, rule: 'amount_exceeds_approval' });
  assert.deepEqual(checkCall({ ...ctx, approvedAmount: 12500 }, call), { allowed: true });
});

test('законные вызовы проходят: 4 из 4', () => {
  const r = evaluateSandbox(makeWorld().orders.get('A-1004')!);
  assert.equal(r.legitAllowed, 4);
});
