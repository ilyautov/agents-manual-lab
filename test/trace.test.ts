import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathTo, percentile, rootCause, sampleLatencies, summarize } from '../src/trace.ts';
import { scenarios } from '../src/agent.ts';

test('перцентиль методом ближайшего ранга', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(v, 0.5), 5);
  assert.equal(percentile(v, 0.95), 10);
  assert.equal(percentile(v, 0.1), 1);
});

test('время ответа 200 прогонов: p50 6,1 с, p95 16,9 с, среднее 7,3 с', () => {
  const lat = sampleLatencies(200, 5);
  assert.equal((percentile(lat, 0.5) / 1000).toFixed(1), '6.1');
  assert.equal((percentile(lat, 0.95) / 1000).toFixed(1), '16.9');
  assert.equal((lat.reduce((a, b) => a + b, 0) / lat.length / 1000).toFixed(1), '7.3');
});

test('по трассе сбоя находится первопричина: недоступен платёжный шлюз', () => {
  const r = scenarios().outage;
  const cause = rootCause(r.spans)!;
  assert.equal(cause.attrs.code, 'unavailable');
  assert.deepEqual(pathTo(r.spans, cause.id), ['agent.run', 'tool.create_refund', 'attempt']);
  assert.equal(r.spans.length, 26);
  assert.equal(r.spans.filter((s) => s.status === 'error').length, 16);
});

test('сводка по прогонам агента', () => {
  const runs = Object.values(scenarios()).map((r) => ({ success: r.state === 'done', steps: r.steps, cost: r.cost, ms: r.agentMs }));
  const s = summarize(runs);
  assert.equal(s.runs, 11);
  assert.equal(s.successRate.toFixed(3), (7 / 11).toFixed(3));
});
