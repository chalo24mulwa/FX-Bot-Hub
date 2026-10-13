import type { Guide } from "../types";

export const howToInstallIndicator: Guide = {
  slug: "how-to-install-a-forex-indicator",
  title: "How to Install and Use a Forex Indicator",
  seoTitle: "How to Install and Use a Custom Forex Indicator in MT4 and MT5",
  description:
    "Install a custom indicator in MetaTrader 4 or 5, add it to a chart, adjust its settings and templates, and understand what indicators can and can't tell you.",
  category: "indicators",
  published: "2026-10-13",
  updated: "2026-10-13",
  intro:
    "Learn how to add a custom indicator to MetaTrader 4 or MetaTrader 5, configure it, save it in a template, and use it with a clear understanding of its limits.",
  riskDisclaimer: true,
  blocks: [
    { type: "h2", text: "What a forex indicator does" },
    {
      type: "p",
      text: "An indicator is a calculation based on price (and sometimes volume) that is drawn on your chart or in a separate window beneath it. Moving averages, the Relative Strength Index (RSI) and Bollinger Bands are common examples. Indicators **describe** market behaviour; they don't place trades and they don't predict the future.",
    },

    { type: "h2", text: "Install a custom indicator" },
    {
      type: "steps",
      items: [
        { title: "Check the platform", text: "Make sure you have the right file: `.ex4` for MT4 or `.ex5` for MT5. Extract `.zip` files first." },
        { title: "Open the data folder", text: "In MetaTrader, choose **File → Open Data Folder**, then open `MQL4\\Indicators` (MT4) or `MQL5\\Indicators` (MT5)." },
        { title: "Copy the file", text: "Paste the indicator file into the `Indicators` folder." },
        { title: "Refresh the Navigator", text: "Open the **Navigator** (Ctrl+N), right-click **Indicators** and choose **Refresh**, or restart the platform." },
        { title: "Add it to a chart", text: "Drag the indicator from the Navigator onto a chart, or double-click it." },
        { title: "Adjust the settings", text: "Use the **Inputs** tab for the indicator's parameters and the **Colors** tab for its appearance, then click **OK**." },
      ],
    },
    {
      type: "p",
      text: "To change settings later, right-click the chart and open **Indicators List** (Ctrl+I), select the indicator and choose **Edit**.",
    },

    { type: "h2", text: "Save your chart setup as a template" },
    {
      type: "p",
      text: "Once a chart looks the way you want, right-click it and choose **Template → Save Template**. You can then apply the same indicators and settings to any other chart in one click.",
    },

    { type: "h2", text: "Using indicators sensibly" },
    {
      type: "ul",
      items: [
        "**They lag.** Most indicators are calculated from past prices, so signals arrive after the move has started.",
        "**Repainting.** Some indicators recalculate past values as new bars arrive, so historical signals look better than they did in real time. Watch an indicator live before trusting its history.",
        "**More isn't better.** Several indicators built from the same price data often say the same thing.",
        "**Context matters.** An indicator that works in trending markets may give poor signals in ranges, and vice versa.",
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Indicators can't trade",
      text: "If you want trades placed automatically, you need an Expert Advisor — see [What Is a Forex Expert Advisor?](/guides/what-is-a-forex-expert-advisor)",
    },
  ],
  related: ["what-is-a-forex-expert-advisor", "how-to-install-metatrader-5", "metatrader-ea-errors-troubleshooting"],
  cta: { label: "Browse forex indicators", href: "/marketplace?type=INDICATOR", text: "Explore indicators for MT4 and MT5 on the FXBotHub marketplace." },
};

export const howToBacktestAnEa: Guide = {
  slug: "how-to-backtest-an-expert-advisor",
  title: "How to Backtest an Expert Advisor Before Using It",
  seoTitle: "How to Backtest an Expert Advisor in the MT4 and MT5 Strategy Tester",
  description:
    "Backtest an EA in the MetaTrader Strategy Tester: choose a testing model, use realistic spreads and costs, read the report and avoid over-optimisation.",
  category: "backtesting",
  published: "2026-10-13",
  updated: "2026-10-13",
  intro:
    "Backtesting runs an Expert Advisor over historical data to see how its rules would have behaved. This guide shows how to run a meaningful test in MT4 or MT5 and how to read the results without fooling yourself.",
  riskDisclaimer: true,
  blocks: [
    { type: "h2", text: "What a backtest can and can't tell you" },
    {
      type: "p",
      text: "A backtest shows how an EA's rules would have performed on past prices under the conditions you set. It is useful for finding broken logic, understanding a strategy's behaviour and comparing settings. It is **not** a forecast: markets change, and live trading adds slippage, variable spreads and execution delays that a test can only approximate.",
    },

    { type: "h2", text: "Run a backtest" },
    {
      type: "steps",
      items: [
        { title: "Open the Strategy Tester", text: "In MT4 or MT5, open **View → Strategy Tester** (Ctrl+R)." },
        { title: "Choose the EA, symbol and timeframe", text: "Use the symbol and timeframe from the EA's documentation." },
        { title: "Pick the testing model", text: "For EAs that react within a bar, choose the most detailed model available: **Every tick** in MT4, or **Every tick based on real ticks** in MT5 when your broker provides tick history. Faster models such as open prices only suit EAs that trade on bar opens." },
        { title: "Set a meaningful date range", text: "Include different market conditions — trending, ranging and volatile periods — rather than a few recent months." },
        { title: "Use realistic costs", text: "Set the spread (or use the current spread) and include commission, so the test resembles your real account. In MT5 you can also add artificial execution delay." },
        { title: "Load the right inputs", text: "Load the developer's recommended `.set` file or your own settings, and set the deposit and leverage to match the account you'll use." },
        { title: "Start the test", text: "Click **Start** and wait for it to finish, then open the **Report** and **Graph** tabs." },
      ],
    },

    { type: "h2", text: "Reading the report" },
    {
      type: "table",
      caption: "Key backtest statistics",
      headers: ["Statistic", "What it tells you"],
      rows: [
        ["Total net profit", "Overall result — meaningless without the drawdown beside it"],
        ["Maximum drawdown", "The largest fall from a peak; ask whether you could tolerate it with real money"],
        ["Profit factor", "Gross profit ÷ gross loss; above 1 means more was won than lost"],
        ["Total trades", "More trades make the statistics more reliable"],
        ["Largest losing trade", "Shows whether a single trade can do serious damage"],
      ],
    },
    {
      type: "p",
      text: "Look at the equity graph too. A smooth upward line that suddenly drops sharply can indicate grid or martingale behaviour hiding risk.",
    },

    { type: "h2", text: "Avoid over-optimisation" },
    {
      type: "p",
      text: "The Strategy Tester can search thousands of input combinations for the best historical result. The \"best\" settings are often tuned to noise in the past — known as **curve fitting** — and fail on new data.",
    },
    {
      type: "ul",
      items: [
        "Prefer settings that work reasonably across a wide range of values over a single sharp peak.",
        "Keep part of your history aside and test the chosen settings on it afterwards (out-of-sample testing).",
        "Be sceptical of results that look too good, especially with very few trades.",
      ],
    },

    { type: "h2", text: "After the backtest: forward test" },
    {
      type: "p",
      text: "Run the EA on a demo account for several weeks with the same settings. Comparing demo results with the backtest shows how much real spreads and execution change the picture. Then read [Understanding Drawdown, Leverage, Stop-Losses and Risk Management](/guides/forex-risk-management-drawdown-leverage-stop-loss) before going live.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Official documentation",
      text: "MetaQuotes documents the testers in detail: [MT5 Strategy Tester](https://www.metatrader5.com/en/terminal/help/algotrading/testing) and [MT4 Strategy Tester](https://www.metatrader4.com/en/trading-platform/help/autotrading/tester).",
    },
  ],
  related: ["how-to-evaluate-a-forex-trading-bot", "forex-risk-management-drawdown-leverage-stop-loss", "what-is-a-forex-expert-advisor"],
  cta: { label: "Browse Expert Advisors", href: "/marketplace?type=EA", text: "Find an EA to test — FXBotHub listings include documentation and compatibility details." },
};

export const riskManagement: Guide = {
  slug: "forex-risk-management-drawdown-leverage-stop-loss",
  title: "Understanding Drawdown, Leverage, Stop-Losses and Risk Management",
  seoTitle: "Forex Risk Management: Drawdown, Leverage, Stop-Losses and Position Sizing",
  description:
    "Forex risk management explained: sizing positions from your stop-loss, what leverage and margin mean, how drawdown works, and controls for EAs.",
  category: "risk-management",
  published: "2026-10-13",
  updated: "2026-10-13",
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
  related: ["how-to-backtest-an-expert-advisor", "how-to-evaluate-a-forex-trading-bot", "forex-trading-for-beginners"],
  cta: { label: "Browse trading tools", href: "/marketplace", text: "Look for tools that document their risk settings clearly on the FXBotHub marketplace." },
};
