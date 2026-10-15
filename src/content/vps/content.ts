// Editorial copy for /vps. Content-as-code, like Guides and Tutorials (this project has no CMS); the *providers*
// themselves are managed in /admin/vps. Nothing here makes a claim about a specific provider, a speed, an
// uptime figure, or a return — it explains in general terms why traders use a VPS and how to compare one.

export const PAGE_PATH = "/vps";

export const SEO_TITLE = "Best Forex VPS Hosting for MT4 & MT5 | FXBotHub";
export const SEO_DESCRIPTION =
  "Compare VPS hosting for forex trading, MT4 and MT5 Expert Advisors. Explore server locations, hosting specifications, pricing, and providers for running automated trading platforms.";

export const HERO = {
  heading: "Power Your Forex Bots with the Right VPS",
  text: "Discover VPS hosting providers designed to help forex traders run Expert Advisors around the clock, reduce interruptions caused by local computer or internet outages, and keep automated trading platforms connected.",
  primaryCta: "Explore VPS Providers",
  secondaryCta: "Why Use a VPS?",
};

export type WhyIcon = "clock" | "wifi" | "gauge" | "power" | "layers" | "remote";

export interface WhyItem {
  icon: WhyIcon;
  title: string;
  text: string;
}

export const WHY_HEADING = "Why Use a VPS for Forex Trading?";
export const WHY_INTRO = "A virtual private server (VPS) is a remote computer that stays on and connected. Traders put MetaTrader and their Expert Advisors on one for these reasons:";

export const WHY_ITEMS: WhyItem[] = [
  { icon: "clock", title: "24/7 Operation", text: "Run your trading platform without keeping your personal computer switched on." },
  { icon: "wifi", title: "Stable Connectivity", text: "Reduce dependence on your home or office internet connection." },
  {
    icon: "gauge",
    title: "Lower Latency",
    text: "A VPS near your broker's trading servers may reduce network delays, depending on the provider and server location.",
  },
  { icon: "power", title: "Fewer Local Interruptions", text: "Reduce disruptions caused by local power cuts, computer restarts, or internet outages." },
  {
    icon: "layers",
    title: "Multiple Trading Platforms",
    text: "Depending on its specifications, a VPS can host MT4, MT5, and compatible automated trading applications.",
  },
  { icon: "remote", title: "Remote Access", text: "Monitor and manage your trading environment remotely." },
];

export const WHO_HEADING = "Who Needs a Forex VPS?";
export const WHO_ITEMS: { title: string; text: string }[] = [
  { title: "Expert Advisor users", text: "An EA only trades while MetaTrader is open and connected, so an always-on machine matters." },
  { title: "Algorithmic traders", text: "Automated strategies that run around the clock need an environment that doesn't depend on a laptop." },
  { title: "Latency-sensitive scalpers", text: "Short-term traders may care about the distance between their server and the broker's." },
  { title: "Traders running several strategies", text: "Several terminals or EAs side by side need enough CPU, memory and storage to run smoothly." },
];

export const REALITY_NOTE =
  "A VPS does not guarantee profits, remove trading risk, or prevent every technical failure. Choose specifications and a server location that suit your broker and your platforms, and test your setup on a demo account first.";

export const PROVIDERS_HEADING = "Best VPS Providers for Forex Trading";

export const AFFILIATE_DISCLOSURE =
  "Advertising disclosure: some links on this page are affiliate or referral links. If you sign up through one, FXBotHub may earn a commission, at no extra cost to you where the provider's terms say so. Those links are labelled. A commission arrangement does not by itself decide a provider's position in the ranking.";

export const RATING_METHODOLOGY = {
  title: "How ratings work",
  body: [
    "A rating is an editorial score from 0.0 to 5.0 entered by the FXBotHub team for providers we have chosen to rate, based on the information shown on that provider's listing (specifications, server locations, pricing, trial terms and platform support).",
    "It is an opinion on how well a provider fits those criteria, not a measurement of speed, uptime or trading results. Providers without a rating are marked “Not rated”. The date next to a provider's facts is when we last checked them — confirm plans, prices and server locations on the provider's own site before you buy.",
  ],
};

export const RISK_WARNING =
  "Trading forex and other leveraged products carries a high level of risk and you can lose some or all of your money. Rankings and ratings on this page are editorial opinions, not financial advice, and no VPS or provider guarantees profit or uninterrupted trading. Only trade with money you can afford to lose.";

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ: FaqItem[] = [
  {
    question: "What is a forex VPS?",
    answer:
      "A forex VPS is a virtual private server — a remote computer that runs all day and night — used to host MetaTrader or another trading platform so your Expert Advisors keep running without your own computer. It is a hosting service, not a trading product.",
  },
  {
    question: "Do I need a VPS to run an Expert Advisor?",
    answer:
      "No, but an EA only trades while its platform is open and connected, so if your computer sleeps, restarts or loses internet, the EA stops with it. A VPS is one way to avoid that; some traders use a spare computer instead.",
  },
  {
    question: "How do I choose a VPS server location?",
    answer:
      "Many traders pick a data centre in the same region as their broker's trading servers, because a shorter network distance may mean lower delay. Ask your broker where its servers are, and test the connection from the VPS before you rely on it.",
  },
  {
    question: "What specifications do I need?",
    answer:
      "It depends on how many platforms and EAs you run. Each MetaTrader terminal uses memory and CPU, so more terminals and heavier strategies need more of both. Check the provider's own guidance and start with what you need, since you can usually change plans later.",
  },
  {
    question: "Does FXBotHub receive commissions from VPS links?",
    answer:
      "Some providers on this page have affiliate or referral links, and FXBotHub may earn a commission if you sign up through one — at no extra cost to you where the provider's terms say so. Those links are labelled. A commission arrangement does not by itself decide a provider's position in the ranking.",
  },
  {
    question: "Are the rankings financial advice?",
    answer:
      "No. Rankings and ratings are editorial opinions based on the information shown on each listing. They are not personal recommendations, they say nothing about trading results, and they take no account of your circumstances.",
  },
];

export interface InternalLink {
  href: string;
  title: string;
  text: string;
}

export const RELATED_LINKS: InternalLink[] = [
  { href: "/marketplace?type=EA", title: "Expert Advisors", text: "Browse EAs for MT4 and MT5 to run on your VPS." },
  { href: "/tutorials/install-ea-mt5", title: "Install an EA on MT5", text: "Step-by-step setup, on a VPS or your own computer." },
  { href: "/tutorials/troubleshoot-ea-not-trading", title: "EA stopped trading?", text: "Common causes, including disconnects and restarts." },
  { href: "/guides/what-is-a-forex-expert-advisor", title: "What is an Expert Advisor?", text: "A plain-English guide to automated trading." },
  { href: "/best-brokers", title: "Best Brokers", text: "Compare brokers, then pick a server near theirs." },
  { href: "/calendar", title: "News Calendar", text: "Check high-impact releases before automated trades." },
];
