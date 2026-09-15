export interface CommissionSplit {
  grossCents: number;
  commissionCents: number;
  sellerNetCents: number;
}

/**
 * Pure math, kept out of any service so it's unit-testable without a DB —
 * the admin-configurable `commissionPercent` (MarketplaceSettings, never
 * hard-coded) is the only input besides the sale amount. Rounds to the
 * nearest cent; a fractional cent of rounding drift per sale is accepted
 * rather than distributed, consistent with standard commission accounting.
 */
export function computeCommission(grossCents: number, commissionPercent: number): CommissionSplit {
  const commissionCents = Math.round(grossCents * (commissionPercent / 100));
  return { grossCents, commissionCents, sellerNetCents: grossCents - commissionCents };
}
