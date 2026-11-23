import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapDiff, byCategory, cohenKappa, costPerSuccess, costWithFallback, ece, mcnemarExact, ngramOverlap,
  overconfidentAgent, pairedDataset, pairedTable, passMetrics, regressions, repeatedTrials, wilson,
} from '../src/eval.ts';

test('Уилсон: 45 из 60 даёт 63–84%, 15 из 20 даёт 53–89%', () => {
  const a = wilson(45, 60);
  assert.deepEqual([Math.round(a.low * 100), Math.round(a.high * 100)], [63, 84]);
  const s = wilson(15, 20);
  assert.deepEqual([Math.round(s.low * 100), Math.round(s.high * 100)], [53, 89]);
});

test('парная таблица 40/5/13/2 и точный тест Макнемара p ≈ 0,096', () => {
  const t = pairedTable(pairedDataset());
  assert.deepEqual(t, { both: 40, aOnly: 5, bOnly: 13, neither: 2 });
  assert.equal(mcnemarExact(5, 13).toFixed(3), '0.096');
  assert.equal(mcnemarExact(0, 0), 1);
  assert.equal(mcnemarExact(7, 7), 1);
});

test('bootstrap-интервал разницы касается нуля', () => {
  const rows = pairedDataset();
  const r = bootstrapDiff(rows.map((x) => x.a), rows.map((x) => x.b), 10000, 2026);
  assert.equal(r.diff.toFixed(4), (8 / 60).toFixed(4));
  assert.equal(r.low.toFixed(3), '0.000');
  assert.equal(r.high.toFixed(3), '0.267');
});

test('каппа Коэна для LLM-судьи и человека: 0,53', () => {
  const k = cohenKappa(48, 10, 6, 16);
  assert.equal(k.po, 0.8);
  assert.equal(k.pe.toFixed(3), '0.579');
  assert.equal(k.kappa.toFixed(2), '0.53');
});

test('ECE самоуверенного агента 0,117 на 5 бинах', () => {
  const { conf, correct } = overconfidentAgent(500, 3);
  const r = ece(conf, correct, 5, 0.5, 1);
  assert.equal(r.ece.toFixed(3), '0.117');
  assert.equal(r.bins.reduce((s, b) => s + b.count, 0), 500);
  const perfect = ece([0.5, 0.5, 1, 1], [true, false, true, true], 2, 0.5, 1);
  assert.equal(perfect.ece, 0);
});

test('стоимость успешной задачи: дешёвая версия выгоднее', () => {
  assert.equal(costPerSuccess(0.12, 45 / 60).toFixed(3), '0.160');
  assert.equal(costPerSuccess(0.18, 53 / 60).toFixed(3), '0.204');
  assert.ok(costWithFallback(0.18, 53 / 60, 2) < costWithFallback(0.12, 45 / 60, 2));
  assert.ok(costWithFallback(0.12, 45 / 60, 0.05) < costWithFallback(0.18, 53 / 60, 0.05));
});

test('регрессии на уровне сценария: 5 задач, 4 из них про инъекцию', () => {
  const rows = pairedDataset();
  const reg = regressions(rows);
  assert.equal(reg.length, 5);
  assert.equal(reg.filter((r) => r.category === 'injection').length, 4);
  const inj = byCategory(rows).find((c) => c.category === 'injection')!;
  assert.deepEqual([inj.a, inj.b], [11, 7]);
});

test('n-граммы ловят утёкшую задачу и не ловят перефразированную', () => {
  const post = 'на форуме выложили задачу клиент просит вернуть 3990 рублей за одну из двух подушек заказ доставлен шесть дней назад оформите частичный возврат и уведомите клиента';
  assert.equal(ngramOverlap('Клиент просит вернуть 3990 рублей за одну из двух подушек, заказ доставлен шесть дней назад, оформите частичный возврат и уведомите клиента', post, 8), 1);
  assert.equal(ngramOverlap('Покупатель хочет сдать одну подушку из двух, доставка была шесть дней назад, верните её стоимость и сообщите ему', post, 8), 0);
});

test('8 прогонов на задачу: успех 0,82 в среднем, но pass^4 только 0,49', () => {
  const m = passMetrics(repeatedTrials(8, 1), 8, 4);
  assert.equal(m.pass1.toFixed(2), '0.82');
  assert.equal(m.passAt.toFixed(3), '0.998');
  assert.equal(m.passHat.toFixed(2), '0.49');
});

test('ширина интервала при доле 75%: 240 задач вдвое уже, чем 60', () => {
  const width = (n: number) => { const w = wilson(Math.round(0.75 * n), n); return w.high - w.low; };
  assert.equal(Math.round(width(60) * 100), 21);
  assert.equal(Math.round(width(240) * 100), 11);
  assert.ok(width(500) < width(240));
});

test('wilson и bootstrapDiff отклоняют бессмысленные входы понятной ошибкой', () => {
  assert.throws(() => wilson(10, 0), /больше нуля/);
  assert.throws(() => wilson(21, 20), /вне интервала/);
  assert.throws(() => bootstrapDiff([true, false], [true], 100, 1), /парными/);
});
