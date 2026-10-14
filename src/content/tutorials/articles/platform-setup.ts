import type { Tutorial } from "../types";

export const installMetatrader5: Tutorial = {
  slug: "install-metatrader-5",
  title: "How to Install MetaTrader 5 on Windows",
  seoTitle: "How to Install MetaTrader 5 (MT5) on Windows — Step-by-Step Tutorial",
  description:
    "Download MetaTrader 5 from the official site or your broker, install it on Windows, log in to a demo or live account and find the MT5 data folder.",
  category: "mt5",
  difficulty: "beginner",
  estimatedMinutes: 15,
  published: "2026-10-13",
  updated: "2026-10-14",
  intro:
    "Install MetaTrader 5 on a Windows PC, connect it to your broker account and locate the folder where MT5 keeps Expert Advisors, indicators and presets.",
  requirements: [
    "A Windows computer and permission to install software on it.",
    "A broker that offers MetaTrader 5, plus your account **login**, **password** and **server name** — or you can open a demo account inside MT5.",
    "A stable internet connection (the installer downloads the platform files).",
  ],
  outcomes: [
    "Download MT5 from a trustworthy source.",
    "Install it and connect to a demo or live trading account.",
    "Open the MT5 data folder and know which sub-folder each kind of file belongs in.",
  ],
  steps: [
    {
      title: "Download the installer",
      text: [
        "Get MT5 from the official [MetaTrader 5 download page](https://www.metatrader5.com/en/download) or from your broker's website or client area. A broker's copy is the same platform, often pre-configured with that broker's servers.",
      ],
      note: { tone: "warning", text: "Avoid installers from unofficial download sites — a modified trading platform can expose your account." },
    },
    {
      title: "Run the setup file",
      text: [
        "Open the downloaded file and accept the Windows security prompt. Read the licence agreement and, if you want MT5 in a specific folder (useful when you install it for more than one broker), choose **Settings** to change the installation folder.",
      ],
    },
    {
      title: "Let the installer finish",
      text: ["The installer downloads the latest platform files, creates a desktop shortcut and usually opens MT5 when it's done."],
    },
    {
      title: "Log in to your trading account",
      text: [
        "Choose **File → Login to Trade Account**, enter your login and password, and select your broker's server. If the server isn't listed, type your broker's name into the server search box.",
        "No account yet? **File → Open an Account** lets you open a demo account with a broker listed in the dialog.",
      ],
    },
    {
      title: "Check the connection",
      text: [
        "Look at the bottom-right corner of the window: once connected it shows the connection status and ping. Prices in the **Market Watch** window (Ctrl+M) should start moving during market hours.",
      ],
    },
    {
      title: "Open the data folder",
      text: [
        "Choose **File → Open Data Folder** and open the `MQL5` folder. This — not the program folder in `Program Files` — is where everything you add to MT5 lives.",
      ],
      items: [
        "`MQL5\\Experts` — Expert Advisors (`.ex5`)",
        "`MQL5\\Indicators` — custom indicators (`.ex5`)",
        "`MQL5\\Scripts` — scripts",
        "`MQL5\\Presets` — saved input settings (`.set`)",
      ],
    },
  ],
  expectedResult:
    "MT5 is open, connected to your account (the status in the bottom-right corner shows a ping), Market Watch prices update during market hours, and you can open the `MQL5` data folder from the File menu.",
  troubleshooting: [
    { problem: "\"No connection\" or \"Invalid account\" in the bottom-right corner", fix: "Recheck the server name and password from your broker. Demo accounts can expire after a period of inactivity — open a new one if yours has." },
    { problem: "My broker's server isn't in the list", fix: "Type the broker's name into the server search box in the login dialog, or install your broker's own branded copy of MT5." },
    { problem: "Windows blocks the installer", fix: "Make sure you downloaded it from the official site or your broker, then allow it in the Windows security prompt. On a work computer you may need administrator rights." },
    { problem: "I can't find the data folder in Program Files", fix: "It isn't there by design. Always use **File → Open Data Folder** from inside MT5." },
  ],
  related: ["install-ea-mt5", "install-indicator-mt5", "compare-mt4-mt5-tools"],
  guides: ["forex-trading-for-beginners"],
  next: "install-ea-mt5",
  links: [
    { label: "MT5 Expert Advisors", href: "/marketplace?platform=MT5&type=EA" },
    { label: "MT5 indicators", href: "/marketplace?platform=MT5&type=INDICATOR" },
  ],
  sources: [{ label: "MetaTrader 5 official download page", url: "https://www.metatrader5.com/en/download" }],
  riskDisclaimer: false,
};

export const installMetatrader4: Tutorial = {
  slug: "install-metatrader-4",
  title: "How to Install MetaTrader 4 on Windows",
  seoTitle: "How to Install MetaTrader 4 (MT4) on Windows — Step-by-Step Tutorial",
  description:
    "Install MetaTrader 4 from your broker's website, log in to a demo or live account, confirm the connection and find the MT4 data folder on Windows.",
  category: "mt4",
  difficulty: "beginner",
  estimatedMinutes: 15,
  published: "2026-10-13",
  updated: "2026-10-14",
  intro:
    "Install MetaTrader 4 from your broker, connect it to your trading account and find the `MQL4` folder where Expert Advisors and indicators go.",
  requirements: [
    "A Windows computer and permission to install software on it.",
    "An account with a broker that supports MT4 (demo or live), and its **login number**, **password** and **server name**.",
  ],
  outcomes: [
    "Install your broker's copy of MT4.",
    "Log in and confirm the platform is connected.",
    "Find the MT4 data folder and its `Experts`, `Indicators` and `Presets` sub-folders.",
  ],
  steps: [
    {
      title: "Download MT4 from your broker",
      text: [
        "MT4 is distributed through brokers, usually as a branded installer pre-configured with that broker's servers. Download it from your broker's official website or client area.",
      ],
      note: { tone: "warning", text: "Don't use MT4 installers from unofficial download sites." },
    },
    {
      title: "Run the setup file",
      text: ["Open the file, accept the Windows security prompt and the licence agreement. Choose **Settings** first if you want a custom installation folder."],
    },
    {
      title: "Let the installer finish",
      text: ["It downloads the platform files and creates a desktop shortcut. MT4 normally opens when it's done and may offer to open a demo account."],
    },
    {
      title: "Log in to your trading account",
      text: ["Go to **File → Login to Trade Account**, enter your login number and password, and select the server name your broker gave you."],
    },
    {
      title: "Confirm you're connected",
      text: [
        "The connection indicator in the bottom-right corner shows data traffic once you're connected. If it reads \"No connection\" or \"Invalid account\", recheck the server name and password.",
      ],
    },
    {
      title: "Open the data folder",
      text: ["Choose **File → Open Data Folder**, then open `MQL4`."],
      items: [
        "`MQL4\\Experts` — Expert Advisors (`.ex4` / `.mq4`)",
        "`MQL4\\Indicators` — custom indicators",
        "`MQL4\\Scripts` — scripts",
        "`MQL4\\Libraries` — libraries some tools need",
        "`MQL4\\Presets` — saved `.set` input files",
      ],
    },
  ],
  expectedResult:
    "MT4 is logged in to your account, the connection indicator shows traffic, and you can open the `MQL4` data folder from **File → Open Data Folder**.",
  troubleshooting: [
    { problem: "\"Invalid account\"", fix: "The login, password or server doesn't match. Copy the details exactly from your broker's email or client area — demo and live accounts use different servers." },
    { problem: "\"No connection\"", fix: "Check your internet connection and firewall, then right-click the connection indicator to rescan servers if your build offers it." },
    { problem: "I have two brokers' MT4 installed and my EA only shows in one", fix: "That's expected: each installation has its own data folder. Copy the EA into the data folder of each terminal you use." },
  ],
  related: ["install-ea-mt4", "install-indicator-mt4", "read-mt4-experts-journal-logs"],
  guides: ["forex-trading-for-beginners"],
  next: "install-ea-mt4",
  links: [
    { label: "MT4 Expert Advisors", href: "/marketplace?platform=MT4&type=EA" },
    { label: "MT4 indicators", href: "/marketplace?platform=MT4&type=INDICATOR" },
  ],
  riskDisclaimer: false,
};

export const compareMt4Mt5Tools: Tutorial = {
  slug: "compare-mt4-mt5-tools",
  title: "How to Choose Between MT4 and MT5 Trading Tools",
  seoTitle: "MT4 vs MT5 Trading Tools: How to Choose the Right Platform",
  description:
    "Work out whether you need MT4 or MT5 tools: check your broker, file types and Strategy Tester needs, then pick EAs and indicators that match.",
  category: "getting-started",
  difficulty: "beginner",
  estimatedMinutes: 10,
  published: "2026-10-14",
  updated: "2026-10-14",
  intro:
    "MT4 and MT5 tools are not interchangeable. Follow these checks to decide which platform you'll use, then filter the marketplace for tools that actually run on it.",
  requirements: ["Your broker's name (or the brokers you're considering).", "A rough idea of the kind of tool you want — an Expert Advisor, an indicator or a utility."],
  outcomes: [
    "Know which platforms your broker supports.",
    "Understand the practical differences that affect which tools you can use.",
    "Filter for tools that match your platform before you download or buy anything.",
  ],
  steps: [
    {
      title: "Check which platform your broker offers",
      text: [
        "Look on your broker's website or ask support whether they offer MT4, MT5 or both, and for which account types. This is the deciding factor: a tool is only useful on a platform your broker supports.",
      ],
    },
    {
      title: "Check the file type of the tool you want",
      text: [
        "Compiled MT4 programs are `.ex4` files and MT5 programs are `.ex5`. An `.ex4` won't run in MT5 and an `.ex5` won't run in MT4 — they're written in different languages (MQL4 and MQL5). Some developers sell separate builds for each platform.",
      ],
    },
    {
      title: "Decide what you need from testing",
      text: [
        "If you plan to backtest Expert Advisors seriously, MT5's Strategy Tester can test on real tick history, use several CPU cores and test strategies that trade more than one symbol. MT4's tester is simpler and single-symbol.",
      ],
    },
    {
      title: "Check your account mode",
      text: [
        "MT4 accounts allow several positions on the same symbol (hedging). MT5 accounts can be **hedging** or **netting** (one combined position per symbol), depending on the broker. Some EAs only work in hedging mode — their documentation should say so.",
      ],
    },
    {
      title: "Filter the marketplace for your platform",
      text: [
        "On FXBotHub, filter by platform: [MT4](/marketplace?platform=MT4), [MT5](/marketplace?platform=MT5), or **Multi-platform** for products that ship both builds. Every listing shows its platform as a badge next to the title.",
      ],
    },
  ],
  reference: {
    heading: "MT4 and MT5 at a glance",
    blocks: [
      {
        type: "table",
        caption: "Practical differences between MetaTrader 4 and MetaTrader 5",
        headers: ["", "MetaTrader 4", "MetaTrader 5"],
        rows: [
          ["Program files", ".ex4 (source .mq4)", ".ex5 (source .mq5)"],
          ["Programming language", "MQL4", "MQL5"],
          ["Timeframes", "9", "21"],
          ["Pending order types", "4", "6 (adds Buy Stop Limit and Sell Stop Limit)"],
          ["Strategy Tester", "Single symbol, single thread", "Multi-threaded, real ticks, multi-symbol"],
          ["Account modes", "Hedging", "Hedging or netting, set by the broker"],
          ["Built-in economic calendar", "No", "Yes"],
        ],
      },
      {
        type: "p",
        text: "Neither platform is \"better\" for every trader. The right one is the one your broker supports that runs the tools you want to use.",
      },
    ],
  },
  expectedResult:
    "You know which platform you'll use and you're browsing only tools built for it, so every file you download will actually load in your terminal.",
  troubleshooting: [
    { problem: "A tool I want only exists for the other platform", fix: "Ask the seller with **Contact seller** whether a build for your platform is planned — don't try to convert the file yourself." },
    { problem: "My broker offers both", fix: "Pick the one where the tools you want are available; you can install both platforms side by side on one PC." },
  ],
  related: ["install-metatrader-5", "install-metatrader-4", "find-trading-tools-fxbothub"],
  guides: ["what-is-a-forex-expert-advisor", "forex-trading-for-beginners"],
  next: "install-metatrader-5",
  links: [
    { label: "MT4 tools", href: "/marketplace?platform=MT4" },
    { label: "MT5 tools", href: "/marketplace?platform=MT5" },
  ],
  sources: [
    { label: "MQL4 documentation", url: "https://docs.mql4.com/" },
    { label: "MQL5 documentation", url: "https://www.mql5.com/en/docs" },
  ],
  riskDisclaimer: false,
};
