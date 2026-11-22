/** Глава 8: человек в контуре. Пороги, карточка решения, таймаут без автоодобрения. */
import { mulberry32, normal, rub } from './util.ts';
import { POLICY } from './shop.ts';

export interface RefundRequest {
  ticketId: string;
  orderId: string;
  customer: string;
  item: string;
  amount: number;
  orderTotal: number;
  deliveredDaysAgo: number;
  refundsLast30d: number;
  customerText: string;
}

export function approvalReasons(r: RefundRequest, threshold: number = POLICY.approvalThreshold): string[] {
  const reasons: string[] = [];
  if (r.amount > threshold) reasons.push(`сумма ${rub(r.amount)} выше порога ${rub(threshold)}`);
  if (r.refundsLast30d >= 3) reasons.push(`${r.refundsLast30d} возврата за 30 дней`);
  if (r.amount > r.orderTotal) reasons.push('сумма больше стоимости заказа');
  return reasons;
}

/** Что показать человеку: решение в одну строку, факты, проверка политики, последствия. */
export function approvalCard(r: RefundRequest, reasons: string[]) {
  return {
    decision: `Вернуть ${rub(r.amount)}? Клиент: ${r.customer}. Товар: ${r.item}. Заказ ${r.orderId}.`,
    why: reasons,
    facts: [
      `доставлен ${r.deliveredDaysAgo} дн. назад, срок возврата ${POLICY.returnDays} дн.`,
      `стоимость заказа ${rub(r.orderTotal)}`,
      `возвратов за 30 дней: ${r.refundsLast30d}`,
    ],
    customerText: r.customerText.slice(0, 200),
    effect: 'деньги уйдут на исходный способ оплаты, клиент получит письмо',
    actions: ['одобрить', 'отклонить', 'изменить сумму'],
  };
}

export type Resolution = 'approved' | 'rejected' | 'expired';

/** Нет ответа к сроку: заявка истекает. Молчание человека не превращается в «да». */
export function resolve(decision: 'approved' | 'rejected' | undefined, waitedMs: number, timeoutMs: number): Resolution {
  if (decision) return decision;
  if (waitedMs >= timeoutMs) return 'expired';
  throw new Error('ещё ждём');
}

/** Суммы возвратов за месяц: логнормальное распределение, медиана около 2500 ₽. */
export function sampleRefunds(n: number, seed: number): number[] {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, () => Math.round((2500 * Math.exp(0.9 * normal(rand))) / 10) * 10);
}

/** Для каждого порога: доля заявок, которые увидит человек, и доля денег под его контролем. */
export function thresholdTable(amounts: number[], thresholds: number[]) {
  const total = amounts.reduce((a, b) => a + b, 0);
  return thresholds.map((t) => {
    const above = amounts.filter((a) => a > t);
    return {
      threshold: t,
      reviews: above.length,
      shareReviews: above.length / amounts.length,
      shareMoney: above.reduce((a, b) => a + b, 0) / total,
    };
  });
}
