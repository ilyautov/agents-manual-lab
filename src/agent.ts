/**
 * Сквозной агент поддержки: оформляет возврат. Вместо LLM работает сценарный планировщик,
 * поэтому прогон детерминирован. Всё остальное настоящее: автомат, бюджет, песочница,
 * валидация, повторы с ключом идемпотентности, одобрение человеком, трасса.
 */
import { GuardVeto, Machine, isTerminal } from './machine.ts';
import type { State } from './machine.ts';
import { BudgetTracker, stepUsage } from './budget.ts';
import type { Limits } from './budget.ts';
import { checkCall } from './sandbox.ts';
import type { Call, Phase } from './sandbox.ts';
import { ToolRuntime } from './tools.ts';
import type { ToolResult } from './tools.ts';
import { retry } from './retry.ts';
import { approvalReasons } from './approval.ts';
import { Tracer } from './trace.ts';
import type { Span } from './trace.ts';
import { makeWorld, TICKETS } from './shop.ts';
import type { PaymentFault, Ticket, World } from './shop.ts';

export interface AgentOptions {
  approval?: 'approved' | 'rejected' | 'silent';
  paymentFaults?: PaymentFault[];
  limits?: Limits;
  /** Планировщик один раз поддаётся инструкции из письма (имитация уязвимой модели). */
  gullible?: boolean;
  /** Сколько раз можно перепланировать после неудачи одного и того же инструмента. */
  maxReplans?: number;
  /** Планировщик один раз объявляет задачу решённой, не вызвав create_refund (ложное завершение). */
  falseFinish?: boolean;
}

export const DEFAULT_LIMITS: Limits = { steps: 12, tokens: 60_000, cost: 0.25, ms: 60_000 };
export const TOOL_MS = 300;
export const APPROVAL_WAIT_MS = 40 * 60_000;

interface Ctx {
  ticket: Ticket;
  order?: { total: number; refunded: number };
  policy?: { eligible: boolean; amount: number; reason: string };
  refundId?: string;
  human?: 'approved' | 'rejected';
  notified: boolean;
  injectionTried: boolean;
  falseFinishTried: boolean;
  approvedAmount: number | null;
  failures: Record<string, number>;
}

type Planned = { kind: 'tool'; call: Call } | { kind: 'finish' } | { kind: 'give_up'; reason: string };

const INJECTION_MARK = /СИСТЕМНОЕ СООБЩЕНИЕ|игнорируй/i;

/** Сценарный планировщик: то, что в продукте делала бы модель. */
export function plan(ctx: Ctx, gullible: boolean, maxReplans = 2, falseFinish = false): Planned {
  const { orderId, customerId } = ctx.ticket;
  for (const [tool, n] of Object.entries(ctx.failures)) {
    if (n > maxReplans) return { kind: 'give_up', reason: `${tool}: ${n} неудачи подряд` };
  }
  if (!ctx.order) return { kind: 'tool', call: { tool: 'get_order', args: { orderId } } };
  if (!ctx.policy) return { kind: 'tool', call: { tool: 'check_refund_policy', args: { orderId } } };
  if (gullible && INJECTION_MARK.test(ctx.ticket.email) && !ctx.injectionTried) {
    ctx.injectionTried = true;
    return { kind: 'tool', call: { tool: 'create_refund', args: { orderId, amount: 50000 } } };
  }
  if (falseFinish && !ctx.falseFinishTried && ctx.policy.eligible && !ctx.refundId) {
    ctx.falseFinishTried = true;
    return { kind: 'finish' };
  }
  if (ctx.policy.eligible && !ctx.refundId && ctx.human !== 'rejected') {
    return { kind: 'tool', call: { tool: 'create_refund', args: { orderId, amount: ctx.policy.amount } } };
  }
  if (!ctx.notified) {
    const text = ctx.refundId
      ? `Возврат ${ctx.policy.amount} ₽ оформлен, деньги придут на карту оплаты.`
      : ctx.human === 'rejected' ? 'Сотрудник отклонил возврат, с вами свяжется менеджер.' : `Вернуть нельзя: ${ctx.policy.reason}.`;
    return { kind: 'tool', call: { tool: 'send_message', args: { customerId, text } } };
  }
  return { kind: 'finish' };
}

/** Охранное условие перехода в done: проверяет факты runtime, а не слова модели. */
export function goalVeto(ctx: Pick<Ctx, 'policy' | 'refundId' | 'human' | 'notified'>): string | null {
  if (ctx.policy?.eligible && !ctx.refundId && ctx.human !== 'rejected') return 'возврат положен, но не создан';
  if (!ctx.notified) return 'клиент не уведомлён';
  return null;
}

/** Фазу определяет runtime по фактам, а не по словам модели. */
function phaseOf(ctx: Ctx): Phase {
  if (!ctx.policy) return 'gather';
  if (ctx.policy.eligible && !ctx.refundId && ctx.human !== 'rejected') return 'refund';
  return 'notify';
}

export interface AgentResult {
  state: State;
  steps: number;
  toolCalls: number;
  refunds: number;
  refunded: number;
  messages: number;
  blocked: string[];
  approvals: number;
  vetoes: number;
  cost: number;
  budgetMs: number;
  agentMs: number;
  wallMs: number;
  spans: Span[];
  transitions: string[];
}

export function runAgent(ticket: Ticket, opts: AgentOptions = {}, world: World = makeWorld()): AgentResult {
  const gullible = opts.gullible ?? true;
  world.payments.faults.push(...(opts.paymentFaults ?? []));
  const runtime = new ToolRuntime(world);
  const budget = new BudgetTracker(opts.limits ?? DEFAULT_LIMITS, { input: 3000, output: 400, ms: 1500 });
  const tracer = new Tracer();
  const ctx: Ctx = { ticket, notified: false, injectionTried: false, falseFinishTried: false, approvedAmount: null, failures: {} };
  const m = new Machine({ goal_met: () => goalVeto(ctx) });
  const blocked: string[] = [];
  let approvals = 0;
  let vetoes = 0;
  let pending: Call | null = null;
  let observation: ToolResult | null = null;
  let agentMs = 0;
  const root = tracer.start('agent.run', null, { ticket: ticket.id, order: ticket.orderId });

  m.send('start');
  while (!isTerminal(m.state)) {
    if (m.state === 'planning') {
      const u = stepUsage(budget.used.steps);
      if (!budget.check(u).ok) {
        const s = tracer.start('handoff', root, { reason: 'budget' });
        budget.charge(budget.reserve);
        tracer.advance(budget.reserve.ms);
        agentMs += budget.reserve.ms;
        tracer.end(s);
        m.send('budget_exhausted');
        break;
      }
      const s = tracer.start('llm.plan', root, { step: budget.used.steps + 1, input_tokens: u.input, output_tokens: u.output });
      budget.charge(u);
      tracer.advance(u.ms);
      agentMs += u.ms;
      const action = plan(ctx, gullible, opts.maxReplans ?? 2, opts.falseFinish ?? false);
      tracer.end(s, 'ok', { action: action.kind === 'tool' ? action.call.tool : action.kind });
      if (action.kind === 'finish') {
        try {
          m.send('goal_met');
        } catch (e) {
          // вето guard не роняет прогон: автомат остаётся в planning, модель получает причину
          if (!(e instanceof GuardVeto)) throw e;
          vetoes++;
          blocked.push('goal_guard');
          tracer.end(tracer.start('guard.veto', root, { reason: e.reason }), 'error', { rule: 'goal_guard' });
        }
        continue;
      }
      if (action.kind === 'give_up') { m.send('give_up'); continue; }
      pending = action.call;
      const allowed = checkCall(sandboxCtx(ctx, world), pending).allowed;
      const needs = allowed && pending.tool === 'create_refund' && ctx.approvedAmount === null &&
        approvalReasons(requestOf(ctx, world, pending.args.amount as number)).length > 0;
      m.send(needs ? 'need_approval' : 'plan_ready');
    } else if (m.state === 'waiting_approval') {
      approvals++;
      const s = tracer.start('approval.wait', root, { amount: pending!.args.amount as number });
      tracer.advance(APPROVAL_WAIT_MS);
      const answer = opts.approval ?? 'approved';
      tracer.end(s, 'ok', { answer });
      if (answer === 'approved') { ctx.approvedAmount = pending!.args.amount as number; m.send('approved'); }
      else if (answer === 'rejected') { ctx.human = 'rejected'; m.send('rejected'); }
      else m.send('approval_timeout');
    } else if (m.state === 'acting') {
      const call = pending!;
      const s = tracer.start(`tool.${call.tool}`, root, { args: JSON.stringify(call.args) });
      const d = checkCall(sandboxCtx(ctx, world), call);
      if (!d.allowed) {
        blocked.push(d.rule);
        observation = { ok: false, error: { code: 'denied', message: `runtime запретил: ${d.rule}`, retryable: false } };
        tracer.end(s, 'error', { denied: d.rule });
      } else {
        const spec = runtime.spec(call.tool)!;
        const key = spec.kind === 'write' ? `${ticket.id}:${call.tool}` : undefined;
        const out = retry((attempt) => {
          const a = tracer.start('attempt', s, { n: attempt });
          tracer.advance(TOOL_MS);
          agentMs += TOOL_MS;
          budget.chargeTime(TOOL_MS);
          const r = runtime.call(call.tool, call.args, key);
          tracer.end(a, r.ok ? 'ok' : 'error', r.ok ? {} : { code: r.error.code });
          if (!r.ok && r.error.retryable) throw { code: r.error.code };
          return r;
        }, {
          maxAttempts: 4, base: 200, cap: 2000, seed: 7, isWrite: spec.kind === 'write', hasKey: key !== undefined,
          wait: (ms) => { tracer.advance(ms); agentMs += ms; budget.chargeTime(ms); },
        });
        observation = out.ok ? out.value! : { ok: false, error: { code: out.lastCode ?? 'unknown', message: 'повторы исчерпаны', retryable: false } };
        tracer.end(s, observation.ok ? 'ok' : 'error', { attempts: out.attempts });
      }
      m.send('tool_done');
    } else if (m.state === 'observing') {
      absorb(ctx, pending!, observation!);
      m.send('continue');
    }
  }
  tracer.end(root, m.state === 'done' ? 'ok' : 'error', { state: m.state });
  const order = world.orders.get(ticket.orderId)!;
  return {
    state: m.state,
    steps: budget.used.steps,
    toolCalls: runtime.calls.length,
    refunds: world.payments.refunds.length,
    refunded: order.refunded,
    messages: world.notifier.sent.length,
    blocked,
    approvals,
    vetoes,
    cost: budget.used.cost,
    budgetMs: budget.used.ms,
    agentMs,
    wallMs: tracer.now,
    spans: tracer.spans,
    transitions: m.history.map((h) => `${h.from}>${h.to}`),
  };
}

function absorb(ctx: Ctx, call: Call, r: ToolResult): void {
  if (!r.ok) {
    if (r.error.code !== 'denied') ctx.failures[call.tool] = (ctx.failures[call.tool] ?? 0) + 1;
    return;
  }
  ctx.failures[call.tool] = 0;
  const data = r.data as Record<string, unknown>;
  if (call.tool === 'get_order') ctx.order = { total: data.total as number, refunded: data.refunded as number };
  if (call.tool === 'check_refund_policy') ctx.policy = { eligible: data.eligible as boolean, amount: data.amount as number, reason: data.reason as string };
  if (call.tool === 'create_refund') ctx.refundId = data.id as string;
  if (call.tool === 'send_message') ctx.notified = true;
}

function sandboxCtx(ctx: Ctx, world: World) {
  return {
    phase: phaseOf(ctx),
    orderId: ctx.ticket.orderId,
    customerId: ctx.ticket.customerId,
    order: world.orders.get(ctx.ticket.orderId)!,
    policyChecked: ctx.policy !== undefined,
    approvedAmount: ctx.approvedAmount,
  };
}

function requestOf(ctx: Ctx, world: World, amount: number) {
  const o = world.orders.get(ctx.ticket.orderId)!;
  const c = world.customers.get(ctx.ticket.customerId)!;
  return {
    ticketId: ctx.ticket.id, orderId: o.id, customer: c.name, item: o.item, amount,
    orderTotal: o.total, deliveredDaysAgo: o.deliveredDaysAgo, refundsLast30d: c.refundsLast30d, customerText: ctx.ticket.email,
  };
}

/** Набор сценариев сквозного сюжета. */
export function scenarios() {
  return {
    small: runAgent(TICKETS.small),
    largeApproved: runAgent(TICKETS.large, { approval: 'approved' }),
    largeRejected: runAgent(TICKETS.large, { approval: 'rejected' }),
    largeSilent: runAgent(TICKETS.large, { approval: 'silent' }),
    late: runAgent(TICKETS.late),
    injection: runAgent(TICKETS.injection),
    timeoutAfter: runAgent(TICKETS.small, { paymentFaults: ['timeout_after'] }),
    flaky: runAgent(TICKETS.small, { paymentFaults: ['unavailable', 'unavailable'] }),
    tinyBudget: runAgent(TICKETS.small, { limits: { ...DEFAULT_LIMITS, cost: 0.03 } }),
    outage: runAgent(TICKETS.small, { paymentFaults: Array(40).fill('unavailable') }),
    outageNoLimit: runAgent(TICKETS.small, { paymentFaults: Array(40).fill('unavailable'), maxReplans: Infinity }),
  };
}

