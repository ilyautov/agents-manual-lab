import { raceDemo, REFUND_DAG, schedule } from './dag.ts';
const s = schedule(REFUND_DAG);
for (const t of REFUND_DAG) console.log(`${t.id.padEnd(16)} ${String(s.finish.get(t.id)! - t.ms).padStart(5)} → ${s.finish.get(t.id)} мс`);
console.log(`последовательно ${s.sequential} мс, параллельно ${s.makespan} мс, критический путь: ${s.criticalPath.join(' → ')}`);
console.log('гонка двух возвратов:', raceDemo());
