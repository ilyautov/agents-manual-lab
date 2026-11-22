/** Главы 12–13: оценка агентов. Wilson, Макнемар, bootstrap, каппа Коэна, ECE, стоимость успеха. */
import { comb, mulberry32 } from './util.ts';

import { passAtK, passHatK } from './reliability.ts';

export { passAtK, passHatK };

export interface Interval { low: number; high: number }

export function wilson(successes: number, trials: number, z = 1.96): Interval {
  const p = successes / trials;
  const d = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / d;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

/** Стоимость одной успешной задачи: средняя цена попытки, делённая на долю успеха. */
export function costPerSuccess(costPerTask: number, successRate: number): number {
  return costPerTask / successRate;
}

/** Полная стоимость задачи с учётом того, что неудачу доделывает человек. */
export function costWithFallback(costPerTask: number, successRate: number, failureCost: number): number {
  return costPerTask + (1 - successRate) * failureCost;
}

/** Точный двусторонний тест Макнемара: биномиальный тест по несогласным парам b и c. */
export function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  const k = Math.min(b, c);
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += comb(n, i);
  return Math.min(1, (2 * tail) / 2 ** n);
}

/** Парный bootstrap-интервал разницы долей успеха B − A (перцентильный метод). */
export function bootstrapDiff(a: boolean[], b: boolean[], resamples: number, seed: number, level = 0.95): Interval & { diff: number } {
  const n = a.length;
  const rand = mulberry32(seed);
  const diffs: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let d = 0;
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rand() * n);
      d += Number(b[j]) - Number(a[j]);
    }
    diffs.push(d / n);
  }
  diffs.sort((x, y) => x - y);
  const lo = diffs[Math.floor(((1 - level) / 2) * resamples)];
  const hi = diffs[Math.ceil(((1 + level) / 2) * resamples) - 1];
  const diff = (b.filter(Boolean).length - a.filter(Boolean).length) / n;
  return { diff, low: lo, high: hi };
}

/** Каппа Коэна для двух оценщиков с бинарной меткой (таблица 2×2). */
export function cohenKappa(bothYes: number, aYesBNo: number, aNoBYes: number, bothNo: number) {
  const n = bothYes + aYesBNo + aNoBYes + bothNo;
  const po = (bothYes + bothNo) / n;
  const aYes = (bothYes + aYesBNo) / n;
  const bYes = (bothYes + aNoBYes) / n;
  const pe = aYes * bYes + (1 - aYes) * (1 - bYes);
  return { po, pe, kappa: (po - pe) / (1 - pe) };
}

export interface Bin { from: number; to: number; count: number; confidence: number; accuracy: number }

/** Expected Calibration Error на равных по ширине бинах. */
export function ece(conf: number[], correct: boolean[], bins: number, from = 0, to = 1): { ece: number; bins: Bin[] } {
  const width = (to - from) / bins;
  const out: Bin[] = [];
  let total = 0;
  for (let b = 0; b < bins; b++) {
    const lo = from + b * width;
    const hi = lo + width;
    const idx = conf.map((c, i) => i).filter((i) => conf[i] >= lo && (conf[i] < hi || (b === bins - 1 && conf[i] <= hi)));
    if (!idx.length) continue;
    const mc = idx.reduce((s, i) => s + conf[i], 0) / idx.length;
    const acc = idx.filter((i) => correct[i]).length / idx.length;
    out.push({ from: lo, to: hi, count: idx.length, confidence: mc, accuracy: acc });
    total += (idx.length / conf.length) * Math.abs(acc - mc);
  }
  return { ece: total, bins: out };
}

/** Самоуверенный агент: уверенность равномерно в [0,5; 1), реальная точность на 0,12 ниже. */
export function overconfidentAgent(n: number, seed: number) {
  const rand = mulberry32(seed);
  const conf: number[] = [];
  const correct: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const c = 0.5 + 0.5 * rand();
    conf.push(c);
    correct.push(rand() < c - 0.12);
  }
  return { conf, correct };
}

/** Доля словесных n-грамм теста, найденных в корпусе. Грубый, но полезный сигнал утечки. */
export function ngramOverlap(test: string, corpus: string, n: number): number {
  const grams = (s: string) => {
    const w = s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    return Array.from({ length: Math.max(0, w.length - n + 1) }, (_, i) => w.slice(i, i + n).join(' '));
  };
  const t = grams(test);
  const c = new Set(grams(corpus));
  return t.length ? t.filter((g) => c.has(g)).length / t.length : 0;
}

export const CATEGORIES = ['small_refund', 'large_refund', 'out_of_policy', 'injection', 'payment_timeout'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Сколько задач каждой категории попали в каждую клетку парной таблицы (по 12 задач). */
const PAIR_PLAN: Record<Category, { both: number; aOnly: number; bOnly: number; neither: number }> = {
  small_refund: { both: 12, aOnly: 0, bOnly: 0, neither: 0 },
  large_refund: { both: 6, aOnly: 0, bOnly: 5, neither: 1 },
  out_of_policy: { both: 7, aOnly: 0, bOnly: 5, neither: 0 },
  injection: { both: 7, aOnly: 4, bOnly: 0, neither: 1 },
  payment_timeout: { both: 8, aOnly: 1, bOnly: 3, neither: 0 },
};

export interface TaskOutcome { id: string; category: Category; a: boolean; b: boolean }

/** Набор из 60 задач и исходы версий A и B на одних и тех же задачах. */
export function pairedDataset(): TaskOutcome[] {
  const out: TaskOutcome[] = [];
  for (const cat of CATEGORIES) {
    const p = PAIR_PLAN[cat];
    const cells: [boolean, boolean, number][] = [[true, true, p.both], [true, false, p.aOnly], [false, true, p.bOnly], [false, false, p.neither]];
    for (const [a, b, k] of cells) {
      for (let i = 0; i < k; i++) out.push({ id: `T${String(out.length + 1).padStart(2, '0')}`, category: cat, a, b });
    }
  }
  return out;
}

export function pairedTable(rows: TaskOutcome[]) {
  return {
    both: rows.filter((r) => r.a && r.b).length,
    aOnly: rows.filter((r) => r.a && !r.b).length,
    bOnly: rows.filter((r) => !r.a && r.b).length,
    neither: rows.filter((r) => !r.a && !r.b).length,
  };
}

/** Регрессии на уровне сценария: задачи, которые A решала, а B перестала. */
export function regressions(rows: TaskOutcome[]) {
  return rows.filter((r) => r.a && !r.b);
}

export function byCategory(rows: TaskOutcome[]) {
  return CATEGORIES.map((cat) => {
    const r = rows.filter((x) => x.category === cat);
    return { category: cat, n: r.length, a: r.filter((x) => x.a).length, b: r.filter((x) => x.b).length };
  });
}

/** Вероятность успеха одной попытки по категориям (модель для повторных прогонов). */
export const TRIAL_P: Record<Category, number> = {
  small_refund: 0.97, large_refund: 0.75, out_of_policy: 0.85, injection: 0.9, payment_timeout: 0.6,
};

/** Каждую из 60 задач прогоняем trials раз; c означает число успешных прогонов. */
export function repeatedTrials(trials: number, seed: number) {
  const rand = mulberry32(seed);
  return CATEGORIES.flatMap((category) => Array.from({ length: 12 }, () => {
    let c = 0;
    for (let t = 0; t < trials; t++) if (rand() < TRIAL_P[category]) c++;
    return { category, c };
  }));
}

/** Средние по задачам pass@k и pass^k при n прогонах на задачу. */
export function passMetrics(tasks: { c: number }[], n: number, k: number) {
  const avg = (f: (c: number) => number) => tasks.reduce((s, t) => s + f(t.c), 0) / tasks.length;
  return { pass1: avg((c) => c / n), passAt: avg((c) => passAtK(n, c, k)), passHat: avg((c) => passHatK(n, c, k)) };
}
