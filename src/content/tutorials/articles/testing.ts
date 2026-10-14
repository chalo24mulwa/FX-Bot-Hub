import type { Tutorial } from "../types";

export const backtestEaMt5: Tutorial = {
  slug: "backtest-ea-mt5",
  title: "How to Run a Strategy Backtest in MT5",
  seoTitle: "How to Backtest an Expert Advisor in the MT5 Strategy Tester",
  description:
    "Run an Expert Advisor backtest in the MetaTrader 5 Strategy Tester: choose the modelling mode, deposit and delays, then read the report and graph honestly.",
  category: "testing-risk",
  difficulty: "intermediate",
  estimatedMinutes: 30,
  published: "2026-10-13",
  updated: "2026-10-14",
  intro:
    "Run an EA over historical data in the MetaTrader 5 Strategy Tester, with settings that resemble your real account, and read the results without fooling yourself.",
  requirements: [
    "MetaTrader 5 with the EA installed — see [How to Install an Expert Advisor in MT5](/tutorials/install-ea-mt5).",
    "The EA's recommended symbol, timeframe and `.set` file.",
    "Time for the tester to download history the first time (it can take a while for long periods).",
  ],
  outcomes: [
    "Configure a backtest that resembles your real trading conditions.",
    "Read the key statistics and the equity graph.",
    "Recognise results that are too good to trust.",
  ],
  steps: [
    { title: "Open the Strategy Tester", text: ["Choose **View → Strategy Tester** (Ctrl+R). The tester opens as a panel with several tabs, starting with **Settings**."] },
    {
      title: "Choose the EA, symbol and timeframe",
      text: ["Select your Expert Advisor, then the symbol and timeframe given in its documentation."],
    },
    {
      title: "Set a meaningful date range",
      text: [
        "Pick a custom period long enough to include different conditions — trends, ranges and volatile spells — rather than just the last few months. Leave **Forward** off for a first test.",
      ],
    },
    {
      title: "Pick the modelling mode",
      text: [
        "For EAs that act within a bar, choose **Every tick based on real ticks** when your broker provides tick history — the most detailed mode, and the one that uses recorded spreads. **Open prices only** is much faster but only valid for EAs that trade on a new bar.",
      ],
    },
    {
      title: "Match your account",
      text: [
        "Set **Deposit** and **Leverage** to what you'll actually trade with. Under **Delays**, choose a non-zero execution delay rather than ideal execution to make fills more realistic.",
      ],
    },
    {
      title: "Load the inputs",
      text: ["On the **Inputs** tab, right-click and load the developer's `.set` file or your own, and keep **Optimization** disabled for this run."],
    },
    {
      title: "Start the test",
      text: ["Click **Start**. When it finishes, open the **Backtest** tab for the report and the **Graph** tab for the balance and equity curves."],
    },
    {
      title: "Read the report",
      text: ["Look at these together, never profit alone:"],
      items: [
        "**Total net profit** — meaningless without the drawdown beside it.",
        "**Maximum drawdown** (balance and equity) — could you sit through it with real money?",
        "**Profit factor** — gross profit ÷ gross loss.",
        "**Total trades** — very few trades make every other number unreliable.",
        "**Largest loss trade** — can a single trade do serious damage?",
      ],
    },
    {
      title: "Check costs and the equity curve",
      text: [
        "Scroll the deals in the report to confirm commission was charged if your broker charges it — if not, live results will be worse. On the graph, a smooth rising line with sudden deep drops often means grid or martingale risk.",
      ],
      note: {
        tone: "warning",
        text: "Don't run an optimisation and keep the single best result: those settings are usually fitted to past noise. Prefer settings that work reasonably across a range of values, and test them on a period you didn't optimise on.",
      },
    },
  ],
  expectedResult:
    "A completed report and graph for your EA on realistic settings, with the net profit read alongside maximum drawdown, trade count and costs — and a clear idea of whether it's worth a demo forward test.",
  troubleshooting: [
    { problem: "\"No history\" or the test ends immediately", fix: "Let the tester download data and try again, or choose a period your broker has history for." },
    { problem: "No trades at all", fix: "Check the Journal tab of the tester for errors, confirm the symbol name matches what the EA expects, and that its filters (spread, hours) can be met." },
    { problem: "Results differ every time with real ticks", fix: "Random execution delays change fills slightly between runs. Use the same delay setting when comparing configurations." },
    { problem: "Licensed EA won't run in the tester", fix: "WebRequest-based license checks can't run in the Strategy Tester. Check the developer's instructions for testing." },
  ],
  related: ["test-forex-bot-demo-account", "configure-ea-settings", "evaluate-forex-bot-before-buying"],
  guides: ["forex-risk-management-drawdown-leverage-stop-loss", "how-to-evaluate-a-forex-trading-bot"],
  next: "test-forex-bot-demo-account",
  links: [{ label: "MT5 Expert Advisors", href: "/marketplace?platform=MT5&type=EA" }],
  sources: [
    { label: "MT5 Strategy Tester (MetaQuotes help)", url: "https://www.metatrader5.com/en/terminal/help/algotrading/testing" },
    { label: "MT4 Strategy Tester (MetaQuotes help)", url: "https://www.metatrader4.com/en/trading-platform/help/autotrading/tester" },
  ],
  riskDisclaimer: true,
};

export const testBotOnDemo: Tutorial = {
  slug: "test-forex-bot-demo-account",
  title: "How to Test a Forex Bot on a Demo Account",
  seoTitle: "How to Forward Test a Forex Bot (EA) on a Demo Account",
  description:
    "Forward test an Expert Advisor on a demo account: open a demo, mirror your real settings, keep a simple log and compare results with the backtest.",
  category: "testing-risk",
  difficulty: "beginner",
  estimatedMinutes: 25,
  published: "2026-10-14",
  updated: "2026-10-14",
  intro:
    "A backtest shows the past; a demo forward test shows how an EA behaves with live prices, spreads and execution — without risking money. Set one up properly and know what to look for.",
  requirements: [
    "MT4 or MT5 installed — see the [MT5](/tutorials/install-metatrader-5) or [MT4](/tutorials/install-metatrader-4) install tutorial.",
    "The EA installed and configured — see [Configure EA Settings](/tutorials/configure-ea-settings).",
    "A computer or VPS that can keep MetaTrader running during the test.",
  ],
  outcomes: [
    "Open a demo account that resembles your planned live account.",
    "Run the EA with the same settings you'd use live.",
    "Judge the result against the backtest and the EA's documentation.",
  ],
  steps: [
    {
      title: "Open a demo account with your broker",
      text: [
        "Use **File → Open an Account**, or open a demo in your broker's client area. Choose the same account type, currency, leverage and a balance close to what you'd actually trade.",
      ],
    },
    {
      title: "Log in and install the EA",
      text: ["Log in to the demo account, then install and attach the EA as in the [MT5](/tutorials/install-ea-mt5) or [MT4](/tutorials/install-ea-mt4) tutorial."],
    },
    {
      title: "Use your real settings",
      text: [
        "Load the same `.set` file you plan to use live. Testing with a larger lot size or a different symbol than you'll trade makes the result meaningless.",
      ],
    },
    {
      title: "Keep MetaTrader running",
      text: [
        "The EA only works while the terminal is open and connected. Disable sleep on the computer, or run the test on a VPS, and check the connection status daily.",
      ],
    },
    {
      title: "Keep a simple log",
      text: ["Once a day or week, note:"],
      items: [
        "Balance, equity and the deepest drawdown so far.",
        "Number of trades and any errors in the Experts or Journal tabs.",
        "Anything unusual — trades during news, wide spreads, missed sessions.",
      ],
    },
    {
      title: "Run it long enough",
      text: [
        "Give the test several weeks and enough trades to mean something; an EA that trades rarely needs longer. A handful of trades proves very little either way.",
      ],
    },
    {
      title: "Compare with the backtest and documentation",
      text: [
        "Are trade frequency, average trade and drawdown in line with the backtest for a similar period? Large differences usually come from spreads, slippage or execution — and are what you'd see live.",
      ],
    },
  ],
  expectedResult:
    "Several weeks of demo results on your real settings, with a log of drawdown, trades and errors that you can compare with the backtest before deciding whether to risk real money.",
  troubleshooting: [
    { problem: "My demo account expired", fix: "Some brokers expire inactive demos. Open a new one and keep the terminal logged in regularly." },
    { problem: "Demo results look much better than expected", fix: "Demo execution can be more favourable than live. If you go live, start with the smallest position size." },
    { problem: "Gaps in the results", fix: "The terminal was probably closed or disconnected. Check the Journal for disconnects and consider a VPS." },
  ],
  related: ["backtest-ea-mt5", "evaluate-forex-bot-before-buying", "troubleshoot-ea-not-trading"],
  guides: ["forex-risk-management-drawdown-leverage-stop-loss", "how-to-evaluate-a-forex-trading-bot"],
  next: "evaluate-forex-bot-before-buying",
  links: [
    { label: "Free Expert Advisors to practise with", href: "/marketplace?type=EA&pricingType=FREE" },
    { label: "All Expert Advisors", href: "/marketplace?type=EA" },
  ],
  riskDisclaimer: true,
};
