// Mirrors the backend's commission detection in
// backend/app/api/crm/stats.py::_commission_kind: any sale whose
// `product_or_service` starts with "Comisión" is brokerage income.
// Seed templates use the accented form (see backend seed data).
const COMMISSION_PREFIX = "Comisión";

export function isCommissionSale(productOrService: string | null | undefined): boolean {
  if (!productOrService) return false;
  return productOrService.startsWith(COMMISSION_PREFIX);
}

export function sumCommissions<T extends { product_or_service: string; amount: string | number }>(
  sales: readonly T[],
): number {
  let total = 0;
  for (const s of sales) {
    if (isCommissionSale(s.product_or_service)) total += Number(s.amount || 0);
  }
  return total;
}
