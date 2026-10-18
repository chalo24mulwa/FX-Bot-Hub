// Prices are stored as integer cents (Product.priceCents) but sellers think and type in dollars.
// These two pure functions are the only conversion between "49.00" on screen and 4900 in the database.

export const MAX_PRICE_CENTS = 100_000_000; // $1,000,000.00 — well above any real listing, and keeps the integer safe

/** 4900 -> "49.00", 0 -> "0.00". Non-finite/negative values show as 0.00. */
export function centsToDollarString(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0) return "0.00";
  const whole = Math.floor(cents / 100);
  const fraction = Math.round(cents % 100);
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}

/**
 * What a seller typed to integer cents, or null if it isn't a valid non-negative amount.
 * Accepts "49", "49.5", "49.50", "$49.50", "1,200.00", ".99"; rejects negatives, more than two decimals,
 * letters, and anything above the maximum. Never rounds silently: "0.999" is invalid, not 1.00.
 */
export function parseDollarsToCents(input: string): number | null {
  const text = input.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(text)) return null;
  const [whole = "0", fraction = ""] = text.split(".");
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) && cents <= MAX_PRICE_CENTS ? cents : null;
}
