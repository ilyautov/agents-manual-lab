import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECS, ToolRuntime, validateArgs } from '../src/tools.ts';
import { makeWorld } from '../src/shop.ts';

const refund = SPECS.find((s) => s.name === 'create_refund')!;

test('валидация до вызова находит три ошибки и называет поле', () => {
  const errors = validateArgs(refund, { orderId: 'A1004', amount: -500, card: '2200' });
  assert.equal(errors.length, 3);
  assert.ok(errors.some((e) => e.startsWith('card: лишнее поле')));
  assert.ok(errors.some((e) => e.startsWith('amount: ожидается от 1')));
  assert.deepEqual(validateArgs(refund, { orderId: 'A-1004', amount: 2490 }), []);
});

test('три вызова с одним ключом дают один возврат', () => {
  const w = makeWorld();
  const rt = new ToolRuntime(w);
  const results = [1, 2, 3].map(() => rt.call('create_refund', { orderId: 'A-1001', amount: 1990 }, 'T-1:create_refund'));
  assert.equal(w.payments.refunds.length, 1);
  assert.deepEqual(results.map((r) => r.ok && (r.data as { id: string }).id), ['R-1', 'R-1', 'R-1']);
});

test('тот же ключ с другой суммой: ошибка idempotency_key_mismatch, второй возврат не создан', () => {
  const w = makeWorld();
  const rt = new ToolRuntime(w);
  rt.call('create_refund', { orderId: 'A-1005', amount: 3990 }, 'T-5:create_refund');
  const r = rt.call('create_refund', { orderId: 'A-1005', amount: 7980 }, 'T-5:create_refund');
  assert.equal(!r.ok && r.error.code, 'idempotency_key_mismatch');
  assert.equal(!r.ok && r.error.retryable, false);
  assert.equal(w.payments.refunds.length, 1);
});

test('запись без ключа и неизвестный инструмент отклоняются понятной ошибкой', () => {
  const rt = new ToolRuntime(makeWorld());
  const a = rt.call('create_refund', { orderId: 'A-1001', amount: 1990 });
  const b = rt.call('export_customers', {});
  assert.equal(!a.ok && a.error.code, 'missing_idempotency_key');
  assert.equal(!b.ok && b.error.code, 'unknown_tool');
});

test('сумма больше заказа: постоянная ошибка, повторять бессмысленно', () => {
  const rt = new ToolRuntime(makeWorld());
  const r = rt.call('create_refund', { orderId: 'A-1004', amount: 50000 }, 'k');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, 'amount_exceeds_order');
    assert.equal(r.error.retryable, false);
  }
});
