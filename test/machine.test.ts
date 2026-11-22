import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, ForbiddenTransition, GuardVeto, Machine, machineStats, next, STATES, TRANSITIONS } from '../src/machine.ts';

test('таблица переходов: 8 состояний, 15 переходов, 49 запрещённых пар', () => {
  const s = machineStats();
  assert.deepEqual([s.states, s.terminal, s.transitions, s.allowedPairs, s.allPairs - s.allowedPairs], [8, 3, 15, 15, 49]);
});

test('полный перебор: 88 пар «состояние, событие», 15 разрешены ровно по таблице, 73 бросают ошибку', () => {
  let allowed = 0;
  let forbidden = 0;
  for (const s of STATES) {
    for (const e of EVENTS) {
      const to = TRANSITIONS[s][e];
      if (to === undefined) {
        assert.throws(() => next(s, e), ForbiddenTransition, `${s} --${e}-->`);
        forbidden++;
      } else {
        assert.equal(next(s, e), to);
        allowed++;
      }
    }
  }
  assert.deepEqual([STATES.length * EVENTS.length, allowed, forbidden], [88, 15, 73]);
});

test('запрещённый переход бросает ошибку', () => {
  assert.equal(next('waiting_approval', 'approved'), 'acting');
  assert.throws(() => next('waiting_approval', 'tool_done'), ForbiddenTransition);
  assert.throws(() => next('done', 'start'), ForbiddenTransition);
  assert.throws(() => next('planning', 'approved'), ForbiddenTransition);
});

test('guard не даёт завершить задачу, пока клиент не уведомлён', () => {
  let notified = false;
  const m = new Machine({ goal_met: () => (notified ? null : 'клиент не уведомлён') });
  m.send('start');
  m.send('plan_ready');
  m.send('tool_done');
  assert.throws(() => m.send('goal_met'), GuardVeto);
  assert.equal(m.state, 'observing');
  notified = true;
  assert.equal(m.send('goal_met'), 'done');
});
