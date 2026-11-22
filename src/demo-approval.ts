import { approvalCard, approvalReasons, sampleRefunds, thresholdTable } from './approval.ts';
const req = { ticketId: 'T-2', orderId: 'A-1002', customer: 'Борис', item: 'кофемашина', amount: 12500, orderTotal: 12500, deliveredDaysAgo: 3, refundsLast30d: 0, customerText: 'Кофемашина течёт, прошу возврат.' };
console.log(approvalCard(req, approvalReasons(req)));
for (const r of thresholdTable(sampleRefunds(1000, 11), [2000, 5000, 10000, 20000])) {
  console.log(`порог ${r.threshold}: человеку ${r.reviews} заявок (${(r.shareReviews * 100).toFixed(0)}%), под контролем ${(r.shareMoney * 100).toFixed(0)}% денег`);
}
