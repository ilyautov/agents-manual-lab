import { bootstrapDiff, byCategory, cohenKappa, mcnemarExact, pairedDataset, pairedTable, wilson } from './eval.ts';
const rows = pairedDataset();
const t = pairedTable(rows);
console.log('парная таблица:', t);
console.log('A:', wilson(45, 60), 'B:', wilson(53, 60));
console.log('Макнемар p =', mcnemarExact(t.aOnly, t.bOnly).toFixed(3));
console.log('bootstrap:', bootstrapDiff(rows.map((r) => r.a), rows.map((r) => r.b), 10000, 2026));
console.log('каппа:', cohenKappa(48, 10, 6, 16));
console.table(byCategory(rows));
