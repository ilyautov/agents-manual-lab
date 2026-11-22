import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backoff, CircuitBreaker, classify, fullJitter, herdPeak, retry, simulateOutage } from '../src/retry.ts';
import { mulberry32 } from '../src/util.ts';
import { timeoutAfterEffect } from '../src/retry.ts';
import { makeWorld } from '../src/shop.ts';

test('классы ошибок: таймаут записи означает неизвестный исход', () => {
  assert.equal(classify('timeout', true), 'unknown_outcome');
  assert.equal(classify('timeout', false), 'transient');
  assert.equal(classify('unavailable', true), 'transient');
  assert.equal(classify('invalid_arguments', false), 'permanent');
});

test('backoff и full jitter детерминированы сидом', () => {
  assert.deepEqual(backoff(6, 200, 5000), [200, 400, 800, 1600, 3200, 5000]);
  assert.deepEqual(fullJitter(6, 200, 5000, mulberry32(42)), [120, 179, 681, 1071, 559, 2632]);
  assert.deepEqual(fullJitter(3, 200, 5000, mulberry32(42)), fullJitter(3, 200, 5000, mulberry32(42)));
});

test('jitter разбивает толпу: пик в окне 10 мс падает с 1000 до 84', () => {
  assert.equal(herdPeak(1000, 5, 200, 5000, 10, false), 1000);
  assert.equal(herdPeak(1000, 5, 200, 5000, 10, true, 9), 84);
});

test('неизвестный исход без ключа не повторяется, с ключом повторяется', () => {
  let calls = 0;
  const fn = () => { calls++; if (calls < 3) throw { code: 'timeout' }; return 'ok'; };
  const noKey = retry(fn, { maxAttempts: 5, base: 100, cap: 1000, seed: 1, isWrite: true, hasKey: false });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.errorClass, 'unknown_outcome');
  calls = 0;
  const withKey = retry(fn, { maxAttempts: 5, base: 100, cap: 1000, seed: 1, isWrite: true, hasKey: true });
  assert.equal(withKey.ok, true);
  assert.equal(withKey.attempts, 3);
});

test('circuit breaker: 180 вызовов к лежащему сервису превращаются в 10', () => {
  const plain = simulateOutage({ downMs: 60000, durationMs: 120000, attempts: 3 });
  const guarded = simulateOutage({ downMs: 60000, durationMs: 120000, attempts: 3, breaker: new CircuitBreaker(5, 10000) });
  assert.deepEqual([plain.toDeadService, plain.served], [180, 60]);
  assert.deepEqual([guarded.toDeadService, guarded.fastFails, guarded.served], [10, 60, 59]);
});

test('таймаут не означает, что возврата не было: слепой повтор даёт два возврата', () => {
  assert.equal(timeoutAfterEffect(makeWorld().payments), 2);
  assert.equal(timeoutAfterEffect(makeWorld().payments, 'T-5:create_refund'), 1);
});
