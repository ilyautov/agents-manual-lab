/** Глава 4: план как данные. Модель предлагает план, runtime проверяет его до первого шага. */
import { SPECS } from './tools.ts';

export interface PlanStep { id: string; tool: string; dependsOn: string[] }

export interface PlanRules {
  maxSteps: number;
  /** Какой шаг обязан предшествовать инструменту записи. */
  requires: Record<string, string>;
}

export const RULES: PlanRules = {
  maxSteps: 6,
  requires: { create_refund: 'check_refund_policy', send_message: 'check_refund_policy' },
};

export function validatePlan(plan: PlanStep[], rules: PlanRules = RULES): string[] {
  const errors: string[] = [];
  if (plan.length > rules.maxSteps) errors.push(`план из ${plan.length} шагов длиннее лимита ${rules.maxSteps}`);
  const seen = new Map<string, PlanStep>();
  for (const step of plan) {
    if (seen.has(step.id)) errors.push(`${step.id}: повтор идентификатора`);
    if (!SPECS.some((s) => s.name === step.tool)) errors.push(`${step.id}: нет инструмента ${step.tool}`);
    for (const d of step.dependsOn) if (!seen.has(d)) errors.push(`${step.id}: зависит от ${d}, которого раньше нет`);
    const need = rules.requires[step.tool];
    if (need && !ancestors(step, seen).some((s) => s.tool === need)) errors.push(`${step.id}: ${step.tool} без предшествующего ${need}`);
    seen.set(step.id, step);
  }
  return errors;
}

function ancestors(step: PlanStep, seen: Map<string, PlanStep>): PlanStep[] {
  const out: PlanStep[] = [];
  const stack = [...step.dependsOn];
  while (stack.length) {
    const s = seen.get(stack.pop()!);
    if (s && !out.includes(s)) { out.push(s); stack.push(...s.dependsOn); }
  }
  return out;
}

/** Хороший план возврата. */
export const GOOD_PLAN: PlanStep[] = [
  { id: 's1', tool: 'get_order', dependsOn: [] },
  { id: 's2', tool: 'check_refund_policy', dependsOn: ['s1'] },
  { id: 's3', tool: 'create_refund', dependsOn: ['s2'] },
  { id: 's4', tool: 'send_message', dependsOn: ['s3'] },
];

/** План, который модель могла бы предложить после письма с инъекцией. */
export const BAD_PLAN: PlanStep[] = [
  { id: 's1', tool: 'get_order', dependsOn: [] },
  { id: 's2', tool: 'create_refund', dependsOn: ['s1'] },
  { id: 's3', tool: 'export_customers', dependsOn: [] },
  { id: 's4', tool: 'send_message', dependsOn: ['s5'] },
];
