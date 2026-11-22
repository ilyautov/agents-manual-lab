/** Глава 10: DAG зависимостей, критический путь, гонка за общий ресурс. */

export interface Task { id: string; ms: number; deps: string[] }

/** Задача возврата как граф: чтения независимы, запись ждёт проверок. */
export const REFUND_DAG: Task[] = [
  { id: 'read_order', ms: 300, deps: [] },
  { id: 'read_customer', ms: 250, deps: [] },
  { id: 'read_policy', ms: 200, deps: [] },
  { id: 'read_email', ms: 150, deps: [] },
  { id: 'fraud_check', ms: 900, deps: ['read_order', 'read_customer'] },
  { id: 'policy_check', ms: 400, deps: ['read_order', 'read_policy', 'read_email'] },
  { id: 'create_refund', ms: 700, deps: ['fraud_check', 'policy_check'] },
  { id: 'notify_customer', ms: 300, deps: ['create_refund'] },
  { id: 'update_crm', ms: 350, deps: ['create_refund'] },
];

export function topoOrder(tasks: Task[]): string[] {
  const indeg = new Map(tasks.map((t) => [t.id, t.deps.length]));
  const queue = tasks.filter((t) => t.deps.length === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const t of tasks) {
      if (t.deps.includes(id)) {
        indeg.set(t.id, indeg.get(t.id)! - 1);
        if (indeg.get(t.id) === 0) queue.push(t.id);
      }
    }
  }
  if (order.length !== tasks.length) throw new Error('в графе есть цикл');
  return order;
}

/** Расписание при неограниченном параллелизме: старт = максимум окончаний зависимостей. */
export function schedule(tasks: Task[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const finish = new Map<string, number>();
  for (const id of topoOrder(tasks)) {
    const t = byId.get(id)!;
    const start = Math.max(0, ...t.deps.map((d) => finish.get(d)!));
    finish.set(id, start + t.ms);
  }
  const makespan = Math.max(...finish.values());
  // критический путь: от последней задачи назад по зависимости, которая закончилась позже всех
  let cur = [...finish.entries()].find(([, f]) => f === makespan)![0];
  const path = [cur];
  while (byId.get(cur)!.deps.length) {
    const deps = byId.get(cur)!.deps;
    cur = deps.reduce((a, b) => (finish.get(a)! >= finish.get(b)! ? a : b));
    path.unshift(cur);
  }
  const sequential = tasks.reduce((s, t) => s + t.ms, 0);
  return { makespan, sequential, criticalPath: path, speedup: sequential / makespan, finish };
}

/** Гонка главы 10: остаток по заказу Бориса и суммы двух одновременных просьб. */
export const RACE = { remaining: 12500, a: 5000, b: 9000 } as const;

type Op = { agent: 0 | 1; kind: 'read' | 'write' };

/** Все порядки четырёх операций, в которых каждый исполнитель читает раньше, чем пишет. */
export function interleavings(): Op[][] {
  const ops: Op[] = [{ agent: 0, kind: 'read' }, { agent: 0, kind: 'write' }, { agent: 1, kind: 'read' }, { agent: 1, kind: 'write' }];
  const out: Op[][] = [];
  const walk = (prefix: Op[], rest: Op[]) => {
    if (!rest.length) { out.push(prefix); return; }
    rest.forEach((op, i) => {
      const readDone = op.kind === 'read' || prefix.some((p) => p.agent === op.agent && p.kind === 'read');
      if (readDone) walk([...prefix, op], rest.filter((_, j) => j !== i));
    });
  };
  walk([], ops);
  return out;
}

/**
 * Два исполнителя оформляют возвраты по одному заказу. Каждый читает остаток и версию,
 * проверяет «сумма не больше остатка» по прочитанному и пишет. Провайдер в этом опыте
 * остаток не проверяет (его знает только магазин), поэтому вся защита на стороне агента.
 * С проверкой версии запись проходит, только если версия не изменилась с чтения;
 * при конфликте исполнитель перечитывает остаток и проверяет заново.
 */
export function runRace(order: Op[], useVersion: boolean, remaining: number = RACE.remaining, amounts: [number, number] = [RACE.a, RACE.b]) {
  const ledger = { left: remaining, version: 1, refunded: 0 };
  const snap: ({ left: number; version: number } | null)[] = [null, null];
  let conflicts = 0;
  let rejected = 0;
  let reread: number | null = null;
  for (const op of order) {
    if (op.kind === 'read') { snap[op.agent] = { left: ledger.left, version: ledger.version }; continue; }
    const amount = amounts[op.agent];
    let s = snap[op.agent]!;
    if (useVersion && s.version !== ledger.version) {
      conflicts++;
      s = { left: ledger.left, version: ledger.version };
      reread = s.left;
    }
    if (amount > s.left) { rejected++; continue; }
    ledger.left -= amount;
    ledger.refunded += amount;
    ledger.version++;
  }
  return { refunded: ledger.refunded, overpaid: Math.max(0, ledger.refunded - remaining), conflicts, rejected, reread };
}

/** Итог по всем порядкам операций: сколько из них дают переплату без версии и с версией. */
export function raceDemo() {
  const orders = interleavings();
  const naive = orders.map((o) => runRace(o, false));
  const versioned = orders.map((o) => runRace(o, true));
  // худший порядок: оба прочитали до того, как кто-то записал
  const worst = orders.findIndex((o) => o[0].kind === 'read' && o[1].kind === 'read' && o[2].agent === 0);
  return {
    orders: orders.length,
    overpaidOrders: naive.filter((r) => r.overpaid > 0).length,
    overpaidOrdersVersioned: versioned.filter((r) => r.overpaid > 0).length,
    naive: naive[worst],
    versioned: versioned[worst],
  };
}
