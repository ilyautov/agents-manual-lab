import { BAD_PLAN, GOOD_PLAN, validatePlan } from './planning.ts';
import { scenarios } from './agent.ts';
console.log('хороший план:', validatePlan(GOOD_PLAN));
console.log('план после инъекции:', validatePlan(BAD_PLAN));
const s = scenarios();
for (const k of ['outage', 'outageNoLimit'] as const) {
  console.log(k, s[k].state, 'шагов', s[k].steps, 'вызовов', s[k].toolCalls, s[k].cost.toFixed(3), '$');
}
