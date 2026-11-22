import { scenarios } from './agent.ts';
for (const [name, r] of Object.entries(scenarios())) {
  console.log(`${name.padEnd(14)} ${r.state.padEnd(11)} шагов ${String(r.steps).padStart(2)}  вызовов ${String(r.toolCalls).padStart(2)}  возвратов ${r.refunds} (${r.refunded} ₽)  писем ${r.messages}  заблокировано ${r.blocked.length}  ${r.cost.toFixed(3)} $`);
}
