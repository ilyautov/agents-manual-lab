import { crashMatrix, runToCompletion } from './journal.ts';
const r = runToCompletion(['create_refund:after_effect'], true);
console.log('журнал после падения и восстановления:');
for (const e of r.journal) console.log(`  #${e.seq} ${e.step}`);
console.log('с ключами:', crashMatrix(true));
console.log('без ключей:', crashMatrix(false));
