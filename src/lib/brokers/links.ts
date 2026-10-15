// How a broker's buttons link out. Pure so the rules are tested: the affiliate/referral link is used for
// the main button only when one is configured, it is always labelled and marked `sponsored`, and every
// external link opens safely (no opener, no referrer).

export interface BrokerLinks {
  officialUrl: string;
  affiliateUrl: string | null;
}

export interface BrokerCta {
  href: string;
  label: string;
  rel: string;
  isAffiliate: boolean;
}

const SAFE_REL = "noopener noreferrer";

export function brokerCta(broker: BrokerLinks): BrokerCta {
  if (broker.affiliateUrl) {
    return { href: broker.affiliateUrl, label: "Join Broker", rel: `sponsored nofollow ${SAFE_REL}`, isAffiliate: true };
  }
  return { href: broker.officialUrl, label: "Visit Broker", rel: SAFE_REL, isAffiliate: false };
}

/** Secondary link to the broker's own site — shown only when the main button is an affiliate link. */
export function officialLink(broker: BrokerLinks): { href: string; rel: string } | null {
  return broker.affiliateUrl ? { href: broker.officialUrl, rel: SAFE_REL } : null;
}

/** `example.com` for display next to a link. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
