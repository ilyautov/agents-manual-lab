import { chainSuccess, passAtK, passHatK, verifiedStep } from './reliability.ts';
for (const p of [0.9, 0.95, 0.99]) {
  console.log(`p = ${p}:`, [5, 10, 20].map((n) => `n=${n} → ${chainSuccess(p, n).toFixed(3)}`).join('  '));
}
const v = verifiedStep(0.95, 0.8, 1);
console.log(`шаг с проверкой (поймать 80% ошибок, один повтор): ${v.toFixed(3)}, 20 шагов → ${chainSuccess(v, 20).toFixed(2)}`);
console.log(`10 попыток, 7 успехов: pass@3 = ${passAtK(10, 7, 3).toFixed(3)}, pass^3 = ${passHatK(10, 7, 3).toFixed(3)}`);
