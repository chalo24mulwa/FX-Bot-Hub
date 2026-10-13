import type { Guide } from "../types";

export const forexTradingForBeginners: Guide = {
  slug: "forex-trading-for-beginners",
  title: "Forex Trading for Beginners: A Practical Introduction",
  seoTitle: "Forex Trading for Beginners: Pairs, Pips, Lots and Spreads Explained",
  description:
    "A practical introduction to forex trading: how currency pairs are quoted, what pips, lots, spreads, leverage and margin mean, and how trading platforms fit in.",
  category: "getting-started",
  published: "2026-10-13",
  updated: "2026-10-13",
  intro:
    "This guide explains how the foreign exchange market works and the core vocabulary you need before using any trading platform, indicator or Expert Advisor: currency pairs, pips, lot sizes, spreads, leverage and margin.",
  riskDisclaimer: true,
  blocks: [
    { type: "h2", text: "What the forex market is" },
    {
      type: "p",
      text: "The foreign exchange (forex or FX) market is where currencies are exchanged for one another. Banks, businesses, funds and individual traders all take part, and trading runs around the clock from Monday to Friday as financial centres in Asia, Europe and North America open and close in turn.",
    },
    {
      type: "p",
      text: "Retail traders usually access the market through a **broker**, which provides a trading account and a platform such as [MetaTrader 4](/guides/how-to-install-metatrader-4) or [MetaTrader 5](/guides/how-to-install-metatrader-5). When you place a trade you are speculating on the exchange rate between two currencies rising or falling.",
    },

    { type: "h2", text: "Currency pairs and how quotes work" },
    {
      type: "p",
      text: "Currencies are always traded in pairs, such as EUR/USD. The first currency is the **base currency** and the second is the **quote currency**. A price of 1.0850 for EUR/USD means one euro costs 1.0850 US dollars.",
    },
    {
      type: "ul",
      items: [
        "**Buying (going long)** EUR/USD means you expect the euro to strengthen against the dollar.",
        "**Selling (going short)** EUR/USD means you expect the euro to weaken against the dollar.",
        "**Major pairs** include the US dollar paired with another widely traded currency, for example EUR/USD, GBP/USD, USD/JPY and USD/CHF.",
        "**Cross pairs** don't include the US dollar, for example EUR/GBP or AUD/JPY.",
      ],
    },
    {
      type: "p",
      text: "Every quote has two prices: the **bid** (the price you can sell at) and the **ask** (the price you can buy at). The ask is always slightly higher than the bid.",
    },

    { type: "h2", text: "Pips and pipettes" },
    {
      type: "p",
      text: "A **pip** is the standard unit for measuring price movement. For most pairs it is the fourth decimal place (0.0001). For pairs quoted against the Japanese yen, such as USD/JPY, it is the second decimal place (0.01).",
    },
    {
      type: "p",
      text: "Many brokers quote one extra digit, called a **pipette** or fractional pip. If EUR/USD moves from 1.08500 to 1.08550, that is a move of 5 pips (50 pipettes).",
    },

    { type: "h2", text: "Lot sizes" },
    { type: "p", text: "Trade size is expressed in **lots**. The common sizes are:" },
    {
      type: "table",
      caption: "Common forex lot sizes",
      headers: ["Lot", "Units of base currency", "Platform volume"],
      rows: [
        ["Standard lot", "100,000", "1.00"],
        ["Mini lot", "10,000", "0.10"],
        ["Micro lot", "1,000", "0.01"],
      ],
    },
    {
      type: "p",
      text: "For a pair quoted in US dollars, such as EUR/USD, one pip on a standard lot is worth about $10, on a mini lot about $1 and on a micro lot about $0.10. For other pairs the pip value depends on the quote currency and the current exchange rate, so check your platform or broker's calculator.",
    },

    { type: "h2", text: "Spreads and other trading costs" },
    {
      type: "p",
      text: "The **spread** is the difference between the bid and ask prices, and it is the main cost of most forex trades. If EUR/USD is quoted 1.08500 / 1.08512, the spread is 1.2 pips: a trade opened at that moment starts 1.2 pips in the negative.",
    },
    {
      type: "ul",
      items: [
        "Spreads usually widen when liquidity is thin — around market open, overnight and during major news releases.",
        "Some account types charge a **commission** per lot in exchange for tighter spreads.",
        "Positions held past the daily rollover may incur or earn a **swap** (overnight financing).",
      ],
    },
    {
      type: "p",
      text: "These costs matter even more for automated strategies that trade often, which is why spread and commission settings should match your real account when you [backtest an Expert Advisor](/guides/how-to-backtest-an-expert-advisor).",
    },

    { type: "h2", text: "Leverage and margin" },
    {
      type: "p",
      text: "**Leverage** lets you control a position larger than your account balance. With 1:30 leverage, opening a $30,000 position requires $1,000 of **margin** — the deposit your broker sets aside while the trade is open.",
    },
    {
      type: "p",
      text: "Leverage magnifies losses exactly as much as gains. If losses reduce your free margin too far, your broker may issue a margin call or close positions automatically (a stop-out). Read our guide to [drawdown, leverage, stop-losses and risk management](/guides/forex-risk-management-drawdown-leverage-stop-loss) before trading with real money.",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Leverage limits vary",
      text: "Maximum leverage differs by country, regulator, broker and instrument. Check your broker's terms rather than assuming a figure.",
    },

    { type: "h2", text: "Order types you'll see on every platform" },
    {
      type: "ul",
      items: [
        "**Market order** — buy or sell immediately at the current price.",
        "**Limit order** — buy below or sell above the current price, once the market reaches your level.",
        "**Stop order** — buy above or sell below the current price, often used to enter on a breakout.",
        "**Stop-loss** — closes a trade automatically at a set loss level.",
        "**Take-profit** — closes a trade automatically at a set profit level.",
      ],
    },

    { type: "h2", text: "Where indicators and Expert Advisors fit in" },
    {
      type: "p",
      text: "Trading platforms like MetaTrader let you add **indicators** — calculations drawn on your chart, such as moving averages — and **Expert Advisors (EAs)**, programs that can analyse the market and place trades automatically. Neither removes risk: an indicator only describes past and current prices, and an EA follows rules that may stop working when market conditions change. Learn more in [What is a forex Expert Advisor?](/guides/what-is-a-forex-expert-advisor)",
    },

    { type: "h2", text: "Sensible first steps" },
    {
      type: "steps",
      items: [
        { title: "Learn the platform on a demo account", text: "Most brokers offer free demo accounts with virtual money. Use one to practise placing, modifying and closing trades." },
        { title: "Decide your risk per trade", text: "Many traders limit each trade to a small, fixed percentage of their account. Work out your position size from your stop-loss distance, not from how confident you feel." },
        { title: "Keep a trading journal", text: "Record why you entered, where your stop-loss was and what happened. Patterns in your own decisions are easier to fix than you might expect." },
        { title: "Only move to a live account when you understand the costs", text: "Spreads, commissions and swaps all affect results. Start small, and never trade money you can't afford to lose." },
      ],
    },
  ],
  related: ["forex-risk-management-drawdown-leverage-stop-loss", "how-to-install-metatrader-5", "what-is-a-forex-expert-advisor"],
  cta: {
    label: "Browse forex indicators",
    href: "/marketplace?type=INDICATOR",
    text: "Ready to add tools to your charts? Explore indicators for MT4 and MT5 on the FXBotHub marketplace.",
  },
};
