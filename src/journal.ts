/** Глава 7: журнал событий, восстановление после падения, эффект ровно один раз. */
import { makeWorld } from './shop.ts';
import type { World } from './shop.ts';

export const STEPS = ['read_order', 'check_policy', 'create_refund', 'notify_customer', 'close_ticket'] as const;
export type Step = (typeof STEPS)[number];
export const PHASES = ['before_effect', 'after_effect', 'after_journal'] as const;

export interface Entry { seq: number; step: Step; result: unknown }

/** Задача главы: вернуть одну подушку из двух (частичный возврат 3990 ₽ из 7980 ₽). */
export const JOB = { ticketId: 'T-5', orderId: 'A-1005', customerId: 'C-1', amount: 3990 } as const;

export class Crash extends Error {}

export function crashPoints(): string[] {
  return STEPS.flatMap((s) => PHASES.map((p) => `${s}:${p}`));
}

/** Состояние, восстановленное из журнала: какие шаги сделаны и с каким результатом. */
export function replay(journal: readonly Entry[]): Map<Step, unknown> {
  return new Map(journal.map((e) => [e.step, e.result]));
}

/**
 * Один запуск процесса. Журнал переживает падение (лежит в базе), память процесса нет.
 * Завершённые шаги пропускаются; незавершённый шаг выполняется заново.
 */
export function runOnce(world: World, journal: Entry[], crashes: Set<string>, useKeys: boolean, closed: { value: boolean }): void {
  const done = replay(journal);
  const point = (id: string) => {
    if (crashes.delete(id)) throw new Crash(id);
  };
  for (const step of STEPS) {
    if (done.has(step)) continue;
    point(`${step}:before_effect`);
    const key = useKeys ? `${JOB.ticketId}:${step}` : undefined;
    let result: unknown;
    switch (step) {
      case 'read_order': result = { ...world.orders.get(JOB.orderId)! }; break;
      case 'check_policy': result = { eligible: true, amount: JOB.amount }; break;
      case 'create_refund': result = world.payments.refund(JOB.orderId, JOB.amount, key); break;
      case 'notify_customer':
        result = world.notifier.send(world.customers.get(JOB.customerId)!.email, `Возврат ${JOB.amount} ₽ оформлен`, key);
        break;
      case 'close_ticket': closed.value = true; result = 'closed'; break;
    }
    point(`${step}:after_effect`);
    journal.push({ seq: journal.length + 1, step, result });
    point(`${step}:after_journal`);
  }
}

/** Перезапускает процесс после каждого падения, пока задача не завершится. */
export function runToCompletion(crashAt: string[], useKeys: boolean) {
  const world = makeWorld();
  const journal: Entry[] = [];
  const crashes = new Set(crashAt);
  const closed = { value: false };
  let restarts = 0;
  for (;;) {
    try {
      runOnce(world, journal, crashes, useKeys, closed);
      break;
    } catch (e) {
      if (!(e instanceof Crash)) throw e;
      restarts++;
      if (restarts > 10) throw new Error('не сошлось');
    }
  }
  return {
    restarts,
    refunds: world.payments.refunds.length,
    refunded: world.orders.get(JOB.orderId)!.refunded,
    messages: world.notifier.sent.length,
    journal,
    closed: closed.value,
  };
}

/**
 * Перебор: одно падение в каждой точке и все пары разных точек.
 * Пара неупорядочена: процесс падает в той точке пары, до которой дойдёт раньше.
 */
export function crashMatrix(useKeys: boolean) {
  const points = crashPoints();
  const pairs = points.flatMap((a, i) => points.slice(i + 1).map((b) => [a, b]));
  const scenarios: string[][] = [...points.map((p) => [p]), ...pairs];
  let doubleRefund = 0;
  let doubleMessage = 0;
  let exact = 0;
  for (const s of scenarios) {
    const r = runToCompletion(s, useKeys);
    if (r.refunds > 1) doubleRefund++;
    if (r.messages > 1) doubleMessage++;
    if (r.refunds === 1 && r.messages === 1 && r.closed) exact++;
  }
  return { points: points.length, singles: points.length, pairs: pairs.length, scenarios: scenarios.length, doubleRefund, doubleMessage, exact };
}
