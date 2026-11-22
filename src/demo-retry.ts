import { backoff, CircuitBreaker, fullJitter, herdPeak, simulateOutage } from './retry.ts';
import { mulberry32 } from './util.ts';
console.log('backoff:    ', backoff(6, 200, 5000).join(', '));
console.log('full jitter:', fullJitter(6, 200, 5000, mulberry32(42)).join(', '));
console.log('пик в окне 10 мс, 1000 клиентов: без jitter', herdPeak(1000, 5, 200, 5000, 10, false), ', с jitter', herdPeak(1000, 5, 200, 5000, 10, true, 9));
console.log('авария 60 с без breaker:', simulateOutage({ downMs: 60000, durationMs: 120000, attempts: 3 }));
console.log('авария 60 с с breaker:  ', simulateOutage({ downMs: 60000, durationMs: 120000, attempts: 3, breaker: new CircuitBreaker(5, 10000) }));
