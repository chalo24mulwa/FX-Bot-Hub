import type { Tutorial } from "../types";

export const evaluateBotBeforeBuying: Tutorial = {
  slug: "evaluate-forex-bot-before-buying",
  title: "How to Evaluate a Forex Bot Before Purchasing",
  seoTitle: "How to Evaluate a Forex Bot Listing Before You Buy — Walkthrough",
  description:
    "Walk through a forex bot listing before you buy: quality signals, documentation, compatibility, changelog, verified reviews and questions for the seller.",
  category: "fxbothub",
  difficulty: "beginner",
  estimatedMinutes: 20,
  published: "2026-10-14",
  updated: "2026-10-14",
  intro:
    "Go through an Expert Advisor's listing on FXBotHub section by section, write down what it tells you — and what it doesn't — and decide whether it's worth testing.",
  requirements: [
    "An Expert Advisor listing you're considering on the [marketplace](/marketplace?type=EA).",
    "Your platform (MT4 or MT5), broker and planned account size.",
    "A note or spreadsheet to record what you find.",
  ],
  outcomes: [
    "Use each part of a listing as evidence, not marketing.",
    "Spot missing information before you pay.",
    "Know what to test yourself before trusting a bot with real money.",
  ],
  steps: [
    {
      title: "Check the platform badge and pricing",
      text: [
        "Next to the product name you'll see its type and platform (MT4, MT5 or Multi-platform), and the button shows how it's priced: **Get for free**, **Buy** or **Subscribe**. Stop here if the platform doesn't match yours.",
      ],
    },
    {
      title: "Read the quality signals",
      text: [
        "Below the header, **Quality signals** show which of six items the listing has: documentation, screenshots, compatibility info, a recent update, a verified developer and verified-purchase reviews. They measure how complete the listing is — not whether the bot is profitable or safe.",
      ],
    },
    {
      title: "Read Overview and Features for the strategy",
      text: ["Write down what the bot trades and how. Look for:"],
      items: [
        "Symbols and timeframes it's designed for.",
        "Whether it uses grid, martingale, averaging or hedging.",
        "Whether every trade has a stop-loss, and how lot size is set.",
      ],
      note: { tone: "warning", text: "Be cautious with any listing that promises fixed or guaranteed returns, claims \"no risk\", or won't say what kind of strategy it uses." },
    },
    {
      title: "Open the Documentation tab",
      text: [
        "Check **Compatibility** (account type, minimum balance, broker conditions) and **Installation**. Missing installation instructions or input explanations will make the bot harder to run correctly.",
      ],
    },
    {
      title: "Look at the Changelog",
      text: ["The **Changelog** lists each version with its date. Regular, described updates suggest the product is maintained; a single old version may not support current platform builds."],
    },
    {
      title: "Read the Reviews",
      text: [
        "Only buyers who own a product can review it on FXBotHub. Read the low ratings as well as the high ones, and note how the seller responds.",
      ],
    },
    {
      title: "Ask the seller what's missing",
      text: [
        "Use **Contact seller** for anything the listing doesn't answer — for example the maximum drawdown in their testing, which brokers they've tested with, or how license activations work. Note how clearly they reply.",
      ],
    },
    {
      title: "Plan your own tests",
      text: [
        "If it still looks promising, plan a [backtest](/tutorials/backtest-ea-mt5) with realistic costs and a [demo forward test](/tutorials/test-forex-bot-demo-account) before any live use. Save the listing with the heart icon to be notified of price changes and new versions while you decide.",
      ],
    },
  ],
  expectedResult:
    "A short written summary of the bot — strategy, risk features, compatibility, maintenance, reviews and the seller's answers — and a decision: skip it, or test it on demo first.",
  troubleshooting: [
    { problem: "The listing has no documentation", fix: "Ask the seller for it before buying. Without it you can't configure the bot safely." },
    { problem: "There are no reviews yet", fix: "New products often have none. Rely more on documentation, the seller's answers and your own demo testing." },
  ],
  related: ["test-forex-bot-demo-account", "backtest-ea-mt5", "find-trading-tools-fxbothub"],
  guides: ["how-to-evaluate-a-forex-trading-bot", "forex-risk-management-drawdown-leverage-stop-loss"],
  next: "compare-mt4-mt5-tools",
  links: [
    { label: "Browse Expert Advisors", href: "/marketplace?type=EA" },
    { label: "Free Expert Advisors", href: "/marketplace?type=EA&pricingType=FREE" },
  ],
  riskDisclaimer: true,
};

export const findTradingToolsOnFxBotHub: Tutorial = {
  slug: "find-trading-tools-fxbothub",
  title: "How to Find and Access Trading Tools on FXBotHub",
  seoTitle: "How to Find, Get and Download Trading Tools on FXBotHub",
  description:
    "Find Expert Advisors and indicators on FXBotHub, check out (free or paid), download your files and find your license keys, orders and subscriptions.",
  category: "fxbothub",
  difficulty: "beginner",
  estimatedMinutes: 10,
  published: "2026-10-13",
  updated: "2026-10-14",
  intro:
    "Search and filter the FXBotHub marketplace, get a product through checkout, then download its files and find your license key, orders and subscriptions.",
  requirements: ["A free FXBotHub account — [sign up](/auth/sign-up) with your email if you don't have one.", "Your platform: MT4 or MT5."],
  outcomes: [
    "Narrow the marketplace down to tools for your platform.",
    "Get a free or paid product through checkout.",
    "Find your downloads, license keys, orders and subscriptions afterwards.",
  ],
  steps: [
    {
      title: "Search or browse the marketplace",
      text: [
        "Use the product search in the site header, or open the [marketplace](/marketplace) — the Marketplace menu also links straight to MT4 and MT5 Expert Advisors and indicators.",
      ],
    },
    {
      title: "Filter and sort",
      text: [
        "Use the filters at the top of the list: type (Expert Advisor, Indicator, Tool…), platform (MT4, MT5, Multi-platform), price (Free, One-time purchase, Subscription) and sort order (Newest, Recently updated, Top rated, Best sellers, price).",
      ],
    },
    {
      title: "Open a product and review it",
      text: [
        "Check the platform badge, quality signals, documentation, changelog and reviews — [How to Evaluate a Forex Bot Before Purchasing](/tutorials/evaluate-forex-bot-before-buying) walks through each one.",
      ],
    },
    {
      title: "Add it to your cart",
      text: [
        "Click **Get for free**, **Buy** or **Subscribe**. You'll be asked to sign in first if you aren't already, then you're taken to your cart.",
      ],
    },
    {
      title: "Check out",
      text: [
        "In the cart, click **Checkout**. Free products go through checkout too, so every product you own has an order and a license. When the order is complete you're taken to its order page.",
      ],
    },
    {
      title: "Download your files",
      text: [
        "The order page and the product page (under **Your downloads**) list each file, such as separate MT4 and MT5 builds. Each download checks that you own the product and uses a short-lived link, so come back to the site whenever you need a fresh download.",
      ],
    },
    {
      title: "Find your license key",
      text: [
        "Your keys are under **Dashboard → Licenses**. Products that verify their license use this key and allow a limited number of activations — keep it private.",
      ],
    },
    {
      title: "Manage orders and subscriptions",
      text: [
        "**Dashboard → Orders** lists everything you've bought, and refund requests (which apply to a whole order) are made from an order's page. Subscription products are under **Dashboard → Product Subscriptions**; if you cancel, access continues until the end of the period you've paid for.",
      ],
    },
  ],
  expectedResult:
    "The product appears under Dashboard → Orders, its files are downloadable from the order and product pages, and its license key is listed under Dashboard → Licenses.",
  troubleshooting: [
    { problem: "The download button isn't showing", fix: "Downloads only appear once you own the product. Check the order under **Dashboard → Orders** is complete, and that you're signed in to the account you used." },
    { problem: "A download link stopped working", fix: "Links are deliberately short-lived. Go back to the product or order page and click the download again." },
    { problem: "I don't know which file to install", fix: "Pick the file for your platform (MT4 `.ex4`, MT5 `.ex5`), then follow the matching install tutorial." },
  ],
  related: ["evaluate-forex-bot-before-buying", "install-ea-mt5", "install-indicator-mt5"],
  guides: ["how-to-evaluate-a-forex-trading-bot", "selling-trading-tools-on-fxbothub"],
  links: [
    { label: "Browse the marketplace", href: "/marketplace" },
    { label: "MT5 Expert Advisors", href: "/marketplace?platform=MT5&type=EA" },
    { label: "MT4 Expert Advisors", href: "/marketplace?platform=MT4&type=EA" },
  ],
  riskDisclaimer: false,
};
