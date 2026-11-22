/** Глава 1: надёжность цепочки шагов, pass@k и pass^k. */
import { comb } from './util.ts';

/** Все n шагов прошли, каждый независимо с вероятностью p. */
export function chainSuccess(p: number, n: number): number {
  return p ** n;
}

/**
 * Шаг с проверкой: попытка верна с вероятностью p; ошибку проверка ловит
 * с вероятностью detect, тогда шаг повторяется (не больше retries раз).
 * Непойманная ошибка уходит дальше и портит задачу.
 */
export function verifiedStep(p: number, detect: number, retries: number): number {
  let total = 0;
  for (let i = 0; i <= retries; i++) total += ((1 - p) * detect) ** i;
  return p * total;
}

/** Сколько шагов можно позволить, чтобы цепочка оставалась не хуже target. */
export function maxSteps(p: number, target: number): number {
  return Math.floor(Math.log(target) / Math.log(p));
}

/** Несмещённая оценка pass@k по n попыткам с c успехами (Chen et al., 2021). */
export function passAtK(n: number, c: number, k: number): number {
  return 1 - comb(n - c, k) / comb(n, k);
}

/** Оценка pass^k: все k попыток успешны (Yao et al., τ-bench, 2024). */
export function passHatK(n: number, c: number, k: number): number {
  return comb(c, k) / comb(n, k);
}

/** Цикл «правка → тесты»: хотя бы одна из k независимых попыток чинит. */
export function anyOfK(p: number, k: number): number {
  return 1 - (1 - p) ** k;
}
