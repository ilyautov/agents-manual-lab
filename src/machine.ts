/** Глава 2: агент как конечный автомат с явной таблицей переходов. */

export type State =
  | 'idle' | 'planning' | 'acting' | 'observing'
  | 'waiting_approval' | 'done' | 'failed' | 'handed_off';

export type AgentEvent =
  | 'start' | 'plan_ready' | 'need_approval' | 'approved' | 'rejected'
  | 'approval_timeout' | 'tool_done' | 'continue' | 'goal_met'
  | 'give_up' | 'budget_exhausted';

export const STATES: readonly State[] = [
  'idle', 'planning', 'acting', 'observing', 'waiting_approval', 'done', 'failed', 'handed_off',
];

export const TRANSITIONS: Record<State, Partial<Record<AgentEvent, State>>> = {
  idle: { start: 'planning' },
  planning: {
    plan_ready: 'acting', need_approval: 'waiting_approval', goal_met: 'done',
    give_up: 'failed', budget_exhausted: 'handed_off',
  },
  acting: { tool_done: 'observing', budget_exhausted: 'handed_off' },
  observing: { continue: 'planning', goal_met: 'done', give_up: 'failed', budget_exhausted: 'handed_off' },
  waiting_approval: { approved: 'acting', rejected: 'planning', approval_timeout: 'handed_off' },
  done: {},
  failed: {},
  handed_off: {},
};

export class ForbiddenTransition extends Error {
  readonly from: State;
  readonly event: AgentEvent;
  constructor(from: State, event: AgentEvent) {
    super(`переход ${from} --${event}--> запрещён`);
    this.from = from;
    this.event = event;
  }
}

/** Охранное условие отклонило переход: состояние не меняется, причина уходит в наблюдение модели. */
export class GuardVeto extends Error {
  readonly event: AgentEvent;
  readonly reason: string;
  constructor(event: AgentEvent, reason: string) {
    super(`guard ${event}: ${reason}`);
    this.event = event;
    this.reason = reason;
  }
}

export const EVENTS: readonly AgentEvent[] = [
  'start', 'plan_ready', 'need_approval', 'approved', 'rejected',
  'approval_timeout', 'tool_done', 'continue', 'goal_met', 'give_up', 'budget_exhausted',
];

export function next(state: State, event: AgentEvent): State {
  const to = TRANSITIONS[state][event];
  if (to === undefined) throw new ForbiddenTransition(state, event);
  return to;
}

export function isTerminal(state: State): boolean {
  return Object.keys(TRANSITIONS[state]).length === 0;
}

/** Автомат с историей и охранными условиями (guard) на событиях. */
export class Machine {
  state: State = 'idle';
  readonly history: { from: State; event: AgentEvent; to: State }[] = [];
  private readonly guards: Partial<Record<AgentEvent, () => string | null>>;

  constructor(guards: Partial<Record<AgentEvent, () => string | null>> = {}) {
    this.guards = guards;
  }

  send(event: AgentEvent): State {
    const to = next(this.state, event);
    const veto = this.guards[event]?.();
    if (veto) throw new GuardVeto(event, veto);
    this.history.push({ from: this.state, event, to });
    this.state = to;
    return to;
  }
}

export function machineStats() {
  const edges = STATES.flatMap((s) => Object.values(TRANSITIONS[s]).map((to) => `${s}>${to}`));
  const pairs = new Set(edges);
  return {
    states: STATES.length,
    terminal: STATES.filter(isTerminal).length,
    transitions: edges.length,
    allowedPairs: pairs.size,
    allPairs: STATES.length * STATES.length,
    events: EVENTS.length,
    eventPairs: STATES.length * EVENTS.length,
  };
}
