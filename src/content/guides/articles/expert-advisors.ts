import type { Guide } from "../types";

export const whatIsAnExpertAdvisor: Guide = {
  slug: "what-is-a-forex-expert-advisor",
  title: "What Is a Forex Expert Advisor (EA)?",
  seoTitle: "What Is a Forex Expert Advisor (EA)? How Forex Trading Bots Work",
  description:
    "What a MetaTrader Expert Advisor is, how forex trading bots make decisions, common strategy types, and the real limits and risks of automated trading.",
  category: "expert-advisors",
  published: "2026-10-13",
  updated: "2026-10-13",
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
        "Be tested on historical data before use — see [How to Backtest an Expert Advisor](/guides/how-to-backtest-an-expert-advisor).",
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
      text: "Ready to set one up? Follow [How to Install an Expert Advisor in MT4](/guides/how-to-install-an-ea-in-mt4) or [in MT5](/guides/how-to-install-an-ea-in-mt5), and read [How to Evaluate a Forex Trading Bot Before Buying](/guides/how-to-evaluate-a-forex-trading-bot) first.",
    },
  ],
  related: ["how-to-evaluate-a-forex-trading-bot", "how-to-backtest-an-expert-advisor", "how-to-install-an-ea-in-mt5"],
  cta: { label: "Browse Expert Advisors", href: "/marketplace?type=EA", text: "Explore Expert Advisors for MT4 and MT5 — every listing shows its documentation, compatibility details and verified-purchase reviews." },
};

export const howToInstallEaMt4: Guide = {
  slug: "how-to-install-an-ea-in-mt4",
  title: "How to Install an Expert Advisor in MT4",
  seoTitle: "How to Install an Expert Advisor (EA) in MetaTrader 4",
  description:
    "Install an Expert Advisor in MetaTrader 4: copy the .ex4 file to MQL4/Experts, attach it to a chart, set its inputs, allow live trading and enable AutoTrading.",
  category: "mt4",
  published: "2026-10-13",
  updated: "2026-10-13",
  intro:
    "Follow these steps to add an Expert Advisor to MetaTrader 4, attach it to a chart, load its settings and confirm it is allowed to trade.",
  riskDisclaimer: true,
  blocks: [
    { type: "h2", text: "What you need" },
    {
      type: "ul",
      items: [
        "MetaTrader 4 installed and logged in — see [How to Install MetaTrader 4](/guides/how-to-install-metatrader-4).",
        "The EA file for MT4: a compiled `.ex4` file (and sometimes `.mq4` source). If it came as a `.zip`, extract it first.",
        "Any extra files the developer supplies, such as `.set` presets or files for the `Libraries` folder.",
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Test on a demo account first",
      text: "Always run a new EA on a demo account until you understand how it behaves.",
    },

    { type: "h2", text: "Install the EA" },
    {
      type: "steps",
      items: [
        { title: "Open the data folder", text: "In MT4, go to **File → Open Data Folder**, then open `MQL4` → `Experts`." },
        { title: "Copy the EA file", text: "Paste the `.ex4` file (and `.mq4`, if provided) into the `Experts` folder. Put any library files the developer mentions into `MQL4\\Libraries`, and `.set` files into `MQL4\\Presets`." },
        { title: "Refresh the Navigator", text: "Back in MT4, open the **Navigator** window (Ctrl+N), right-click **Expert Advisors** and choose **Refresh** — or simply restart MT4." },
        { title: "Attach it to a chart", text: "Open a chart for the symbol and timeframe the EA's documentation specifies, then drag the EA from the Navigator onto the chart (or double-click it)." },
        { title: "Allow live trading", text: "In the EA's properties window, open the **Common** tab and tick **Allow live trading**. Only tick **Allow DLL imports** if the developer says the EA needs it and you trust the source." },
        { title: "Set the inputs", text: "On the **Inputs** tab, adjust the settings or click **Load** to import a `.set` file. Pay particular attention to lot size and risk settings." },
        { title: "Enable AutoTrading", text: "Click **OK**, then make sure the **AutoTrading** button on the main toolbar is switched on. The EA's name appears in the top-right corner of the chart, with an icon showing whether it is allowed to trade." },
      ],
    },

    { type: "h2", text: "Check that it's running" },
    {
      type: "ul",
      items: [
        "Open the **Terminal** window (Ctrl+T) and look at the **Experts** tab for messages from the EA, and the **Journal** tab for platform messages.",
        "If the EA shows it isn't allowed to trade, recheck both the AutoTrading button and **Allow live trading** in the EA's properties (press F7 on the chart to reopen them).",
        "Remember the EA stops when MT4 closes or loses its connection.",
      ],
    },
    {
      type: "p",
      text: "Problems? See [Common MetaTrader EA Errors and How to Troubleshoot Them](/guides/metatrader-ea-errors-troubleshooting).",
    },
  ],
  related: ["metatrader-ea-errors-troubleshooting", "how-to-backtest-an-expert-advisor", "how-to-install-an-ea-in-mt5"],
  cta: { label: "Browse MT4 Expert Advisors", href: "/marketplace?platform=MT4&type=EA", text: "Find Expert Advisors for MetaTrader 4 on FXBotHub." },
};

export const howToInstallEaMt5: Guide = {
  slug: "how-to-install-an-ea-in-mt5",
  title: "How to Install an Expert Advisor in MT5",
  seoTitle: "How to Install an Expert Advisor (EA) in MetaTrader 5",
  description:
    "Install an Expert Advisor in MetaTrader 5: copy the .ex5 file to MQL5/Experts, attach it to a chart, configure inputs and dependencies, and enable Algo Trading.",
  category: "mt5",
  published: "2026-10-13",
  updated: "2026-10-13",
  intro:
    "This guide shows how to add an Expert Advisor to MetaTrader 5, attach it to a chart, load its settings and switch on automated trading.",
  riskDisclaimer: true,
  blocks: [
    { type: "h2", text: "What you need" },
    {
      type: "ul",
      items: [
        "MetaTrader 5 installed and logged in — see [How to Install MetaTrader 5](/guides/how-to-install-metatrader-5).",
        "The EA built for MT5: a compiled `.ex5` file (MT4 `.ex4` files will not run in MT5).",
        "Any `.set` presets or extra files the developer provides.",
      ],
    },

    { type: "h2", text: "Install the EA" },
    {
      type: "steps",
      items: [
        { title: "Open the data folder", text: "Go to **File → Open Data Folder**, then open `MQL5` → `Experts`." },
        { title: "Copy the files", text: "Paste the `.ex5` file into `Experts`. You can create a subfolder to keep a product's files together. Put `.set` files into `MQL5\\Presets`." },
        { title: "Refresh the Navigator", text: "Open the **Navigator** (Ctrl+N), right-click **Expert Advisors** and choose **Refresh**." },
        { title: "Attach the EA to a chart", text: "Open a chart with the symbol and timeframe from the EA's documentation and drag the EA onto it, or double-click it." },
        { title: "Allow it to trade", text: "In the properties window, on the **Common** tab, tick **Allow Algo Trading** (labelled **Allow Auto Trading** in older builds). If the EA needs DLLs, its **Dependencies** tab has **Allow DLL imports** — only enable it for software you trust." },
        { title: "Configure the inputs", text: "Use the **Inputs** tab to review settings, or **Load** a `.set` file." },
        { title: "Turn on Algo Trading", text: "Click **OK** and make sure the **Algo Trading** button on the toolbar (called **AutoTrading** in older builds) is enabled. The EA's name and a status icon appear in the chart's top-right corner." },
      ],
    },

    { type: "h2", text: "Confirm it's working" },
    {
      type: "ul",
      items: [
        "In the **Toolbox** window (Ctrl+T), check the **Experts** tab for the EA's messages and the **Journal** tab for platform messages.",
        "If trades are refused because automated trading is disabled, check the Algo Trading button and the EA's own permission (press F7 on the chart).",
        "Some brokers or account types restrict automated trading — ask your broker if everything looks enabled but trades still fail.",
      ],
    },
    {
      type: "p",
      text: "Next, test it properly: [How to Backtest an Expert Advisor Before Using It](/guides/how-to-backtest-an-expert-advisor).",
    },
  ],
  related: ["how-to-backtest-an-expert-advisor", "metatrader-ea-errors-troubleshooting", "how-to-install-an-ea-in-mt4"],
  cta: { label: "Browse MT5 Expert Advisors", href: "/marketplace?platform=MT5&type=EA", text: "Find trading robots built for MetaTrader 5." },
};

export const howToEvaluateATradingBot: Guide = {
  slug: "how-to-evaluate-a-forex-trading-bot",
  title: "How to Evaluate a Forex Trading Bot Before Buying",
  seoTitle: "How to Evaluate a Forex Trading Bot (EA) Before You Buy",
  description:
    "A checklist for judging a forex trading bot before you buy: documentation, strategy transparency, backtests, demo testing, reviews and red flags.",
  category: "expert-advisors",
  published: "2026-10-13",
  updated: "2026-10-13",
  intro:
    "Use this checklist to judge an Expert Advisor before you pay for it or trust it with real money — what to read, what to test, and which warning signs to take seriously.",
  riskDisclaimer: true,
  blocks: [
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
        { title: "Backtest with realistic settings", text: "Run it in the Strategy Tester with your broker's spread and commission — see [How to Backtest an Expert Advisor](/guides/how-to-backtest-an-expert-advisor)." },
        { title: "Forward test on a demo account", text: "Run it live on demo for several weeks to see how it handles real spreads, news and execution." },
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
      text: "Many paid EAs check a license key and limit how many terminals they can be activated on. Check how many activations you get and how to move a license to a new computer. See [How to Buy and Download Trading Tools on FXBotHub](/guides/how-to-buy-and-download-on-fxbothub).",
    },
  ],
  related: ["how-to-backtest-an-expert-advisor", "forex-risk-management-drawdown-leverage-stop-loss", "what-is-a-forex-expert-advisor"],
  cta: { label: "Browse Expert Advisors", href: "/marketplace?type=EA", text: "Compare Expert Advisors on FXBotHub using their documentation, compatibility notes and verified reviews." },
};
