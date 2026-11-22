/** Глава 11: трасса из спанов, поиск причины сбоя, перцентили времени ответа. */
import { mulberry32, normal } from './util.ts';

export interface Span {
  id: string;
  parentId: string | null;
  name: string;
  startMs: number;
  endMs: number;
  status: 'ok' | 'error';
  attrs: Record<string, string | number | boolean>;
}

/** Трассировщик с внешними часами: время задаёт вызывающий код, поэтому всё детерминировано. */
export class Tracer {
  readonly spans: Span[] = [];
  now = 0;

  start(name: string, parentId: string | null, attrs: Span['attrs'] = {}): string {
    const id = `s${this.spans.length + 1}`;
    this.spans.push({ id, parentId, name, startMs: this.now, endMs: -1, status: 'ok', attrs });
    return id;
  }

  end(id: string, status: 'ok' | 'error' = 'ok', attrs: Span['attrs'] = {}): void {
    const s = this.spans.find((x) => x.id === id)!;
    s.endMs = this.now;
    s.status = status;
    Object.assign(s.attrs, attrs);
  }

  advance(ms: number): void {
    this.now += ms;
  }
}

/**
 * Причина сбоя: среди спанов с ошибкой берём тот, у которого нет дочерних спанов с ошибкой,
 * и из таких самый ранний по окончанию. Родители с ошибкой только пересказывают её.
 */
export function rootCause(spans: Span[]): Span | null {
  const errors = spans.filter((s) => s.status === 'error');
  const leaves = errors.filter((e) => !errors.some((c) => c.parentId === e.id));
  leaves.sort((a, b) => a.endMs - b.endMs);
  return leaves.length > 0 ? leaves[0] : null;
}

export function pathTo(spans: Span[], id: string): string[] {
  const names: string[] = [];
  let cur = spans.find((s) => s.id === id);
  while (cur) {
    names.unshift(cur.name);
    cur = spans.find((s) => s.id === cur!.parentId);
  }
  return names;
}

/** Перцентиль методом ближайшего ранга: наименьшее значение, которого не превышают по крайней мере q·100% выборки. */
export function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(q * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}

/** Время ответа 200 прогонов: логнормальная, медиана около 6 с, плюс редкие долгие повторы. */
export function sampleLatencies(n: number, seed: number): number[] {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const base = 6000 * Math.exp(0.35 * normal(rand));
    const retryPenalty = rand() < 0.08 ? 9000 + 6000 * rand() : 0;
    return Math.round(base + retryPenalty);
  });
}

export interface RunRecord { success: boolean; steps: number; cost: number; ms: number }

export function summarize(runs: RunRecord[]) {
  const ms = runs.map((r) => r.ms);
  return {
    runs: runs.length,
    successRate: runs.filter((r) => r.success).length / runs.length,
    meanSteps: runs.reduce((s, r) => s + r.steps, 0) / runs.length,
    meanCost: runs.reduce((s, r) => s + r.cost, 0) / runs.length,
    meanMs: ms.reduce((a, b) => a + b, 0) / ms.length,
    p50: percentile(ms, 0.5),
    p95: percentile(ms, 0.95),
  };
}
