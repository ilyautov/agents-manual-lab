/** Глава 6: классы ошибок, backoff с jitter, лимит попыток, circuit breaker. */
import { mulberry32 } from './util.ts';

export type ErrorClass = 'transient' | 'permanent' | 'unknown_outcome';

/** Таймаут записи означает «не знаем, произошло ли действие», а не «не произошло». */
export function classify(code: string, isWrite: boolean): ErrorClass {
  if (code === 'timeout') return isWrite ? 'unknown_outcome' : 'transient';
  if (code === 'unavailable' || code === 'rate_limited') return 'transient';
  return 'permanent';
}

/** Экспоненциальные паузы без jitter: base·2^i, но не больше cap. */
export function backoff(attempts: number, base: number, cap: number): number[] {
  return Array.from({ length: attempts }, (_, i) => Math.min(cap, base * 2 ** i));
}

/** Full jitter: пауза равномерно в [0, min(cap, base·2^i)). */
export function fullJitter(attempts: number, base: number, cap: number, rand: () => number): number[] {
  return backoff(attempts, base, cap).map((d) => Math.floor(rand() * d));
}

/**
 * Все clients упали в момент 0 и повторяют запрос attempts раз.
 * Возвращает пик: сколько запросов пришлось на самое загруженное окно bucketMs.
 */
export function herdPeak(clients: number, attempts: number, base: number, cap: number, bucketMs: number, jitter: boolean, seed = 1): number {
  const rand = mulberry32(seed);
  const buckets = new Map<number, number>();
  for (let c = 0; c < clients; c++) {
    const delays = jitter ? fullJitter(attempts, base, cap, rand) : backoff(attempts, base, cap);
    let t = 0;
    for (const d of delays) {
      t += d;
      const b = Math.floor(t / bucketMs);
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    }
  }
  return Math.max(...buckets.values());
}

export interface RetryOutcome<T> { ok: boolean; value?: T; attempts: number; waitedMs: number; lastCode?: string; errorClass?: ErrorClass }

/**
 * Повтор с лимитом попыток. fn возвращает значение или бросает объект с code.
 * Постоянные ошибки не повторяются. Неизвестный исход повторяется только при наличии
 * ключа идемпотентности (hasKey), иначе возвращается наверх для сверки.
 */
export function retry<T>(
  fn: (attempt: number) => T,
  opts: { maxAttempts: number; base: number; cap: number; seed: number; isWrite: boolean; hasKey: boolean; wait?: (ms: number) => void },
): RetryOutcome<T> {
  const rand = mulberry32(opts.seed);
  let waited = 0;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return { ok: true, value: fn(attempt), attempts: attempt, waitedMs: waited };
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unknown';
      const cls = classify(code, opts.isWrite);
      const canRetry = cls === 'transient' || (cls === 'unknown_outcome' && opts.hasKey);
      if (!canRetry || attempt === opts.maxAttempts) {
        return { ok: false, attempts: attempt, waitedMs: waited, lastCode: code, errorClass: cls };
      }
      const pause = Math.floor(rand() * Math.min(opts.cap, opts.base * 2 ** (attempt - 1)));
      opts.wait?.(pause);
      waited += pause;
    }
  }
  return { ok: false, attempts: opts.maxAttempts, waitedMs: waited };
}

export type BreakerState = 'closed' | 'open' | 'half_open';

/** Circuit breaker: после threshold подряд неудач перестаёт звать сервис на cooldownMs. */
export class CircuitBreaker {
  state: BreakerState = 'closed';
  failures = 0;
  openedAt = 0;
  readonly threshold: number;
  readonly cooldownMs: number;

  constructor(threshold: number, cooldownMs: number) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
  }

  allow(now: number): boolean {
    if (this.state === 'open' && now - this.openedAt >= this.cooldownMs) this.state = 'half_open';
    return this.state !== 'open';
  }

  success(): void {
    this.state = 'closed';
    this.failures = 0;
  }

  failure(now: number): void {
    this.failures++;
    if (this.state === 'half_open' || this.failures >= this.threshold) {
      this.state = 'open';
      this.openedAt = now;
    }
  }
}

/**
 * Сервис лежит в [0, downMs). Запрос приходит раз в секунду, durationMs всего;
 * каждый запрос делает до attempts попыток подряд. Считаем вызовы к лежащему сервису.
 */
export function simulateOutage(opts: { downMs: number; durationMs: number; attempts: number; breaker?: CircuitBreaker }) {
  let toDeadService = 0;
  let fastFails = 0;
  let served = 0;
  for (let t = 0; t < opts.durationMs; t += 1000) {
    let done = false;
    for (let a = 0; a < opts.attempts && !done; a++) {
      const now = t;
      if (opts.breaker && !opts.breaker.allow(now)) { fastFails++; break; }
      if (now < opts.downMs) {
        toDeadService++;
        opts.breaker?.failure(now);
      } else {
        served++;
        opts.breaker?.success();
        done = true;
      }
    }
  }
  return { toDeadService, fastFails, served };
}

/**
 * Таймаут после списания: провайдер вернул деньги, но ответ потерялся.
 * Слепой повтор без ключа создаёт второй возврат; с тем же ключом провайдер вернёт первый.
 */
export function timeoutAfterEffect(payments: { faults: string[]; refund: (o: string, a: number, k?: string) => unknown; refunds: unknown[] }, key?: string) {
  payments.faults.push('timeout_after');
  try { payments.refund('A-1005', 3990, key); } catch { /* таймаут: исход неизвестен */ }
  payments.refund('A-1005', 3990, key);
  return payments.refunds.length;
}
