/**
 * Печатает все числа книги в build/numbers.json. Строки уже отформатированы по-русски.
 * Запуск: node scripts/numbers.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { anyOfK, chainSuccess, maxSteps, passAtK, passHatK, verifiedStep } from '../src/reliability.ts';
import { machineStats } from '../src/machine.ts';
import { SPECS, ToolRuntime, validateArgs } from '../src/tools.ts';
import { makeWorld, TICKETS } from '../src/shop.ts';
import { CONTEXT, PRICES, runUnderBudget, taskCost } from '../src/budget.ts';
import { backoff, fullJitter, herdPeak, simulateOutage, CircuitBreaker, timeoutAfterEffect } from '../src/retry.ts';
import { mulberry32 } from '../src/util.ts';
import { crashMatrix, crashPoints, JOB, runToCompletion } from '../src/journal.ts';
import { approvalCard, approvalReasons, sampleRefunds, thresholdTable } from '../src/approval.ts';
import { evaluateSandbox, secondLine, ATTACKS } from '../src/sandbox.ts';
import { RACE, REFUND_DAG, raceDemo, schedule } from '../src/dag.ts';
import { percentile, rootCause, pathTo, sampleLatencies } from '../src/trace.ts';
import {
  bootstrapDiff, byCategory, cohenKappa, costPerSuccess, costWithFallback, ece, mcnemarExact, ngramOverlap,
  overconfidentAgent, pairedDataset, pairedTable, passMetrics, regressions, repeatedTrials, wilson,
} from '../src/eval.ts';
import { DEFAULT_LIMITS, runAgent, scenarios } from '../src/agent.ts';
import { BAD_PLAN, GOOD_PLAN, RULES, validatePlan } from '../src/planning.ts';

const ROOT = join(import.meta.dirname, '..');

/** Число с запятой: fmt(0.3585, 2) → "0,36". */
export const fmt = (x: number, d = 2) => x.toFixed(d).replace('.', ',');
/** Процент: pct(0.3585) → "36%". */
export const pct = (x: number, d = 0) => `${fmt(x * 100, d)}%`;
/** Целое с разрядами через неразрывный пробел: 12500 → "12 500". */
export const int = (x: number) => Math.round(x).toLocaleString('ru-RU').replace(/\s/g, ' ');
export const rub = (x: number) => `${int(x)} ₽`;
/** Доллары: знак экранирован, иначе pandoc примет пару $ в абзаце за TeX-формулу. */
export const usd = (x: number, d = 2) => `${fmt(x, d)}\u00a0\\$`;
export const sec = (ms: number, d = 1) => `${fmt(ms / 1000, d)} с`;
/** Процентные пункты для разницы долей: pp(0.133) → "13,3 п. п.". */
export const pp = (x: number, d = 1) => `${fmt(x * 100, d)}\u00a0п.\u00a0п.`;

export function buildNumbers() {
  // ---------- глава 1 ----------
  const verified = verifiedStep(0.95, 0.8, 1);
  const rel = {
    p95n20: fmt(chainSuccess(0.95, 20)),
    p95n20pct: pct(chainSuccess(0.95, 20)),
    p99n20: fmt(chainSuccess(0.99, 20)),
    p99n20pct: pct(chainSuccess(0.99, 20)),
    p95n5: fmt(chainSuccess(0.95, 5)),
    p95n10: fmt(chainSuccess(0.95, 10)),
    p90n20: fmt(chainSuccess(0.9, 20), 3),
    verifiedStep: fmt(verified, 3),
    verifiedN20: fmt(chainSuccess(verified, 20)),
    verifiedN20pct: pct(chainSuccess(verified, 20)),
    maxSteps99: maxSteps(0.99, 0.9),
    maxSteps95: maxSteps(0.95, 0.9),
    maxSteps999: maxSteps(0.999, 0.9),
    maxSteps98: maxSteps(0.98, 0.9),
    passAt3: fmt(passAtK(10, 7, 3), 3),
    passHat3: fmt(passHatK(10, 7, 3), 3),
    passAt5p70: fmt(1 - 0.3 ** 5, 3),
    passHat5p70: fmt(0.7 ** 5, 3),
    passHat5p95: fmt(0.95 ** 5, 2),
    grid: Object.fromEntries([0.9, 0.95, 0.99].map((p) => [`p${Math.round(p * 100)}`,
      Object.fromEntries([5, 10, 20, 50].map((n) => [`n${n}`, fmt(chainSuccess(p, n))]))])),
  };

  // ---------- глава 2 ----------
  const ms = machineStats();
  const machine = { ...ms, forbiddenPairs: ms.allPairs - ms.allowedPairs, eventForbidden: ms.eventPairs - ms.transitions };

  // ---------- глава 3 ----------
  const refundSpec = SPECS.find((s) => s.name === 'create_refund')!;
  const badErrors = validateArgs(refundSpec, { orderId: 'A1004', amount: -500, card: '2200' });
  const world = makeWorld();
  const rt = new ToolRuntime(world);
  const r1 = rt.call('create_refund', { orderId: 'A-1001', amount: 1990 }, 'T-1:create_refund');
  rt.call('create_refund', { orderId: 'A-1001', amount: 1990 }, 'T-1:create_refund');
  rt.call('create_refund', { orderId: 'A-1001', amount: 1990 }, 'T-1:create_refund');
  const noKey = rt.call('create_refund', { orderId: 'A-1001', amount: 1990 });
  const mismatch = rt.call('create_refund', { orderId: 'A-1001', amount: 990 }, 'T-1:create_refund');
  const tools = {
    specs: SPECS.length,
    reads: SPECS.filter((s) => s.kind === 'read').length,
    writes: SPECS.filter((s) => s.kind === 'write').length,
    badErrors: badErrors.length,
    sameKeyCalls: 3,
    sameKeyRefunds: world.payments.refunds.length,
    firstOk: String(r1.ok),
    noKeyCode: noKey.ok ? 'ok' : noKey.error.code,
    mismatchCode: mismatch.ok ? 'ok' : mismatch.error.code,
  };

  // ---------- глава 4 ----------
  const planning = {
    goodErrors: validatePlan(GOOD_PLAN).length,
    badErrors: validatePlan(BAD_PLAN).length,
    maxSteps: RULES.maxSteps,
    maxReplans: 2,
  };

  // ---------- глава 5 ----------
  const c8 = taskCost(8);
  const c20 = taskCost(20);
  const wanted = 30;
  const limited = runUnderBudget({ ...DEFAULT_LIMITS, steps: 100, tokens: 1e9, cost: 0.2 }, wanted);
  const budget = {
    priceIn: usd(PRICES.inputPerM, 0),
    priceOut: usd(PRICES.outputPerM, 0),
    base: int(CONTEXT.base),
    growth: int(CONTEXT.growth),
    output: int(CONTEXT.output),
    tokens8: int(c8.input + c8.output),
    tokens20: int(c20.input + c20.output),
    cost8: usd(c8.cost),
    cost20: usd(c20.cost),
    costRatio: fmt(c20.cost / c8.cost, 1),
    stepRatio: fmt(20 / 8, 1),
    limit: usd(0.2),
    wanted,
    limitedSteps: limited.workSteps,
    limitedReason: limited.stopped,
    limitedCost: usd(limited.used.cost, 3),
    limits: { steps: DEFAULT_LIMITS.steps, tokens: int(DEFAULT_LIMITS.tokens), cost: usd(DEFAULT_LIMITS.cost), seconds: DEFAULT_LIMITS.ms / 1000 },
  };

  // ---------- глава 6 ----------
  const bo = backoff(6, 200, 5000);
  const jit = fullJitter(6, 200, 5000, mulberry32(42));
  const noBreaker = simulateOutage({ downMs: 60_000, durationMs: 120_000, attempts: 3 });
  const withBreaker = simulateOutage({ downMs: 60_000, durationMs: 120_000, attempts: 3, breaker: new CircuitBreaker(5, 10_000) });
  const moments = bo.slice(0, 3).map((_, i) => bo.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const levels = 4;
  const perLevel = 3;
  const retry = {
    backoff: bo.map(int).join(', '),
    moments: `${moments.slice(0, -1).map(int).join(', ')} и ${int(moments[moments.length - 1])}`,
    levels,
    perLevel,
    nested: perLevel ** levels,
    jitter: jit.map(int).join(', '),
    backoffSum: sec(bo.reduce((a, b) => a + b, 0)),
    herdNoJitter: int(herdPeak(1000, 5, 200, 5000, 10, false)),
    herdJitter: int(herdPeak(1000, 5, 200, 5000, 10, true, 9)),
    deadNoBreaker: noBreaker.toDeadService,
    deadBreaker: withBreaker.toDeadService,
    fastFails: withBreaker.fastFails,
    servedNoBreaker: noBreaker.served,
    servedBreaker: withBreaker.served,
    blindRefunds: timeoutAfterEffect(makeWorld().payments),
    keyedRefunds: timeoutAfterEffect(makeWorld().payments, 'T-5:create_refund'),
  };

  // ---------- глава 7 ----------
  const keyed = crashMatrix(true);
  const naive = crashMatrix(false);
  const worst = runToCompletion(['create_refund:after_effect'], false);
  const journal = {
    steps: 5,
    points: keyed.points,
    singles: keyed.singles,
    pairs: keyed.pairs,
    scenarios: keyed.scenarios,
    exactKeyed: keyed.exact,
    doubleRefundKeyed: keyed.doubleRefund,
    doubleRefundNaive: naive.doubleRefund,
    doubleMessageNaive: naive.doubleMessage,
    doubleMessageKeyed: keyed.doubleMessage,
    singleNaive: crashPoints().filter((p) => runToCompletion([p], false).refunds > 1).length,
    amount: rub(JOB.amount),
    worstRefunded: rub(worst.refunded),
  };

  // ---------- глава 8 ----------
  const amounts = sampleRefunds(1000, 11);
  const table = thresholdTable(amounts, [2000, 5000, 10000, 20000]);
  const sorted = [...amounts].sort((a, b) => a - b);
  const approval = {
    n: int(amounts.length),
    median: rub(percentile(sorted, 0.5)),
    p95: rub(percentile(sorted, 0.95)),
    perDay: Math.round(table[1].reviews / 30),
    rows: Object.fromEntries(table.map((r) => [`t${r.threshold}`, {
      threshold: rub(r.threshold), reviews: int(r.reviews), shareReviews: pct(r.shareReviews), shareMoney: pct(r.shareMoney),
    }])),
    waitMin: 40,
    card: (() => {
      const req = { ticketId: 'T-2', orderId: 'A-1002', customer: 'Борис', item: 'кофемашина', amount: 12500, orderTotal: 12500,
        deliveredDaysAgo: 3, refundsLast30d: 0, customerText: TICKETS.large.email };
      const c = approvalCard(req, approvalReasons(req));
      return { decision: c.decision, why: c.why.join('; '), facts: c.facts.join('; '), customerText: c.customerText, effect: c.effect, actions: c.actions.join(', ') };
    })(),
  };

  // ---------- глава 9 ----------
  const sb = evaluateSandbox(makeWorld().orders.get('A-1004')!);
  const sl = secondLine(makeWorld().orders.get('A-1004')!);
  const sandbox = {
    attacks: ATTACKS.length,
    blocked: sb.blocked,
    legit: sb.legit.length,
    legitAllowed: sb.legitAllowed,
    rules: new Set(sb.attacks.map((a) => (a.allowed ? 'none' : a.rule))).size,
    passWithout: sl.filter((x) => x.second === 'none').length,
    backed: sl.filter((x) => x.second !== 'none').length,
  };

  // ---------- глава 10 ----------
  const sch = schedule(REFUND_DAG);
  const race = raceDemo();
  const fast = schedule(REFUND_DAG.map((t) => (t.id === 'fraud_check' ? { ...t, ms: t.ms / 2 } : t)));
  const dag = {
    tasks: REFUND_DAG.length,
    sequential: int(sch.sequential),
    makespan: int(sch.makespan),
    speedup: fmt(sch.speedup, 2),
    critical: sch.criticalPath.join(' → '),
    criticalLen: sch.criticalPath.length,
    raceRemaining: rub(RACE.remaining),
    raceA: rub(RACE.a),
    raceB: rub(RACE.b),
    raceReread: rub(race.versioned.reread ?? 0),
    raceOrders: race.orders,
    raceBadOrders: race.overpaidOrders,
    raceNaive: rub(race.naive.refunded),
    raceOverpaid: rub(race.naive.overpaid),
    raceRefunded: rub(race.versioned.refunded),
    raceConflicts: race.versioned.conflicts,
    fastMakespan: int(fast.makespan),
    fastCritical: fast.criticalPath.join(' → '),
  };

  // ---------- агент, главы 4, 5, 8, 11 ----------
  const sc = scenarios();
  const all = { ...sc, falseFinish: runAgent(TICKETS.small, { falseFinish: true }) };
  const agent = Object.fromEntries(Object.entries(all).map(([k, r]) => [k, {
    state: r.state, steps: r.steps, toolCalls: r.toolCalls, refunds: r.refunds, refunded: rub(r.refunded),
    messages: r.messages, blocked: r.blocked.length, approvals: r.approvals, vetoes: r.vetoes, cost: usd(r.cost, 3),
    agentSec: sec(r.agentMs), spans: r.spans.length,
  }]));

  // ---------- глава 11 ----------
  const lat = sampleLatencies(200, 5);
  const cause = rootCause(sc.outage.spans)!;
  const trace = {
    runs: lat.length,
    p50: sec(percentile(lat, 0.5)),
    p95: sec(percentile(lat, 0.95)),
    p99: sec(percentile(lat, 0.99)),
    mean: sec(lat.reduce((a, b) => a + b, 0) / lat.length),
    outageSpans: sc.outage.spans.length,
    outageErrors: sc.outage.spans.filter((s) => s.status === 'error').length,
    causePath: pathTo(sc.outage.spans, cause.id).join(' → '),
    causeCode: String(cause.attrs.code),
    timeoutSpans: sc.timeoutAfter.spans.length,
  };

  // ---------- главы 12–13 ----------
  const rows = pairedDataset();
  const pt = pairedTable(rows);
  const a = rows.filter((r) => r.a).length;
  const b = rows.filter((r) => r.b).length;
  const n = rows.length;
  const wa = wilson(a, n);
  const wb = wilson(b, n);
  const w20 = wilson(15, 20);
  const boot = bootstrapDiff(rows.map((r) => r.a), rows.map((r) => r.b), 10_000, 2026);
  const kap = cohenKappa(48, 10, 6, 16);
  const oc = overconfidentAgent(500, 3);
  const cal = ece(oc.conf, oc.correct, 5, 0.5, 1);
  const costA = 0.12;
  const costB = 0.18;
  const reg = regressions(rows);
  const trialM = passMetrics(repeatedTrials(8, 1), 8, 4);
  const cats = byCategory(rows);
  const leakedTask = 'Клиент просит вернуть 3990 рублей за одну из двух подушек, заказ доставлен шесть дней назад, оформите частичный возврат и уведомите клиента';
  const forumPost = 'на форуме выложили задачу клиент просит вернуть 3990 рублей за одну из двух подушек заказ доставлен шесть дней назад оформите частичный возврат и уведомите клиента ответ create_refund 3990';
  const freshTask = 'Покупатель хочет сдать одну подушку из двух, доставка была шесть дней назад, верните её стоимость и сообщите ему';
  const evalN = {
    n, a, b, perCat: n / cats.length, cats: cats.length,
    aPct: pct(a / n), bPct: pct(b / n),
    aLow: pct(wa.low), aHigh: pct(wa.high), bLow: pct(wb.low), bHigh: pct(wb.high),
    w20Low: pct(w20.low), w20High: pct(w20.high),
    both: pt.both, aOnly: pt.aOnly, bOnly: pt.bOnly, neither: pt.neither, discordant: pt.aOnly + pt.bOnly,
    diff: pp(boot.diff, 1), diffTasks: b - a,
    mcnemarP: fmt(mcnemarExact(pt.aOnly, pt.bOnly), 3),
    bootLow: pp(boot.low, 1), bootHigh: pp(boot.high, 1),
    resamples: int(10_000),
    kappaN: 80, kappaPo: pct(kap.po), kappaPe: pct(kap.pe), kappa: fmt(kap.kappa, 2),
    judgeLenient: 10, judgeStrict: 6,
    eceN: oc.conf.length, ece: fmt(cal.ece, 3),
    eceBins: Object.fromEntries(cal.bins.map((x, i) => [`b${i}`, {
      range: `${fmt(x.from, 1)}–${fmt(x.to, 1)}`, count: x.count, conf: fmt(x.confidence, 2), acc: fmt(x.accuracy, 2),
    }])),
    costA: usd(costA), costB: usd(costB),
    cpsA: usd(costPerSuccess(costA, a / n), 3), cpsB: usd(costPerSuccess(costB, b / n), 3),
    fallbackA2: usd(costWithFallback(costA, a / n, 2), 3),
    fallbackB2: usd(costWithFallback(costB, b / n, 2), 3),
    fallbackA005: usd(costWithFallback(costA, a / n, 0.05), 3),
    fallbackB005: usd(costWithFallback(costB, b / n, 0.05), 3),
    widths: Object.fromEntries([20, 60, 100, 240, 500].map((m) => {
      const w = wilson(Math.round(0.75 * m), m);
      // ширина как разность напечатанных (округлённых) границ, чтобы таблица сходилась на глаз
      return [`n${m}`, { low: pct(w.low), high: pct(w.high), width: Math.round(w.high * 100) - Math.round(w.low * 100) }];
    })),
    w17Low: pct(wilson(17, 20).low), w17High: pct(wilson(17, 20).high),
    regressions: reg.length,
    regInjection: reg.filter((r) => r.category === 'injection').length,
    cat: Object.fromEntries(cats.map((c) => [c.category, { n: c.n, a: c.a, b: c.b }])),
    overlapLeaked: pct(ngramOverlap(leakedTask, forumPost, 8)),
    overlapFresh: pct(ngramOverlap(freshTask, forumPost, 8)),
    trials: 8,
    trialK: 4,
    pass1: fmt(trialM.pass1, 2),
    passAt4: fmt(trialM.passAt, 3),
    passHat4: fmt(trialM.passHat, 2),
  };

  // ---------- глава 14 ----------
  const coding = {
    fix40k5: pct(anyOfK(0.4, 5)),
    fix40k1: pct(0.4),
    fix40k3: pct(anyOfK(0.4, 3)),
  };

  return { rel, machine, tools, planning, budget, retry, journal, approval, sandbox, dag, agent, trace, eval: evalN, coding };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  mkdirSync(join(ROOT, 'build'), { recursive: true });
  const out = join(ROOT, 'build', 'numbers.json');
  writeFileSync(out, JSON.stringify(buildNumbers(), null, 2) + '\n');
  console.log(`numbers → ${out}`);
}
