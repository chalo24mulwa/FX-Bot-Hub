/**
 * Programme terms. Admins can replace the text at /admin/partnership/settings
 * without a code change; until they do, DEFAULT_TERMS is shown. {{tokens}} are
 * filled from the live settings, so the terms always quote the current rates.
 *
 * Markup is deliberately tiny: "## " headings, "- " bullets, blank-line
 * paragraphs, plus the guides' inline **bold** / `code` / [label](href).
 * Parsed here (pure, unit-tested) and rendered as React elements only.
 */

export const DEFAULT_TERMS = `These terms explain how the FXBotHub Partnership Programme works. They are a starting point written by the FXBotHub team and **should be reviewed by a qualified adviser** against the laws that apply to you and to FXBotHub (for example consumer-protection, tax and data-protection rules) and against our payment providers' requirements before they are relied on.

## Who can take part
- You need a registered FXBotHub account in good standing.
- You apply from your account. Applications are reviewed by the FXBotHub team; we may approve or decline any application.
- Taking part as a Partner does not change your account in any other way — your purchases, seller listings and other permissions are unaffected.

## Commission
- Approved Partners earn {{partnerRate}} of the eligible sale amount of purchases attributed to them.
- The eligible sale amount is the product price actually paid for an order item. Products listed for free earn no commission.
- Commission is only earned on orders whose payment has been verified as successful. Unpaid, failed, pending or cancelled orders never earn commission.
- You cannot earn commission on your own purchases.
- Each commission records the rate and amount that applied when the sale was made. Later changes to the programme rates apply to future sales only.

## How referrals are tracked
- Your referral link adds \`?ref=YOUR-CODE\` to an FXBotHub address. When someone follows it, we store a referral cookie on their device for {{attributionDays}} days, recording your code and the time of the visit. We do not record their IP address for this purpose.
- If they register during that time, their account is linked to you. A linked account is never moved to another Partner.
- Purchases by an account linked to you are credited to you {{ownerWindow}}. For accounts that are not linked to a Partner, a purchase is credited to the last Partner link followed within {{attributionDays}} days before checkout.
- Visiting another Partner's link does not change who an existing account is linked to.

## Holding period and approval
- New commission stays **pending** for {{holdDays}} days after the payment is verified, so that refunds can be dealt with. After that it becomes **approved** and available for payout, unless the order has been refunded or is the subject of an open refund request.
- If an order is refunded or charged back, any commission on it that has not been paid out is reversed.
- Commission that has already been paid out is not reclaimed automatically; any adjustment is made by the FXBotHub team with a recorded reason.

## Payouts
- You can request a payout of your approved balance once it reaches {{minPayout}} in a currency.
- Payouts are reviewed and sent by the FXBotHub team using the method you choose from those offered. A payout is only marked as paid once the transfer has been made.
- You are responsible for any taxes due on your commission.

## Master Partners
- Approved Partners can apply to become a Master Partner. Approval is at FXBotHub's discretion.
- A Master Partner receives a recruitment link. When someone applies to the programme through it and is approved, they become one of the Master Partner's recruited Partners. A Partner can only ever have one recruiting Master Partner, and this cannot be changed later.
- A Master Partner earns an additional {{masterRate}} of the eligible sale amount of purchases credited to Partners they directly recruited. This is paid by FXBotHub and is never deducted from the recruited Partner's commission.
- A Master Partner's own referrals earn the standard {{partnerRate}} only.
- Recruitment is one level only. Nothing is earned for recruiting someone — only from eligible product sales.

## Fair use
- Do not refer yourself, create accounts to earn commission, use misleading claims, promise trading profits or guaranteed results, spam, or bid on FXBotHub brand terms in paid advertising.
- We may withhold, reject or reverse commission connected with fraud, abuse or a breach of these terms, and record the reason.

## Suspension and ending
- We may suspend or end a Partnership or Master Partnership. While suspended you earn no new commission and cannot request payouts; existing commission is reviewed case by case.
- You can stop taking part at any time by contacting us.

## Privacy
- Partners see a limited view of the members they referred: a display name or anonymous label, when they joined, and whether they have made an eligible purchase. Partners never see referred members' email addresses or payment details.

## Changes
- We may update these terms. The version shown on this page applies from the date it is published.`;

export interface TermsValues {
  partnerRate: string;
  masterRate: string;
  attributionDays: number;
  holdDays: number;
  minPayout: string;
  referredUserCommissionDays: number;
}

export function fillTerms(text: string, v: TermsValues): string {
  const ownerWindow =
    v.referredUserCommissionDays > 0 ? `for ${v.referredUserCommissionDays} days after they register` : "for as long as their account exists";
  const map: Record<string, string> = {
    partnerRate: v.partnerRate,
    masterRate: v.masterRate,
    attributionDays: String(v.attributionDays),
    holdDays: String(v.holdDays),
    minPayout: v.minPayout,
    ownerWindow,
  };
  return text.replace(/\{\{(\w+)\}\}/g, (m, key: string) => map[key] ?? m);
}

export type TermsBlock = { type: "h2"; text: string } | { type: "p"; text: string } | { type: "ul"; items: string[] };

export function parseTerms(text: string): TermsBlock[] {
  const blocks: TermsBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    if (list.length) blocks.push({ type: "ul", items: list });
    para = [];
    list = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("- ")) {
      if (para.length) {
        blocks.push({ type: "p", text: para.join(" ") });
        para = [];
      }
      list.push(line.slice(2).trim());
    } else {
      if (list.length) {
        blocks.push({ type: "ul", items: list });
        list = [];
      }
      para.push(line);
    }
  }
  flush();
  return blocks;
}
