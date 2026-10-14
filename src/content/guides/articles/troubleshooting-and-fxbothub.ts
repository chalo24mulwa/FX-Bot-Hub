import type { Guide } from "../types";

export const eaTroubleshooting: Guide = {
  slug: "metatrader-ea-errors-troubleshooting",
  title: "Common MetaTrader EA Errors and How to Troubleshoot Them",
  seoTitle: "Common MT4/MT5 Expert Advisor Errors and How to Fix Them",
  description:
    "Fix common MetaTrader EA problems: EA missing from the Navigator, trading disabled, invalid stops or volume, not enough money, DLL and WebRequest errors.",
  category: "troubleshooting",
  published: "2026-10-13",
  updated: "2026-10-14",
  intro:
    "Most Expert Advisor problems come down to a handful of causes: the file is in the wrong place, trading isn't allowed, or the broker rejects the order. This guide shows where to look and how to fix the common ones.",
  riskDisclaimer: false,
  blocks: [
    { type: "h2", text: "First, read the logs" },
    {
      type: "p",
      text: "Open the **Terminal** window in MT4 or the **Toolbox** in MT5 (Ctrl+T). The **Experts** tab shows messages from your EAs, and the **Journal** tab shows platform messages such as connection problems and rejected orders. The exact error text there usually points straight at the cause.",
    },

    { type: "h2", text: "The EA doesn't appear in the Navigator" },
    {
      type: "ul",
      items: [
        "**Wrong folder** — EAs belong in `MQL4\\Experts` (MT4) or `MQL5\\Experts` (MT5) inside the data folder (**File → Open Data Folder**), not in the program's installation folder.",
        "**Wrong platform** — an `.ex4` file won't load in MT5 and an `.ex5` won't load in MT4.",
        "**Not refreshed** — right-click **Expert Advisors** in the Navigator and choose **Refresh**, or restart the platform.",
        "**Still zipped** — extract `.zip` archives before copying the files.",
      ],
    },

    { type: "h2", text: "The EA is attached but won't trade" },
    {
      type: "p",
      text: "Two switches must both be on: the platform-wide **AutoTrading** button (MT4) or **Algo Trading** button (MT5), and the EA's own permission — **Allow live trading** in MT4 or **Allow Algo Trading** in MT5, on the **Common** tab of its properties (press F7 on the chart). When either is off, MT4 reports error **4109** (trade not allowed) and MT5 reports **4752** (trading disabled for Expert Advisors).",
    },
    {
      type: "ul",
      items: [
        "Check whether the market for that symbol is open — trades are rejected outside trading hours.",
        "Some symbols are close-only or disabled on certain account types; check **Specification** in Market Watch.",
        "Some brokers restrict automated trading on particular accounts. Ask your broker if every switch is on and trades still fail.",
      ],
    },

    { type: "h2", text: "Orders rejected by the broker" },
    {
      type: "table",
      caption: "Common order errors",
      headers: ["Error", "Platform code", "What usually causes it"],
      rows: [
        ["Invalid stops", "MT4 130 · MT5 10016", "Stop-loss or take-profit too close to the price (inside the broker's minimum stop level) or on the wrong side"],
        ["Invalid volume", "MT4 131 · MT5 10014", "Lot size below the minimum, above the maximum, or not a multiple of the volume step"],
        ["Not enough money", "MT4 134 · MT5 10019", "Insufficient free margin for the position size"],
        ["Market closed", "MT4 132 · MT5 10018", "Trading attempted outside the symbol's session"],
      ],
    },
    {
      type: "p",
      text: "Fixes usually involve the EA's inputs: reduce the lot size, widen the stop distance, or use a symbol your account can trade. If the EA can't handle your broker's conditions (for example a different number of decimal places), contact its developer.",
    },

    { type: "h2", text: "DLL imports not allowed" },
    {
      type: "p",
      text: "Some EAs call external libraries (DLLs). If the log says DLL calls aren't allowed, enable **Allow DLL imports** in the EA's properties — only for software from a source you trust, because DLLs run outside MetaTrader's protections.",
    },

    { type: "h2", text: "License checks or web requests failing" },
    {
      type: "p",
      text: "EAs that verify a license online use MetaTrader's `WebRequest` function, which only works for addresses you allow. Go to **Tools → Options → Expert Advisors**, tick **Allow WebRequest for listed URL**, and add the address the developer gives you. Per MetaQuotes' documentation, WebRequest can't be used from indicators or inside the Strategy Tester.",
    },

    { type: "h2", text: "Other common problems" },
    {
      type: "ul",
      items: [
        "**The EA stopped overnight** — MetaTrader must stay open and connected. If your computer sleeps or restarts, the EA stops; a VPS avoids this.",
        "**Settings lost after restart** — save your inputs as a `.set` file and keep your chart layout in a profile or template.",
        "**\"Not enough bars\" or no signals in the tester** — download more history or choose a longer test period.",
        "**Different results live and in the tester** — usually spreads, slippage and execution; see [How to Run a Strategy Backtest in MT5](/tutorials/backtest-ea-mt5).",
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Still stuck?",
      text: "Send the product's developer the exact messages from the Experts and Journal tabs, your platform (MT4/MT5) and build number, and your broker. On FXBotHub, use **Contact seller** on the product page.",
    },
  ],
  related: ["what-is-a-forex-expert-advisor"],
  tutorials: ["troubleshoot-ea-not-trading", "read-mt4-experts-journal-logs", "install-ea-mt5"],
};

export const sellersGuide: Guide = {
  slug: "selling-trading-tools-on-fxbothub",
  title: "A Seller's Guide to Publishing Trading Tools on FXBotHub",
  seoTitle: "How to Sell Forex Trading Tools and EAs on FXBotHub",
  description:
    "How to publish an EA, indicator or trading tool on FXBotHub: becoming a seller, the product wizard, files, review, updates and getting paid.",
  category: "fxbothub",
  published: "2026-10-13",
  updated: "2026-10-14",
  intro:
    "Learn how to go from an account to a published listing on FXBotHub: becoming a seller, building a listing in the product wizard, passing review, and keeping your product up to date.",
  riskDisclaimer: false,
  blocks: [
    { type: "h2", text: "Become a seller" },
    {
      type: "p",
      text: "Selling is self-service. Sign in, open [Become a seller](/dashboard/become-seller), choose a seller or business display name, and your seller dashboard opens straight away. Products are still reviewed individually before they go live.",
    },

    { type: "h2", text: "Build your listing in the product wizard" },
    {
      type: "p",
      text: "The wizard saves a draft you can return to at any time. It walks through these steps:",
    },
    {
      type: "ol",
      items: [
        "**Product type** — Expert Advisor, indicator, signal tool, trading tool or other.",
        "**Platform** — MT4, MT5 or multi-platform.",
        "**Basic information** — name, short summary and an optional cover photo.",
        "**Description** and **features**.",
        "**Screenshots** and **documentation**.",
        "**Files** — uploaded against a version number.",
        "**Pricing** — free, a one-time price, or a subscription.",
        "**Compatibility**, then **testing & support** information.",
        "**Submit for review.**",
      ],
    },
    {
      type: "p",
      text: "Accepted file types and size limits, plus field limits for names and summaries, are listed in the [developer resources submission guidelines](/developer-resources#submission-guidelines).",
    },

    { type: "h2", text: "Write a listing buyers can trust" },
    {
      type: "ul",
      items: [
        "State the symbols, timeframes and account conditions the product was built for.",
        "Disclose techniques such as grid, martingale or averaging, and how stop-losses work.",
        "Explain every input and include installation steps.",
        "Use real screenshots and describe how you tested the product.",
        "Don't promise profits — buyers increasingly recognise this as a red flag, and backtests never guarantee future results.",
      ],
    },
    {
      type: "p",
      text: "Complete listings score better on the quality checklist buyers see, which also feeds marketplace ranking.",
    },

    { type: "h2", text: "Review and publishing" },
    {
      type: "p",
      text: "After you submit, a moderator reviews the product and either publishes it or rejects it with a reason you can address and resubmit. There's no fixed review timeline; you'll get a notification with the outcome.",
    },

    { type: "h2", text: "After launch" },
    {
      type: "ul",
      items: [
        "**Updates** — upload a new version with a changelog. Buyers who saved your product are notified of new versions.",
        "**Licensing** — each sale issues the buyer a license key your EA can check with the [license API](/developer-resources#api).",
        "**Orders, analytics and reviews** — all in your seller dashboard; you can reply publicly to reviews.",
        "**Earnings** — each sale and the marketplace commission are recorded in your seller ledger. Request payouts from your Payout page; they are processed manually once funds are sent.",
      ],
    },
  ],
  related: ["how-to-evaluate-a-forex-trading-bot", "what-is-a-forex-expert-advisor"],
  tutorials: ["find-trading-tools-fxbothub", "backtest-ea-mt5"],
  cta: { label: "Become a seller", href: "/dashboard/become-seller", text: "List your Expert Advisors and indicators on FXBotHub — setup takes minutes." },
};
