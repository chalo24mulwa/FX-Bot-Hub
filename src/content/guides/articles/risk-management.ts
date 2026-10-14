import type { Guide } from "../types";

export const riskManagement: Guide = {
  slug: "forex-risk-management-drawdown-leverage-stop-loss",
  title: "Understanding Drawdown, Leverage, Stop-Losses and Risk Management",
  seoTitle: "Forex Risk Management: Drawdown, Leverage, Stop-Losses and Position Sizing",
  description:
    "Forex risk management explained: sizing positions from your stop-loss, what leverage and margin mean, how drawdown works, and controls for EAs.",
  category: "risk-management",
  published: "2026-10-13",
  updated: "2026-10-14",
  intro:
    "Risk management decides how much you can lose and how long you can keep trading. This guide covers position sizing, stop-losses, leverage, margin and drawdown, with worked examples.",
  riskDisclaimer: true,
  blocks: [
    { type: "h2", text: "Start with risk per trade" },
    {
      type: "p",
      text: "Many traders decide in advance what fraction of their account they are willing to lose on a single trade — often a small percentage such as 1%. The point is not the exact number but consistency: no single trade should be able to damage the account badly.",
    },

    { type: "h2", text: "Stop-losses" },
    {
      type: "p",
      text: "A **stop-loss** closes a trade automatically at a set price. Place it where your trade idea is proven wrong, not at an arbitrary distance. Remember that in fast markets or over weekends price can move past your stop, so the fill may be worse than the level you set (slippage).",
    },

    { type: "h2", text: "Position sizing from your stop-loss" },
    {
      type: "p",
      text: "Work out size from three numbers: the amount you're willing to risk, the stop-loss distance in pips, and the pip value per lot.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Worked example (illustrative)",
      text: "Account $5,000, risk 1% = $50. Stop-loss 25 pips on EUR/USD, where one standard lot is worth about $10 per pip. Position size = $50 ÷ (25 pips × $10) = 0.20 lots. If the stop is hit, the loss is about $50 before costs.",
    },
    {
      type: "p",
      text: "A wider stop means a smaller position for the same risk. Pip values differ between pairs, so recalculate for each symbol.",
    },

    { type: "h2", text: "Leverage and margin" },
    {
      type: "p",
      text: "**Leverage** sets how much margin your broker requires. At 1:30, a position worth $30,000 needs $1,000 of margin. Leverage doesn't change how much a pip is worth — **position size** does. What high leverage changes is how large a position you're *able* to open, which is why it is easy to over-trade.",
    },
    {
      type: "ul",
      items: [
        "**Equity** is your balance plus or minus open profit or loss.",
        "**Free margin** is equity not tied up as margin; when it runs low, you can't open new trades.",
        "If equity falls too far relative to used margin, your broker may close positions automatically (a **stop-out**). Levels vary by broker.",
      ],
    },

    { type: "h2", text: "Drawdown" },
    {
      type: "p",
      text: "**Drawdown** is the fall from an account's peak to a subsequent low, usually shown as a percentage. **Maximum drawdown** is the largest such fall over a period.",
    },
    {
      type: "table",
      caption: "Gain needed to recover from a drawdown",
      headers: ["Drawdown", "Gain needed to get back to the peak"],
      rows: [
        ["10%", "11.1%"],
        ["20%", "25%"],
        ["30%", "42.9%"],
        ["50%", "100%"],
      ],
    },
    {
      type: "p",
      text: "Losses compound against you: the deeper the drawdown, the harder the recovery. That's why maximum drawdown matters as much as profit when you [evaluate a trading bot](/guides/how-to-evaluate-a-forex-trading-bot).",
    },

    { type: "h2", text: "Risk controls for Expert Advisors" },
    {
      type: "ul",
      items: [
        "Check how the EA sets lot sizes — fixed lots or a percentage of balance — and whether every trade has a stop-loss.",
        "Be very careful with EAs that add to losing positions (grid, martingale or averaging). Their risk is concentrated in rare but severe losing streaks.",
        "Don't run several EAs on one account without considering their combined exposure.",
        "Decide in advance the drawdown at which you'll stop the EA and reassess.",
        "Monitor regularly — automated doesn't mean unattended.",
      ],
    },
  ],
  related: ["how-to-evaluate-a-forex-trading-bot", "forex-trading-for-beginners"],
  tutorials: ["backtest-ea-mt5", "test-forex-bot-demo-account", "configure-ea-settings"],
  cta: { label: "Browse trading tools", href: "/marketplace", text: "Look for tools that document their risk settings clearly on the FXBotHub marketplace." },
};
