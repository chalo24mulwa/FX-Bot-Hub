import { describe, expect, it } from "vitest";
import { generateCode, normalizeCode, signCodeCookie, verifyCodeCookie } from "./codes";
import {
  commissionAmount,
  decideOrderReferral,
  decideRecruiter,
  decideRegistrationAttribution,
  formatRate,
  holdUntil,
  isCommissionableOrder,
  maskDestination,
  planOrderCommissions,
  planPayout,
  planReversal,
  referredMemberLabel,
  summarizeCommissions,
  type CommissionPartnerInput,
  type PartnerRef,
} from "./rules";
import { DEFAULT_TERMS, fillTerms, parseTerms } from "./terms";

const NOW = new Date("2026-10-15T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const partner = (over: Partial<PartnerRef> = {}): PartnerRef => ({ id: "pA", userId: "uA", status: "APPROVED", ...over });

describe("codes and signed cookies", () => {
  it("generates codes in the unambiguous alphabet and normalises input", () => {
    const code = generateCode(() => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 30]));
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(normalizeCode("  ab12cd34 ")).toBe("AB12CD34");
    expect(normalizeCode("x")).toBeNull();
    expect(normalizeCode("abc-123")).toBeNull();
    expect(normalizeCode(42)).toBeNull();
  });

  it("verifies a signed cookie and rejects tampering, expiry and future timestamps", () => {
    const value = signCodeCookie("ABCD2345", daysAgo(3), "secret");
    expect(verifyCodeCookie(value, "secret", NOW, 30)).toEqual({ code: "ABCD2345", issuedAt: daysAgo(3) });
    expect(verifyCodeCookie(value, "other-secret", NOW, 30)).toBeNull();
    expect(verifyCodeCookie(value.replace("ABCD2345", "ZZZZ2345"), "secret", NOW, 30)).toBeNull();
    const [code, , sig] = value.split(".");
    expect(verifyCodeCookie(`${code}.${NOW.getTime()}.${sig}`, "secret", NOW, 30)).toBeNull(); // window extended
    expect(verifyCodeCookie(signCodeCookie("ABCD2345", daysAgo(31), "secret"), "secret", NOW, 30)).toBeNull();
    expect(verifyCodeCookie(signCodeCookie("ABCD2345", new Date(NOW.getTime() + 3_600_000), "secret"), "secret", NOW, 30)).toBeNull();
    expect(verifyCodeCookie("garbage", "secret", NOW, 30)).toBeNull();
    expect(verifyCodeCookie(undefined, "secret", NOW, 30)).toBeNull();
  });
});

describe("registration attribution", () => {
  const base = { newUserId: "uNew", now: NOW, attributionDays: 30 };
  it("links a new account to the Partner whose link was followed", () => {
    expect(decideRegistrationAttribution({ ...base, cookie: { partner: partner(), issuedAt: daysAgo(2) } })).toEqual({ partnerId: "pA", clickedAt: daysAgo(2) });
  });
  it("ignores expired clicks, inactive Partners, missing cookies and self-referrals", () => {
    expect(decideRegistrationAttribution({ ...base, cookie: { partner: partner(), issuedAt: daysAgo(31) } })).toBeNull();
    expect(decideRegistrationAttribution({ ...base, cookie: { partner: partner({ status: "SUSPENDED" }), issuedAt: daysAgo(1) } })).toBeNull();
    expect(decideRegistrationAttribution({ ...base, cookie: null })).toBeNull();
    expect(decideRegistrationAttribution({ ...base, cookie: { partner: partner({ userId: "uNew" }), issuedAt: daysAgo(1) } })).toBeNull();
  });
});

describe("order attribution", () => {
  const base = { buyerId: "uBuyer", now: NOW, attributionDays: 30, referredUserCommissionDays: 0 };
  const other = partner({ id: "pB", userId: "uB" });

  it("credits the account owner and never transfers to another Partner's link", () => {
    expect(
      decideOrderReferral({ ...base, owner: { partner: partner(), attributedAt: daysAgo(400) }, cookie: { partner: other, issuedAt: daysAgo(1) } }),
    ).toEqual({ kind: "credit", partnerId: "pA", source: "REGISTRATION" });
  });

  it("credits nobody when the owner is suspended (no silent transfer)", () => {
    expect(
      decideOrderReferral({
        ...base,
        owner: { partner: partner({ status: "SUSPENDED" }), attributedAt: daysAgo(5) },
        cookie: { partner: other, issuedAt: daysAgo(1) },
      }),
    ).toEqual({ kind: "none", reason: "owner_inactive" });
  });

  it("falls back to the last link within the window for unowned accounts", () => {
    expect(decideOrderReferral({ ...base, owner: null, cookie: { partner: other, issuedAt: daysAgo(29) } })).toEqual({
      kind: "credit",
      partnerId: "pB",
      source: "REFERRAL_LINK",
    });
    expect(decideOrderReferral({ ...base, owner: null, cookie: { partner: other, issuedAt: daysAgo(31) } })).toEqual({ kind: "none", reason: "expired" });
    expect(decideOrderReferral({ ...base, owner: null, cookie: null })).toEqual({ kind: "none", reason: "no_referral" });
  });

  it("rejects self-referral through a link", () => {
    expect(decideOrderReferral({ ...base, owner: null, cookie: { partner: partner({ userId: "uBuyer" }), issuedAt: daysAgo(1) } })).toEqual({
      kind: "none",
      reason: "self_referral",
    });
  });

  it("honours a limited ownership window when configured", () => {
    const input = { ...base, referredUserCommissionDays: 90, owner: { partner: partner(), attributedAt: daysAgo(100) } };
    expect(decideOrderReferral({ ...input, cookie: null })).toEqual({ kind: "none", reason: "no_referral" });
    expect(decideOrderReferral({ ...input, cookie: { partner: other, issuedAt: daysAgo(2) } })).toMatchObject({ kind: "credit", partnerId: "pB" });
  });
});

describe("recruitment", () => {
  const master = { id: "pM", userId: "uM", status: "APPROVED" as const, masterStatus: "APPROVED" as const, recruitedById: null };
  const base = { applicantUserId: "uX", applicantProfileId: "pX", existingRecruitedById: null };

  it("records an active Master Partner as recruiter", () => {
    expect(decideRecruiter({ ...base, master })).toEqual({ masterId: "pM" });
  });
  it("never replaces an existing recruiter, recruits self, uses an inactive master or creates a cycle", () => {
    expect(decideRecruiter({ ...base, existingRecruitedById: "pOther", master })).toMatchObject({ masterId: null, reason: "already_recruited" });
    expect(decideRecruiter({ ...base, applicantUserId: "uM", master })).toMatchObject({ reason: "self" });
    expect(decideRecruiter({ ...base, master: { ...master, masterStatus: "SUSPENDED" } })).toMatchObject({ reason: "inactive_master" });
    expect(decideRecruiter({ ...base, master: { ...master, status: "SUSPENDED" } })).toMatchObject({ reason: "inactive_master" });
    expect(decideRecruiter({ ...base, master: { ...master, recruitedById: "pX" } })).toMatchObject({ reason: "cycle" });
    expect(decideRecruiter({ ...base, master: null })).toMatchObject({ reason: "none" });
  });
});

describe("commission calculation", () => {
  const items = [{ orderItemId: "i1", basisCents: 1_000_000, categoryId: "c1" }]; // KSh 10,000.00
  const recruiter = { id: "pM", userId: "uM", status: "APPROVED" as const, masterStatus: "APPROVED" as const };
  const p = (over: Partial<CommissionPartnerInput> = {}): CommissionPartnerInput => ({
    id: "pA",
    userId: "uA",
    status: "APPROVED",
    masterStatus: "NOT_APPLIED",
    recruiter: null,
    ...over,
  });
  const run = (partnerInput: CommissionPartnerInput, extra: Partial<Parameters<typeof planOrderCommissions>[0]> = {}) =>
    planOrderCommissions({ buyerId: "uBuyer", partner: partnerInput, items, partnerRateBps: 2000, masterRateBps: 1000, eligibleCategoryIds: [], ...extra });

  it("pays a standard Partner 20%", () => {
    expect(run(p())).toEqual([
      {
        orderItemId: "i1",
        beneficiaryId: "pA",
        beneficiaryTier: "PARTNER",
        type: "PARTNER",
        rateBps: 2000,
        basisCents: 1_000_000,
        amountCents: 200_000,
        referringPartnerId: "pA",
        masterPartnerId: null,
      },
    ]);
  });

  it("adds a separate 10% for the recruiting Master Partner without reducing the Partner's 20%", () => {
    const rows = run(p({ recruiter }));
    expect(rows.map((r) => [r.beneficiaryId, r.type, r.amountCents])).toEqual([
      ["pA", "PARTNER", 200_000],
      ["pM", "MASTER_PARTNER", 100_000],
    ]);
    expect(rows.reduce((s, r) => s + r.amountCents, 0)).toBe(300_000);
    expect(rows.every((r) => r.basisCents === 1_000_000 && r.masterPartnerId === "pM")).toBe(true);
  });

  it("pays a Master Partner only 20% on their own referrals", () => {
    const rows = run(p({ id: "pM", userId: "uM", masterStatus: "APPROVED" }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ beneficiaryId: "pM", beneficiaryTier: "MASTER_PARTNER", type: "PARTNER", amountCents: 200_000 });
  });

  it("pays nothing for self-purchases, inactive Partners, free items or ineligible categories", () => {
    expect(run(p(), { buyerId: "uA" })).toEqual([]);
    expect(run(p({ status: "SUSPENDED" }))).toEqual([]);
    expect(run(p(), { items: [{ orderItemId: "i1", basisCents: 0, categoryId: null }] })).toEqual([]);
    expect(run(p(), { eligibleCategoryIds: ["c2"] })).toEqual([]);
    expect(run(p(), { eligibleCategoryIds: ["c1"] })).toHaveLength(1);
  });

  it("skips the master override when the master is suspended or is the buyer", () => {
    expect(run(p({ recruiter: { ...recruiter, masterStatus: "SUSPENDED" } }))).toHaveLength(1);
    expect(run(p({ recruiter }), { buyerId: "uM" })).toHaveLength(1);
  });

  it("rounds down and never pays more than the rate", () => {
    expect(commissionAmount(999, 2000)).toBe(199);
    expect(commissionAmount(1, 1000)).toBe(0);
    expect(commissionAmount(-5, 2000)).toBe(0);
  });

  it("only treats verified paid orders as commissionable", () => {
    const paid = { orderStatus: "PAID", payment: { status: "SUCCEEDED", provider: "MPESA" }, isProduction: true, allowManualPayments: false };
    expect(isCommissionableOrder(paid)).toBe(true);
    for (const orderStatus of ["PENDING", "FAILED", "CANCELLED", "REFUNDED"]) expect(isCommissionableOrder({ ...paid, orderStatus })).toBe(false);
    expect(isCommissionableOrder({ ...paid, payment: { status: "INITIATED", provider: "MPESA" } })).toBe(false);
    expect(isCommissionableOrder({ ...paid, payment: null })).toBe(false);
    expect(isCommissionableOrder({ ...paid, payment: { status: "SUCCEEDED", provider: "MANUAL" } })).toBe(false);
    expect(isCommissionableOrder({ ...paid, payment: { status: "SUCCEEDED", provider: "MANUAL" }, isProduction: false })).toBe(true);
    expect(isCommissionableOrder({ ...paid, payment: { status: "SUCCEEDED", provider: "MANUAL" }, allowManualPayments: true })).toBe(true);
  });

  it("computes the holding period", () => {
    expect(holdUntil(daysAgo(14), 14).getTime()).toBe(NOW.getTime());
  });
});

describe("reversals", () => {
  it("reverses unpaid commissions, detaches them from open payouts and flags paid ones", () => {
    expect(
      planReversal([
        { id: "a", status: "PENDING", payoutId: null, payoutStatus: null },
        { id: "b", status: "APPROVED", payoutId: "po1", payoutStatus: "REQUESTED" },
        { id: "c", status: "PAID", payoutId: "po0", payoutStatus: "PAID" },
        { id: "d", status: "REVERSED", payoutId: null, payoutStatus: null },
        { id: "e", status: "REJECTED", payoutId: null, payoutStatus: null },
      ]),
    ).toEqual({
      reverse: [
        { id: "a", detachFromPayoutId: null },
        { id: "b", detachFromPayoutId: "po1" },
      ],
      alreadyPaid: ["c"],
    });
  });
});

describe("balances and payouts", () => {
  it("summarises commission totals per currency", () => {
    expect(
      summarizeCommissions([
        { status: "PENDING", amountCents: 100, currency: "USD", payoutId: null },
        { status: "APPROVED", amountCents: 200, currency: "USD", payoutId: null },
        { status: "APPROVED", amountCents: 50, currency: "USD", payoutId: "po" },
        { status: "PAID", amountCents: 400, currency: "USD", payoutId: "po0" },
        { status: "REVERSED", amountCents: 10, currency: "USD", payoutId: null },
        { status: "APPROVED", amountCents: 7, currency: "KES", payoutId: null },
      ]),
    ).toEqual([
      { currency: "KES", pending: 0, approved: 7, available: 7, inPayout: 0, paid: 0, reversed: 0, rejected: 0 },
      { currency: "USD", pending: 100, approved: 250, available: 200, inPayout: 50, paid: 400, reversed: 10, rejected: 0 },
    ]);
  });

  const commissions = [
    { id: "a", status: "APPROVED" as const, payoutId: null, amountCents: 3000, orderStatus: "PAID" },
    { id: "b", status: "APPROVED" as const, payoutId: null, amountCents: 2500, orderStatus: "PAID" },
    { id: "c", status: "APPROVED" as const, payoutId: null, amountCents: 9999, orderStatus: "REFUNDED" },
    { id: "d", status: "PENDING" as const, payoutId: null, amountCents: 9999, orderStatus: "PAID" },
    { id: "e", status: "APPROVED" as const, payoutId: "po", amountCents: 9999, orderStatus: "PAID" },
  ];

  it("takes every approved, unattached commission on a still-paid order", () => {
    expect(planPayout({ partnerStatus: "APPROVED", hasOpenPayout: false, minPayoutCents: 5000, commissions })).toEqual({
      ok: true,
      amountCents: 5500,
      commissionIds: ["a", "b"],
    });
  });

  it("enforces the minimum, suspension and one open request at a time", () => {
    expect(planPayout({ partnerStatus: "APPROVED", hasOpenPayout: false, minPayoutCents: 6000, commissions })).toMatchObject({ ok: false });
    expect(planPayout({ partnerStatus: "SUSPENDED", hasOpenPayout: false, minPayoutCents: 0, commissions })).toMatchObject({ ok: false });
    expect(planPayout({ partnerStatus: "APPROVED", hasOpenPayout: true, minPayoutCents: 0, commissions })).toMatchObject({ ok: false });
    expect(planPayout({ partnerStatus: "APPROVED", hasOpenPayout: false, minPayoutCents: 0, commissions: [] })).toMatchObject({ ok: false });
  });
});

describe("presentation and terms", () => {
  it("formats rates, masks destinations and labels referred members privately", () => {
    expect(formatRate(2000)).toBe("20%");
    expect(formatRate(1250)).toBe("12.50%");
    expect(maskDestination("0712345678")).toBe("•••• 5678");
    expect(referredMemberLabel("  Jane  ", "cuid123abcdef")).toBe("Jane");
    expect(referredMemberLabel(null, "cuid123abcdef")).toBe("Member #ABCDEF");
  });

  it("fills the live settings into the terms and parses them into blocks", () => {
    const filled = fillTerms(DEFAULT_TERMS, {
      partnerRate: "20%",
      masterRate: "10%",
      attributionDays: 30,
      holdDays: 14,
      minPayout: "$50.00",
      referredUserCommissionDays: 0,
    });
    expect(filled).not.toMatch(/\{\{\w+\}\}/);
    expect(filled).toContain("additional 10%");
    const blocks = parseTerms(filled);
    expect(blocks[0].type).toBe("p");
    expect(blocks.filter((b) => b.type === "h2").map((b) => (b as { text: string }).text)).toContain("Master Partners");
    expect(parseTerms("## A\n- one\n- two\n\ntext")).toEqual([
      { type: "h2", text: "A" },
      { type: "ul", items: ["one", "two"] },
      { type: "p", text: "text" },
    ]);
  });
});
