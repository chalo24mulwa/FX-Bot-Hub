// Editorial copy for /best-brokers. Content-as-code, like Guides and Tutorials (this project has no CMS);
// the *brokers themselves* are managed in /admin/brokers. Nothing here makes a claim about a specific
// broker, a return, or a guarantee — it explains how to compare, in general terms.

export const PAGE_PATH = "/best-brokers";

export const SEO_TITLE = "Best Forex Brokers 2026 | Compare Trading Platforms | FXBotHub";
export const SEO_DESCRIPTION =
  "Compare forex brokers on FXBotHub. Explore trading platforms, verified regulation, account features, trading costs, and broker comparisons to find an option that suits your needs.";

export const HERO = {
  heading: "Find the Right Forex Broker for Your Trading Journey",
  text: "Compare forex brokers, explore their trading features, and find a platform that suits your trading needs.",
};

export const AFFILIATE_DISCLOSURE =
  "Advertising disclosure: some links on this page are affiliate or referral links. If you open an account through one, FXBotHub may earn a commission, at no extra cost to you where the broker's terms say so. Those links are labelled. A commission arrangement does not by itself decide a broker's position in the ranking.";

export const RATING_METHODOLOGY = {
  title: "How ratings work",
  body: [
    "A rating is an editorial score from 0.0 to 5.0 entered by the FXBotHub team for brokers we have chosen to rate, based on the information shown on that broker's listing (regulation, platforms, costs, account terms and range of instruments).",
    "It is an opinion on how well a broker fits the criteria above, not a measure of trading results, safety or suitability for you. Brokers without a rating are marked “Not rated”. The date next to a broker's facts is when we last checked them — check the broker's own site for current terms before you decide.",
  ],
};

export const RISK_WARNING =
  "Trading forex and other leveraged products carries a high level of risk and you can lose some or all of your money. Rankings and ratings on this page are editorial opinions, not financial advice, and no broker or platform guarantees profit. Only trade with money you can afford to lose.";

export interface ChooseItem {
  title: string;
  body: string;
}

export const HOW_TO_CHOOSE: ChooseItem[] = [
  {
    title: "Regulation",
    body: "Check which regulator supervises the broker and the legal entity you would actually open your account with — it can differ by country. Look the licence up on the regulator's own register rather than relying on a logo. Ask how client money is held and whether any compensation scheme applies where you live.",
  },
  {
    title: "Fees and spreads",
    body: "Compare the whole cost of trading: spreads, commissions, swap (overnight) charges, and fees for deposits, withdrawals or inactivity. A low advertised spread can come with a commission, and spreads widen around news — compare like with like on the account type you would really use.",
  },
  {
    title: "Trading platforms",
    body: "Make sure the broker offers the platform you use or want to learn (MT4, MT5, cTrader or a web platform), and works on your devices. If you run Expert Advisors, confirm the broker allows automated trading and test on a demo account first.",
  },
  {
    title: "Available instruments",
    body: "Check that the pairs and markets you trade are offered — majors, minors, metals, indices or others — and the contract sizes and leverage limits that apply to you.",
  },
  {
    title: "Deposits and withdrawals",
    body: "Look at the minimum deposit, the funding methods available in your country, processing times, and any withdrawal fees or conditions. Read how withdrawals work before you fund an account, not after.",
  },
  {
    title: "Risk management",
    body: "Decide how much you can afford to lose before you start, use stop-losses, size positions conservatively, and be cautious with leverage. A broker's features can't remove the risk of losing money.",
  },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ: FaqItem[] = [
  {
    question: "How do I choose a forex broker?",
    answer:
      "Start with regulation, then compare total trading costs, the platforms offered (such as MT4 or MT5), the instruments you want to trade, and how deposits and withdrawals work. Try a demo account before depositing real money, and read the broker's own terms and risk disclosures.",
  },
  {
    question: "Why is regulation important?",
    answer:
      "A regulated broker is supervised by a financial authority that sets rules on how clients' money is handled, how the firm operates and how complaints are dealt with. Regulation does not remove trading risk or guarantee a broker's performance, and protections differ by regulator and by country, so check what applies to you on the regulator's own website.",
  },
  {
    question: "What should I compare before opening an account?",
    answer:
      "Compare regulation and the entity you would join, spreads and commissions, minimum deposit, account types, trading platforms, available instruments and funding and withdrawal options. If you use Expert Advisors, check that automated trading is allowed.",
  },
  {
    question: "Does FXBotHub receive commissions from broker links?",
    answer:
      "Some brokers on this page have affiliate or referral links, and FXBotHub may earn a commission if you open an account through one — at no extra cost to you where the broker's terms say so. Those links are labelled. A commission arrangement does not by itself decide a broker's position in the ranking.",
  },
  {
    question: "Are broker rankings financial advice?",
    answer:
      "No. Rankings and ratings are editorial opinions based on the information shown on each listing, they are not personal recommendations, and they take no account of your circumstances. Do your own research and consider independent advice before you trade.",
  },
  {
    question: "Can I use Expert Advisors with any broker?",
    answer:
      "Not necessarily. Expert Advisors run on MT4 or MT5, so the broker needs to offer that platform, and some brokers restrict certain automated strategies. Check the broker's terms, and test any EA on a demo account first.",
  },
];

export interface InternalLink {
  href: string;
  title: string;
  text: string;
}

export const RELATED_LINKS: InternalLink[] = [
  { href: "/calendar", title: "News Calendar", text: "See high-impact releases before you trade around them." },
  { href: "/guides", title: "Guides", text: "Understand forex, automated trading and risk." },
  { href: "/tutorials", title: "Tutorials", text: "Step-by-step MT4 and MT5 walkthroughs." },
  { href: "/marketplace", title: "Marketplace", text: "Expert Advisors and indicators for MT4 and MT5." },
  { href: "/community", title: "Community", text: "Talk through ideas with other traders." },
];
