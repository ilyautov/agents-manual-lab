/** Глава 5: бюджеты шагов, токенов, денег и времени; штатная остановка. */

/** Цены в долларах за миллион токенов (условные, порядок как у моделей среднего класса). */
export interface Prices { inputPerM: number; outputPerM: number }
export const PRICES: Prices = { inputPerM: 3, outputPerM: 15 };

/** Модель контекста: каждый шаг заново отправляет системный промпт и всю историю. */
export interface ContextModel { base: number; growth: number; output: number }
export const CONTEXT: ContextModel = { base: 2000, growth: 600, output: 150 };

export interface Usage { input: number; output: number; ms: number }

export function stepUsage(i: number, ctx: ContextModel = CONTEXT, ms = 1200): Usage {
  return { input: ctx.base + ctx.growth * i, output: ctx.output, ms };
}

export function usageCost(u: Usage, prices: Prices = PRICES): number {
  return (u.input * prices.inputPerM + u.output * prices.outputPerM) / 1e6;
}

/** Суммарные токены и деньги задачи из n шагов. */
export function taskCost(n: number, ctx: ContextModel = CONTEXT, prices: Prices = PRICES) {
  let input = 0;
  let output = 0;
  for (let i = 0; i < n; i++) {
    const u = stepUsage(i, ctx);
    input += u.input;
    output += u.output;
  }
  return { input, output, cost: (input * prices.inputPerM + output * prices.outputPerM) / 1e6 };
}

export interface Limits { steps: number; tokens: number; cost: number; ms: number }

export type Verdict = { ok: true } | { ok: false; reason: 'steps' | 'tokens' | 'cost' | 'ms' };

/**
 * Следит за расходом. Перед каждым шагом спрашивает: хватит ли на этот шаг
 * и ещё на финальный шаг (резерв), который передаст задачу человеку с отчётом.
 */
export class BudgetTracker {
  readonly limits: Limits;
  readonly reserve: Usage;
  readonly prices: Prices;
  used = { steps: 0, tokens: 0, cost: 0, ms: 0 };

  constructor(limits: Limits, reserve: Usage, prices: Prices = PRICES) {
    this.limits = limits;
    this.reserve = reserve;
    this.prices = prices;
  }

  /** Можно ли сделать шаг u и всё ещё оставить резерв на штатную остановку. */
  check(u: Usage): Verdict {
    const r = this.reserve;
    const after = {
      steps: this.used.steps + 2,
      tokens: this.used.tokens + u.input + u.output + r.input + r.output,
      cost: this.used.cost + usageCost(u, this.prices) + usageCost(r, this.prices),
      ms: this.used.ms + u.ms + r.ms,
    };
    for (const k of ['steps', 'tokens', 'cost', 'ms'] as const) {
      if (after[k] > this.limits[k]) return { ok: false, reason: k };
    }
    return { ok: true };
  }

  charge(u: Usage): void {
    this.used.steps += 1;
    this.used.tokens += u.input + u.output;
    this.used.cost += usageCost(u, this.prices);
    this.used.ms += u.ms;
  }

  /** Время работы инструментов и пауз между повторами тоже расходует бюджет времени. */
  chargeTime(ms: number): void {
    this.used.ms += ms;
  }
}

/** Запуск длинной задачи под лимитом: сколько шагов успели и почему остановились. */
export function runUnderBudget(limits: Limits, wantedSteps: number) {
  const reserve: Usage = { input: 3000, output: 400, ms: 1500 };
  const t = new BudgetTracker(limits, reserve);
  let stopped: string | null = null;
  for (let i = 0; i < wantedSteps; i++) {
    const u = stepUsage(i);
    const v = t.check(u);
    if (!v.ok) { stopped = v.reason; break; }
    t.charge(u);
  }
  const workSteps = t.used.steps;
  if (stopped) t.charge(reserve);
  return { workSteps, stopped, used: { ...t.used }, withinLimit: t.used.cost <= limits.cost };
}
