// Israeli VAT. All prices in the app are VAT-inclusive; for VAT-liable
// businesses (עוסק מורשה) documents show the breakdown carved out of the total.
export const VAT_RATE = 0.18;

export function vatBreakdown(totalInclusive: number): { net: number; vat: number } {
  const net = Math.round((totalInclusive / (1 + VAT_RATE)) * 100) / 100;
  return { net, vat: Math.round((totalInclusive - net) * 100) / 100 };
}
