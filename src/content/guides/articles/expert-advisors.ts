import type { Guide } from "../types";

export const whatIsAnExpertAdvisor: Guide = {
  slug: "what-is-a-forex-expert-advisor",
  title: "What Is a Forex Expert Advisor (EA)?",
  seoTitle: "What Is a Forex Expert Advisor (EA)? How Forex Trading Bots Work",
  description:
    "What a MetaTrader Expert Advisor is, how forex trading bots make decisions, common strategy types, and the real limits and risks of automated trading.",
  category: "expert-advisors",
  published: "2026-10-13",
  updated: "2026-10-14",
  intro:
    "An Expert Advisor is a program that runs inside MetaTrader and can analyse prices and manage trades automatically. This guide explains how EAs work, what types exist, and what they can and can't do.",
  riskDisclaimer: true,
  blocks: [
    { type: "h2", text: "Expert Advisors in plain terms" },
    {
      type: "p",
      text: "An **Expert Advisor (EA)** — often called a forex robot or trading bot — is a program written in MQL4 (for MetaTrader 4) or MQL5 (for MetaTrader 5). It is attached to a chart and runs a set of rules every time a new price tick arrives: checking conditions, opening or closing trades, and adjusting stop-losses or take-profits.",
    },
    {
      type: "p",
      text: "An EA does exactly what its code says. It has no judgement of its own, so its results depend entirely on whether its rules suit the market conditions it meets.",
    },

    { type: "h2", text: "EAs, indicators and scripts" },
    {
      type: "table",
      caption: "MetaTrader program types",
      headers: ["Type", "What it does", "Can it trade?"],
      rows: [
        ["Expert Advisor", "Runs continuously on a chart and reacts to every tick", "Yes, when automated trading is allowed"],
        ["Indicator", "Calculates and draws values on a chart", "No"],
        ["Script", "Runs once to perform a single task, then stops", "Yes, for that one task"],
      ],
    },
    {
      type: "p",
      text: "Some EAs are **semi-automated**: they manage trades you open manually (for example, a trailing stop or a break-even tool) rather than finding entries themselves.",
    },

    { type: "h2", text: "Common EA strategy types" },
    {
      type: "ul",
      items: [
        "**Trend following** — trades in the direction of an established move, often using moving averages or breakouts.",
        "**Mean reversion** — expects price to return towards an average after stretching away from it.",
        "**Scalping** — many short trades targeting small moves; very sensitive to spreads, commissions and execution speed.",
        "**Grid** — places orders at fixed intervals above and below price.",
        "**Martingale** — increases trade size after losses to recover them. This can produce a smooth-looking equity curve until a long losing streak causes a very large loss.",
        "**News or time-based** — trades around scheduled events or specific sessions.",
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Grid and martingale risk",
      text: "Grid and martingale EAs can show a high win rate while carrying a risk of rare, severe drawdowns. If a product uses these techniques, its documentation should say so clearly.",
    },

    { type: "h2", text: "What an EA can do well" },
    {
      type: "ul",
      items: [
        "Apply the same rules consistently, without hesitation or fatigue.",
        "Monitor several symbols and timeframes at once.",
        "React immediately when conditions are met, including outside your working hours.",
        "Be tested on historical data before use — see [How to Run a Strategy Backtest in MT5](/tutorials/backtest-ea-mt5).",
      ],
    },

    { type: "h2", text: "What an EA can't do" },
    {
      type: "ul",
      items: [
        "Guarantee profits. Past performance, including backtests, does not guarantee future results.",
        "Adapt to market conditions its rules weren't designed for, unless it was explicitly built to.",
        "Remove the costs of trading. Spreads, commissions, slippage and swaps all affect results.",
        "Run when your terminal is closed or disconnected. An EA only works while MetaTrader is open and online.",
      ],
    },

    { type: "h2", text: "What you need to run an EA" },
    {
      type: "steps",
      items: [
        { title: "The right platform", text: "An MT4 EA (.ex4) only runs in MetaTrader 4, and an MT5 EA (.ex5) only runs in MetaTrader 5." },
        { title: "A broker account", text: "Check that your broker allows automated trading and offers the symbols the EA trades." },
        { title: "Automated trading enabled", text: "Both the terminal-wide switch and the EA's own permission must be on." },
        { title: "A computer or VPS that stays online", text: "For EAs that trade around the clock, many traders use a virtual private server close to their broker's servers." },
      ],
    },
    {
      type: "p",
      text: "Ready to set one up? Follow [How to Install an Expert Advisor in MT4](/tutorials/install-ea-mt4) or [in MT5](/tutorials/install-ea-mt5), and read [How to Evaluate a Forex Trading Bot Before Buying](/guides/how-to-evaluate-a-forex-trading-bot) first.",
    },
  ],
  related: ["how-to-evaluate-a-forex-trading-bot", "forex-risk-management-drawdown-leverage-stop-loss", "metatrader-ea-errors-troubleshooting"],
  tutorials: ["install-ea-mt5", "install-ea-mt4", "backtest-ea-mt5"],
  cta: { label: "Browse Expert Advisors", href: "/marketplace?type=EA", text: "Explore Expert Advisors for MT4 and MT5 — every listing shows its documentation, compatibility details and verified-purchase reviews." },
};

export const howToEvaluateATradingBot: Guide = {
  slug: "how-to-evaluate-a-forex-trading-bot",
  title: "How to Evaluate a Forex Trading Bot Before Buying",
  seoTitle: "How to Evaluate a Forex Trading Bot (EA) Before You Buy",
  description:
    "A checklist for judging a forex trading bot before you buy: documentation, strategy transparency, backtests, demo testing, reviews and red flags.",
  category: "expert-advisors",
  published: "2026-10-13",
  updated: "2026-10-14",
  intro:
    "Use this checklist to judge an Expert Advisor before you pay for it or trust it with real money — what to read, what to test, and which warning signs to take seriously.",
  riskDisclaimer: true,
  blocks: [
    {
      type: "callout",
      tone: "info",
      title: "Prefer a hands-on walkthrough?",
      text: "This guide explains what to look for and why. To go through a real listing section by section, follow the tutorial [How to Evaluate a Forex Bot Before Purchasing](/tutorials/evaluate-forex-bot-before-buying).",
    },
    { type: "h2", text: "1. Read the documentation" },
    {
      type: "p",
      text: "A well-supported product explains what it trades, how it trades and how to set it up. Look for:",
    },
    {
      type: "ul",
      items: [
        "The symbols and timeframes it was designed for.",
        "Whether it uses grid, martingale, averaging or hedging techniques.",
        "Whether every trade has a stop-loss, and how position size is calculated.",
        "Recommended minimum balance, account type and leverage assumptions.",
        "Installation instructions and an explanation of each input.",
      ],
    },
    {
      type: "p",
      text: "On FXBotHub, every listing shows a quality checklist — documentation, screenshots, compatibility details, recent updates, verified-seller status and verified-purchase reviews. It measures how complete a listing is, not how profitable a product will be.",
    },

    { type: "h2", text: "2. Check compatibility" },
    {
      type: "ul",
      items: [
        "Platform: MT4 (.ex4) or MT5 (.ex5).",
        "Broker conditions: spreads, commissions, minimum lot size and whether automated trading is allowed.",
        "Account type: some strategies need a hedging account; others work on netting accounts.",
      ],
    },

    { type: "h2", text: "3. Look critically at performance claims" },
    {
      type: "ul",
      items: [
        "**Backtests** show how rules would have behaved on past data. They can be over-optimised (curve-fitted) to look excellent on history and perform poorly afterwards.",
        "Ask what test period, data quality, spread and commission were used.",
        "Look at **maximum drawdown**, not just profit. A high return with a deep drawdown may be unacceptable for your account.",
        "Treat screenshots of profits as marketing, not evidence.",
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Red flags",
      text: "Be cautious with any product that promises guaranteed or fixed monthly returns, claims \"no risk\" or \"no losses\", hides its strategy type, or shows only a very short track record.",
    },

    { type: "h2", text: "4. Test it yourself" },
    {
      type: "steps",
      items: [
        { title: "Backtest with realistic settings", text: "Run it in the Strategy Tester with your broker's spread and commission — see [How to Run a Strategy Backtest in MT5](/tutorials/backtest-ea-mt5)." },
        { title: "Forward test on a demo account", text: "Run it live on demo for several weeks to see how it handles real spreads, news and execution — see [How to Test a Forex Bot on a Demo Account](/tutorials/test-forex-bot-demo-account)." },
        { title: "Start small", text: "If you move to a live account, begin with the smallest size you can and increase only after results match your expectations." },
      ],
    },

    { type: "h2", text: "5. Check reviews, updates and support" },
    {
      type: "ul",
      items: [
        "Read reviews from verified buyers rather than unattributed testimonials. On FXBotHub only buyers who purchased a product can review it.",
        "Check the version history and changelog: is the product maintained?",
        "Ask the seller a question before buying — on FXBotHub, use **Contact seller** on the product page — and note how clearly they answer.",
      ],
    },

    { type: "h2", text: "6. Understand licensing" },
    {
      type: "p",
      text: "Many paid EAs check a license key and limit how many terminals they can be activated on. Check how many activations you get and how to move a license to a new computer. See [How to Find and Access Trading Tools on FXBotHub](/tutorials/find-trading-tools-fxbothub).",
    },
  ],
  related: ["forex-risk-management-drawdown-leverage-stop-loss", "what-is-a-forex-expert-advisor"],
  tutorials: ["evaluate-forex-bot-before-buying", "backtest-ea-mt5", "test-forex-bot-demo-account"],
  cta: { label: "Browse Expert Advisors", href: "/marketplace?type=EA", text: "Compare Expert Advisors on FXBotHub using their documentation, compatibility notes and verified reviews." },
};
