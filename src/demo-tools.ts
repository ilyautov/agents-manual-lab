import { SPECS, ToolRuntime, validateArgs } from './tools.ts';
import { makeWorld } from './shop.ts';
const spec = SPECS.find((s) => s.name === 'create_refund')!;
console.log('ошибки валидации:', validateArgs(spec, { orderId: 'A1004', amount: -500, card: '2200' }));
const world = makeWorld();
const rt = new ToolRuntime(world);
for (let i = 0; i < 3; i++) console.log(rt.call('create_refund', { orderId: 'A-1001', amount: 1990 }, 'T-1:create_refund'));
console.log('без ключа:', rt.call('create_refund', { orderId: 'A-1001', amount: 1990 }));
console.log('возвратов у провайдера:', world.payments.refunds.length);
