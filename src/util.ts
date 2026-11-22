import { pathToFileURL } from 'node:url';

/** Общие детерминированные помощники лаборатории. */

/** PRNG mulberry32: одинаковый сид даёт одинаковую последовательность в [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Стандартная нормальная величина методом Бокса — Мюллера поверх PRNG. */
export function normal(rand: () => number): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Биномиальный коэффициент C(n, k) в числах с плавающей точкой. */
export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - Math.min(k, n - k) + i)) / i;
  return r;
}

/** Сумма в рублях с разрядами через неразрывный пробел: 12500 → "12 500 ₽". */
export function rub(x: number): string {
  return `${Math.round(x).toLocaleString('ru-RU').replace(/\s/g, '\u00a0')}\u00a0₽`;
}

export function isMain(url: string): boolean {
  return process.argv[1] !== undefined && url === pathToFileURL(process.argv[1]).href;
}
