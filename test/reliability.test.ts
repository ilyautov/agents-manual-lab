import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anyOfK, chainSuccess, maxSteps, passAtK, passHatK, verifiedStep } from '../src/reliability.ts';

test('цепочка из 20 шагов: 0,95 даёт 0,36, а 0,99 даёт 0,82', () => {
  assert.equal(chainSuccess(0.95, 20).toFixed(2), '0.36');
  assert.equal(chainSuccess(0.99, 20).toFixed(2), '0.82');
  assert.equal(chainSuccess(0.95, 5).toFixed(2), '0.77');
});

test('проверка шага с одним повтором поднимает 20 шагов с 0,36 до 0,79', () => {
  const p = verifiedStep(0.95, 0.8, 1);
  assert.equal(p.toFixed(3), '0.988');
  assert.equal(chainSuccess(p, 20).toFixed(2), '0.79');
  assert.equal(verifiedStep(0.95, 0, 5), 0.95);
});

test('бюджет длины для цели 0,9', () => {
  assert.equal(maxSteps(0.99, 0.9), 10);
  assert.equal(maxSteps(0.95, 0.9), 2);
  assert.equal(maxSteps(0.999, 0.9), 105);
});

test('pass@k и pass^k по 10 попыткам с 7 успехами', () => {
  assert.equal(passAtK(10, 7, 3).toFixed(3), '0.992');
  assert.equal(passHatK(10, 7, 3).toFixed(3), '0.292');
  assert.equal(passAtK(10, 7, 1), 0.7);
  assert.equal(passHatK(10, 7, 1), 0.7);
});

test('цикл правка → тесты: 0,4 за попытку, 5 попыток дают 92%', () => {
  assert.equal(Math.round(anyOfK(0.4, 5) * 100), 92);
  assert.equal(Math.round(anyOfK(0.4, 3) * 100), 78);
});
