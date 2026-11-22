import { evaluateSandbox, secondLine } from './sandbox.ts';
import { INJECTED_EMAIL, makeWorld } from './shop.ts';
console.log('письмо клиента:', INJECTED_EMAIL, '\n');
const r = evaluateSandbox(makeWorld().orders.get('A-1004')!);
for (const a of r.attacks) console.log(`ЗАПРЕТ  ${a.label.padEnd(32)} ${a.allowed ? 'пропущено' : a.rule}`);
for (const a of secondLine(makeWorld().orders.get('A-1004')!)) console.log(`ВТОРАЯ  ${a.label.padEnd(32)} без ${a.first}: ${a.second === 'none' ? 'пройдёт' : a.second}`);
for (const a of r.legit) console.log(`ЗАКОННО ${a.label.padEnd(32)} ${a.allowed ? 'разрешено' : a.rule}`);
