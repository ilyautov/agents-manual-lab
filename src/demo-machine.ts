import { STATES, TRANSITIONS, machineStats, next } from './machine.ts';
for (const s of STATES) {
  const edges = Object.entries(TRANSITIONS[s]).map(([e, to]) => `${e} → ${to}`);
  console.log(s.padEnd(17), edges.join(', ') || '(терминальное)');
}
console.log(machineStats());
try { next('waiting_approval', 'tool_done'); } catch (e) { console.log('ожидаемо:', (e as Error).message); }
