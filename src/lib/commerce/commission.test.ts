import { describe, expect, it } from "vitest";
import { computeCommission } from "./commission";

describe("computeCommission", () => {
  it("splits a sale at the configured percentage", () => {
    expect(computeCommission(4900, 20)).toEqual({ grossCents: 4900, commissionCents: 980, sellerNetCents: 3920 });
  });

  it("rounds the commission to the nearest cent", () => {
    // 999 * 0.2 = 199.8 -> rounds to 200
    expect(computeCommission(999, 20)).toEqual({ grossCents: 999, commissionCents: 200, sellerNetCents: 799 });
  });

  it("handles 0% commission (seller keeps everything)", () => {
    expect(computeCommission(5000, 0)).toEqual({ grossCents: 5000, commissionCents: 0, sellerNetCents: 5000 });
  });

  it("handles 100% commission", () => {
    expect(computeCommission(5000, 100)).toEqual({ grossCents: 5000, commissionCents: 5000, sellerNetCents: 0 });
  });

  it("handles a zero-cent (free product) sale", () => {
    expect(computeCommission(0, 20)).toEqual({ grossCents: 0, commissionCents: 0, sellerNetCents: 0 });
  });
});
