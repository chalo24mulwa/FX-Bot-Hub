import type { Tutorial } from "../types";

export const installEaMt5: Tutorial = {
  slug: "install-ea-mt5",
  title: "How to Install an Expert Advisor in MT5",
  seoTitle: "How to Install an Expert Advisor (EA) in MetaTrader 5 — Tutorial",
  description:
    "Install an Expert Advisor in MetaTrader 5: copy the .ex5 file to MQL5\\Experts, attach it to a chart, allow Algo Trading and confirm it's running.",
  category: "mt5",
  difficulty: "beginner",
  estimatedMinutes: 10,
  published: "2026-10-13",
  updated: "2026-10-14",
  intro: "Add an Expert Advisor to MetaTrader 5, attach it to a chart, give it permission to trade and confirm it's running.",
  requirements: [
    "MetaTrader 5 installed and logged in — see [How to Install MetaTrader 5](/tutorials/install-metatrader-5).",
    "The EA's MT5 file: a compiled `.ex5` (an MT4 `.ex4` will not load). Extract `.zip` downloads first.",
    "Any `.set` preset files the developer supplies.",
    "Ideally a **demo account** for the first run.",
  ],
  outcomes: [
    "Put the EA file in the right folder.",
    "Attach it to a chart with the correct permissions.",
    "Check from the logs that it's running.",
  ],
  steps: [
    { title: "Open the data folder", text: ["In MT5, choose **File → Open Data Folder**, then open `MQL5` → `Experts`."] },
    {
      title: "Copy the EA file",
      text: ["Paste the `.ex5` file into `Experts`. A sub-folder per product keeps things tidy. Put any `.set` files in `MQL5\\Presets`."],
    },
    {
      title: "Refresh the Navigator",
      text: ["Open the **Navigator** (Ctrl+N), right-click **Expert Advisors** and choose **Refresh**. The EA now appears in the list."],
    },
    {
      title: "Attach the EA to a chart",
      text: ["Open a chart with the symbol and timeframe from the EA's documentation, then drag the EA onto it or double-click it in the Navigator."],
    },
    {
      title: "Allow it to trade",
      text: [
        "In the properties window, on the **Common** tab, tick **Allow Algo Trading** (called **Allow Auto Trading** in older builds).",
        "If the developer says the EA uses DLLs, enable **Allow DLL imports** on the **Dependencies** tab — only for software you trust.",
      ],
    },
    {
      title: "Review the inputs",
      text: ["On the **Inputs** tab, check the lot-size and risk settings, or click **Load** to import a `.set` file. [Configure EA settings](/tutorials/configure-ea-settings) explains the common inputs."],
    },
    {
      title: "Turn on Algo Trading",
      text: [
        "Click **OK**, then make sure the **Algo Trading** button on the main toolbar (called **AutoTrading** in older builds) is on. The EA's name and a status icon appear in the chart's top-right corner.",
      ],
    },
  ],
  expectedResult:
    "The EA's name shows in the top-right of the chart with an active status icon, and the **Experts** tab of the Toolbox (Ctrl+T) shows that it loaded on your symbol without errors.",
  troubleshooting: [
    { problem: "The EA isn't in the Navigator", fix: "Check it's an `.ex5` in `MQL5\\Experts` of the data folder (not Program Files), then refresh the Navigator or restart MT5." },
    { problem: "\"Algo trading is disabled\" in the Experts tab", fix: "Both the toolbar **Algo Trading** button and the EA's own **Allow Algo Trading** (press F7 on the chart) must be on." },
    { problem: "It loads but never trades", fix: "Follow [Troubleshoot an EA That Isn't Trading](/tutorials/troubleshoot-ea-not-trading)." },
  ],
  related: ["configure-ea-settings", "backtest-ea-mt5", "troubleshoot-ea-not-trading"],
  guides: ["what-is-a-forex-expert-advisor", "metatrader-ea-errors-troubleshooting"],
  next: "configure-ea-settings",
  links: [{ label: "MT5 Expert Advisors", href: "/marketplace?platform=MT5&type=EA" }],
  riskDisclaimer: true,
};

export const installEaMt4: Tutorial = {
  slug: "install-ea-mt4",
  title: "How to Install an Expert Advisor in MT4",
  seoTitle: "How to Install an Expert Advisor (EA) in MetaTrader 4 — Tutorial",
  description:
    "Install an Expert Advisor in MetaTrader 4: copy the .ex4 to MQL4\\Experts, attach it to a chart, tick Allow live trading and switch on AutoTrading.",
  category: "mt4",
  difficulty: "beginner",
  estimatedMinutes: 10,
  published: "2026-10-13",
  updated: "2026-10-14",
  intro: "Add an Expert Advisor to MetaTrader 4, attach it to a chart, allow it to trade and confirm it's running.",
  requirements: [
    "MetaTrader 4 installed and logged in — see [How to Install MetaTrader 4](/tutorials/install-metatrader-4).",
    "The EA's MT4 file: a compiled `.ex4` (and sometimes `.mq4` source). Extract `.zip` downloads first.",
    "Any extra files the developer supplies: `.set` presets, or files for the `Libraries` folder.",
    "Ideally a **demo account** for the first run.",
  ],
  outcomes: ["Install the EA files in the correct folders.", "Attach the EA with live trading allowed.", "Confirm in the logs that it's running."],
  steps: [
    { title: "Open the data folder", text: ["In MT4, go to **File → Open Data Folder**, then open `MQL4` → `Experts`."] },
    {
      title: "Copy the EA files",
      text: ["Paste the `.ex4` (and `.mq4`, if provided) into `Experts`. Put library files the developer mentions in `MQL4\\Libraries` and `.set` files in `MQL4\\Presets`."],
    },
    {
      title: "Refresh the Navigator",
      text: ["Open the **Navigator** (Ctrl+N), right-click **Expert Advisors** and choose **Refresh**, or restart MT4."],
    },
    {
      title: "Attach it to a chart",
      text: ["Open a chart for the symbol and timeframe the documentation specifies and drag the EA onto it (or double-click it)."],
    },
    {
      title: "Allow live trading",
      text: [
        "In the properties window, open the **Common** tab and tick **Allow live trading**. Only tick **Allow DLL imports** if the developer says the EA needs it and you trust the source.",
      ],
    },
    {
      title: "Set the inputs",
      text: ["On the **Inputs** tab, adjust settings or click **Load** to import a `.set` file. Pay particular attention to lot size and risk."],
    },
    {
      title: "Enable AutoTrading",
      text: ["Click **OK** and make sure the **AutoTrading** button on the main toolbar is on. The EA's name appears in the chart's top-right corner with an icon showing whether it may trade."],
    },
  ],
  expectedResult:
    "The EA's name is in the top-right of the chart with its trading-allowed icon, and the **Experts** tab of the Terminal window (Ctrl+T) shows it loaded successfully.",
  troubleshooting: [
    { problem: "The EA isn't in the Navigator", fix: "It must be an `.ex4` inside `MQL4\\Experts` of the data folder. Refresh the Navigator or restart MT4." },
    { problem: "Error 4109 in the Experts tab", fix: "Trading isn't allowed: switch on the toolbar **AutoTrading** button and tick **Allow live trading** in the EA's properties (F7)." },
    { problem: "\"DLL calls are not allowed\"", fix: "Enable **Allow DLL imports** for this EA — only if you trust its developer." },
  ],
  related: ["configure-ea-settings", "read-mt4-experts-journal-logs", "troubleshoot-ea-not-trading"],
  guides: ["what-is-a-forex-expert-advisor", "metatrader-ea-errors-troubleshooting"],
  next: "read-mt4-experts-journal-logs",
  links: [{ label: "MT4 Expert Advisors", href: "/marketplace?platform=MT4&type=EA" }],
  riskDisclaimer: true,
};

export const configureEaSettings: Tutorial = {
  slug: "configure-ea-settings",
  title: "How to Configure Expert Advisor Settings",
  seoTitle: "How to Configure EA Settings (Inputs and .set Files) in MT4 and MT5",
  description:
    "Configure an Expert Advisor's inputs in MT4 or MT5: lot size and risk, stop-loss units, magic numbers and spread limits, plus saving and loading .set files.",
  category: "expert-advisors",
  difficulty: "intermediate",
  estimatedMinutes: 20,
  published: "2026-10-14",
  updated: "2026-10-14",
  intro:
    "Open an attached EA's settings, review the inputs that matter most for risk, and save your configuration as a `.set` file you can reload or share with support.",
  requirements: [
    "An EA installed and attached to a chart — see the [MT5](/tutorials/install-ea-mt5) or [MT4](/tutorials/install-ea-mt4) install tutorial.",
    "The EA's documentation, which explains what each of its inputs does.",
    "A demo account for trying new settings.",
  ],
  outcomes: [
    "Reopen an EA's properties at any time.",
    "Recognise the common inputs and the units they use.",
    "Save, load and reset settings with `.set` files.",
  ],
  steps: [
    {
      title: "Open the EA's properties",
      text: ["Click the chart the EA is attached to and press **F7**, or right-click the chart and choose **Expert Advisors → Properties**. Open the **Inputs** tab."],
    },
    {
      title: "Find the position-size setting",
      text: [
        "Most EAs use either a **fixed lot** (for example 0.01) or **risk-based sizing** (a percentage of balance per trade). Start with the smallest size your account allows while you learn how the EA behaves.",
      ],
      note: { tone: "warning", text: "Settings that multiply lot size after a loss (martingale) or add positions as price moves against you (grid/averaging) concentrate risk in rare but severe losses. Make sure you understand them before changing their values." },
    },
    {
      title: "Check the units of stop-loss and take-profit",
      text: [
        "Inputs may be in **pips** or in **points**. On a 5-digit EUR/USD quote, 1 pip = 10 points, so a stop-loss of \"20\" means very different distances depending on the unit. The documentation (or the input's name) should say which one is used.",
      ],
    },
    {
      title: "Give each copy a unique magic number",
      text: [
        "The **magic number** labels the trades an EA opens so it only manages its own. If you run the same EA on several charts, give each chart a different magic number unless the developer says otherwise.",
      ],
    },
    {
      title: "Review filters and limits",
      text: ["Many EAs also have:"],
      items: [
        "A **maximum spread** — the EA won't open trades when the spread is wider.",
        "**Trading hours** or session filters (check whether they use broker server time).",
        "**Slippage** or maximum deviation for order execution.",
        "Limits such as maximum open trades or a daily loss stop.",
      ],
    },
    {
      title: "Save your settings as a .set file",
      text: [
        "On the **Inputs** tab, click **Save** and give the file a descriptive name (for example `eurusd-h1-demo.set`). It's stored in the `Presets` folder. **Load** restores it later, and **Reset** returns every input to the developer's defaults.",
      ],
    },
    {
      title: "Apply and check the log",
      text: ["Click **OK**. Most EAs re-initialise with the new values; the **Experts** tab (Ctrl+T) should show the EA reloading without errors."],
    },
  ],
  expectedResult:
    "The EA runs with inputs you understand, your configuration is saved as a `.set` file in `Presets`, and the Experts tab shows it re-initialised without errors.",
  troubleshooting: [
    { problem: "\"Invalid volume\" errors after changing the lot size", fix: "The size is below the broker's minimum, above its maximum, or not a multiple of its volume step. Check the symbol's **Specification** in Market Watch." },
    { problem: "\"Invalid stops\" errors", fix: "The stop-loss or take-profit is inside the broker's minimum distance, or you entered pips where the EA expects points. Recheck the unit." },
    { problem: "Settings are lost after restarting MetaTrader", fix: "Save a `.set` file, and save your chart layout as a profile or template so the EA and its settings come back together." },
  ],
  related: ["test-forex-bot-demo-account", "backtest-ea-mt5", "troubleshoot-ea-not-trading"],
  guides: ["forex-risk-management-drawdown-leverage-stop-loss", "what-is-a-forex-expert-advisor"],
  next: "backtest-ea-mt5",
  links: [{ label: "Browse Expert Advisors", href: "/marketplace?type=EA" }],
  riskDisclaimer: true,
};

export const readMt4Logs: Tutorial = {
  slug: "read-mt4-experts-journal-logs",
  title: "How to Read the MT4 Experts and Journal Logs",
  seoTitle: "How to Read the MT4 Experts and Journal Logs to Diagnose EA Problems",
  description:
    "Use the MT4 Experts and Journal tabs to see what your EA and terminal are doing, open the log files on disk, and copy the right lines for support.",
  category: "mt4",
  difficulty: "beginner",
  estimatedMinutes: 10,
  published: "2026-10-14",
  updated: "2026-10-14",
  intro:
    "MetaTrader 4 records what every EA does and every platform event. Learn where those logs are, how to read them, and what to send a developer when you need help.",
  requirements: ["MetaTrader 4 with an Expert Advisor attached to a chart."],
  outcomes: [
    "Tell the Experts log and the Journal apart.",
    "Find error lines and their codes.",
    "Open the log files on disk and share the relevant part.",
  ],
  steps: [
    { title: "Open the Terminal window", text: ["Press **Ctrl+T** (or **View → Terminal**). The tabs along its bottom edge include **Experts** and **Journal**."] },
    {
      title: "Read the Experts tab",
      text: [
        "**Experts** shows messages from EAs and indicators: when they load or are removed, anything their code prints, and errors such as a rejected order. Each line has a time, the program's name and the symbol and timeframe it runs on.",
      ],
    },
    {
      title: "Read the Journal tab",
      text: [
        "**Journal** shows platform events: logging in, connection lost or restored, orders sent and the broker's response. If an EA \"did nothing\", the Journal shows whether an order ever reached the broker.",
      ],
    },
    {
      title: "Look for error codes",
      text: ["Errors are usually reported with a number. Common ones in MT4:"],
      items: [
        "**4109** — trading not allowed (AutoTrading or **Allow live trading** is off).",
        "**130** — invalid stops (stop-loss/take-profit too close or on the wrong side).",
        "**131** — invalid trade volume.",
        "**134** — not enough money (free margin).",
      ],
    },
    {
      title: "Open the log files on disk",
      text: [
        "Right-click inside the Experts or Journal tab and choose **Open**. This opens the folder with the day's log files, named by date (for example `20261014.log`) — the Journal's in the data folder's `logs` folder and the Experts log in `MQL4\\Logs`.",
      ],
    },
    {
      title: "Share the right lines",
      text: [
        "When asking a developer for help, copy the lines from a few minutes before and after the problem, plus your MT4 build number (**Help → About**) and your broker. On FXBotHub, send them with **Contact seller** on the product page.",
      ],
      note: { tone: "info", text: "Log lines can include your account number. Remove anything you don't want to share before sending them." },
    },
  ],
  expectedResult:
    "You can find your EA's latest messages in the Experts tab, see whether orders reached the broker in the Journal, and open the matching log file for the day.",
  troubleshooting: [
    { problem: "The Experts tab is empty", fix: "No EA has printed anything yet, or none is attached. Re-attach the EA and watch for its load message." },
    { problem: "Too many lines to read", fix: "Right-click the tab and use the option to clear the view (the file on disk is kept), then reproduce the problem so only new lines appear." },
  ],
  related: ["troubleshoot-ea-not-trading", "install-ea-mt4", "configure-ea-settings"],
  guides: ["metatrader-ea-errors-troubleshooting"],
  next: "troubleshoot-ea-not-trading",
  links: [{ label: "MT4 Expert Advisors", href: "/marketplace?platform=MT4&type=EA" }],
  sources: [{ label: "MQL4 documentation", url: "https://docs.mql4.com/" }],
  riskDisclaimer: false,
};

export const troubleshootEaNotTrading: Tutorial = {
  slug: "troubleshoot-ea-not-trading",
  title: "How to Troubleshoot an EA That Isn't Trading",
  seoTitle: "EA Not Trading? Step-by-Step Troubleshooting for MT4 and MT5",
  description:
    "Work through the checks that fix most idle Expert Advisors in MT4 and MT5: permissions, market hours, the logs, broker rejections, filters and inputs.",
  category: "expert-advisors",
  difficulty: "intermediate",
  estimatedMinutes: 20,
  published: "2026-10-14",
  updated: "2026-10-14",
  intro:
    "Your EA is on the chart but no trades appear. Go through these checks in order — each one rules out a common cause before you move on to the next.",
  requirements: [
    "MT4 or MT5 with the EA attached to a chart.",
    "The EA's documentation (symbols, timeframe and the conditions it trades on).",
  ],
  outcomes: [
    "Rule out permission, connection and market-hours problems.",
    "Use the logs to see whether the EA tried to trade.",
    "Separate broker rejections from an EA that simply hasn't had a signal.",
  ],
  steps: [
    {
      title: "Check both trading switches",
      text: [
        "The toolbar button must be on — **AutoTrading** in MT4, **Algo Trading** in MT5 — **and** the EA's own permission: **Allow live trading** (MT4) or **Allow Algo Trading** (MT5) on the **Common** tab (press F7 on the chart).",
      ],
    },
    {
      title: "Confirm you're connected and the market is open",
      text: [
        "The bottom-right corner should show a live connection. Check the symbol's trading sessions under **Specification** in Market Watch — orders are rejected outside them, and over weekends for most forex symbols.",
      ],
    },
    {
      title: "Read the Experts tab",
      text: [
        "Open Ctrl+T → **Experts**. Errors such as **4109** (MT4) or **4752** (MT5) mean trading isn't allowed; a missing load message means the EA isn't running at all. See [How to Read the MT4 Experts and Journal Logs](/tutorials/read-mt4-experts-journal-logs).",
      ],
    },
    {
      title: "Check the Journal for broker rejections",
      text: ["If an order was sent but refused, the Journal shows why:"],
      items: [
        "**Invalid stops** (MT4 130 · MT5 10016) — stops too close to price.",
        "**Invalid volume** (MT4 131 · MT5 10014) — lot size outside the broker's limits or step.",
        "**Not enough money** (MT4 134 · MT5 10019) — insufficient free margin.",
        "**Market closed** (MT4 132 · MT5 10018).",
      ],
    },
    {
      title: "Check the symbol and timeframe",
      text: [
        "Make sure the chart's symbol and timeframe match the documentation. Brokers often add suffixes (for example `EURUSD.m`); some EAs need the exact name entered in an input.",
      ],
    },
    {
      title: "Check the EA's own filters",
      text: [
        "A maximum-spread limit, trading-hours window, news filter or maximum-trades limit can legitimately block entries. Compare the current spread and server time with those inputs.",
      ],
    },
    {
      title: "Allow web requests if the EA verifies a license",
      text: [
        "EAs that check a license online need **Tools → Options → Expert Advisors → Allow WebRequest for listed URL**, with the address the developer gives you added to the list.",
      ],
    },
    {
      title: "Wait for a real signal — or contact the developer",
      text: [
        "If every check passes and the logs show no errors, the EA may simply be waiting for its conditions; some strategies trade rarely. If that doesn't match the documentation, send the developer your Experts and Journal lines, platform and build, broker and `.set` file.",
      ],
    },
  ],
  expectedResult:
    "You've either found and fixed the cause (the next signal produces a trade or a clear log message), or you've confirmed the EA is waiting for its conditions and have the logs ready if you need support.",
  troubleshooting: [
    { problem: "It trades in the Strategy Tester but not live", fix: "Live trading adds permissions, real spreads, filters and broker rules the tester may not reproduce. Go back through steps 1, 4 and 6." },
    { problem: "It stopped trading overnight", fix: "MetaTrader must stay open and connected. If your computer slept or restarted, the EA stopped with it — a VPS avoids this." },
    { problem: "\"DLL calls are not allowed\"", fix: "Enable **Allow DLL imports** for this EA, only if you trust its developer." },
  ],
  related: ["read-mt4-experts-journal-logs", "configure-ea-settings", "test-forex-bot-demo-account"],
  guides: ["metatrader-ea-errors-troubleshooting"],
  next: "test-forex-bot-demo-account",
  links: [{ label: "Browse Expert Advisors", href: "/marketplace?type=EA" }],
  sources: [
    { label: "WebRequest (MQL4 reference)", url: "https://docs.mql4.com/common/webrequest" },
    { label: "WebRequest (MQL5 reference)", url: "https://www.mql5.com/en/docs/network/webrequest" },
  ],
  riskDisclaimer: true,
};
