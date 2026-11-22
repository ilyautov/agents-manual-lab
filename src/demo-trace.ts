import { pathTo, percentile, rootCause, sampleLatencies } from './trace.ts';
import { scenarios } from './agent.ts';
const r = scenarios().outage;
for (const s of r.spans) {
  const depth = pathTo(r.spans, s.id).length - 1;
  console.log(`${'  '.repeat(depth)}${s.name} [${s.startMs}–${s.endMs} мс] ${s.status}${s.attrs.code ? ' ' + s.attrs.code : ''}`);
}
const c = rootCause(r.spans)!;
console.log('первопричина:', pathTo(r.spans, c.id).join(' → '), c.attrs.code);
const lat = sampleLatencies(200, 5);
console.log(`p50 ${percentile(lat, 0.5)} мс, p95 ${percentile(lat, 0.95)} мс`);
