import type { Guide } from "../types";

export const howToInstallMt4: Guide = {
  slug: "how-to-install-metatrader-4",
  title: "How to Install MetaTrader 4 on Your Computer",
  seoTitle: "How to Install MetaTrader 4 (MT4) on Windows — Step by Step",
  description:
    "Step-by-step instructions to download and install MetaTrader 4 from your broker, log in to a demo or live account, and find the MT4 data folder.",
  category: "mt4",
  published: "2026-10-13",
  updated: "2026-10-13",
  intro:
    "You'll learn where to get MetaTrader 4, how to install it on Windows, how to log in to your broker account, and where MT4 keeps its Expert Advisor and indicator files.",
  riskDisclaimer: false,
  blocks: [
    { type: "h2", text: "Before you start" },
    {
      type: "ul",
      items: [
        "A Windows computer. MT4 is a Windows application; on macOS or Linux it is usually run through a compatibility layer, which your broker may provide.",
        "A trading account (demo or live) with a broker that supports MT4, plus its **login number**, **password** and **server name**.",
        "Administrator rights on your computer to run the installer.",
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Download MT4 from your broker",
      text: "MT4 is distributed through brokers, and many brokers ship their own branded installer that is pre-configured with their servers. Download it from your broker's official website or client area, and avoid installers from unofficial sites.",
    },

    { type: "h2", text: "Install MT4 step by step" },
    {
      type: "steps",
      items: [
        { title: "Download the installer", text: "In your broker's client area or downloads page, choose MetaTrader 4 for Windows. The file is usually a small setup program." },
        { title: "Run the setup file", text: "Open the downloaded file and accept the Windows security prompt. Review the licence agreement and, if you want a custom location, choose **Settings** to change the install folder." },
        { title: "Let the installer finish", text: "The installer downloads the platform files and creates a desktop shortcut. When it finishes, MT4 usually opens automatically." },
        { title: "Log in to your trading account", text: "MT4 may prompt you to choose a server and open a demo account. To use an existing account, go to **File → Login to Trade Account**, enter your login number and password, and select the server name your broker gave you." },
        { title: "Confirm you're connected", text: "The connection indicator in the bottom-right corner of the window shows traffic once connected. If it says \"No connection\" or \"Invalid account\", recheck the server name and password." },
      ],
    },

    { type: "h2", text: "Find the MT4 data folder" },
    {
      type: "p",
      text: "Everything you add to MT4 — Expert Advisors, indicators, scripts and preset files — lives in the **data folder**, not the program folder. Open it with **File → Open Data Folder**, then go into the `MQL4` folder:",
    },
    {
      type: "table",
      caption: "Where MT4 stores files",
      headers: ["Folder", "What goes there"],
      rows: [
        ["MQL4\\Experts", "Expert Advisors (.ex4 / .mq4)"],
        ["MQL4\\Indicators", "Custom indicators (.ex4 / .mq4)"],
        ["MQL4\\Scripts", "Scripts"],
        ["MQL4\\Libraries", "Libraries (DLL or .ex4) that some tools need"],
        ["MQL4\\Presets", "Settings (.set) files for EAs"],
      ],
    },
    {
      type: "p",
      text: "Next, follow [How to Install an Expert Advisor in MT4](/guides/how-to-install-an-ea-in-mt4) or [How to Install and Use a Forex Indicator](/guides/how-to-install-a-forex-indicator).",
    },

    { type: "h2", text: "Running more than one MT4" },
    {
      type: "p",
      text: "If you trade with several brokers, install each broker's MT4 into its own folder. Each installation keeps its own data folder, settings and Expert Advisors, so an EA added to one terminal won't appear in another.",
    },

    { type: "h2", text: "Tips for a smooth setup" },
    {
      type: "ul",
      items: [
        "Use a demo account first, especially before attaching any Expert Advisor.",
        "Keep MT4 updated — the platform updates itself from the broker's server when a new build is available.",
        "If you run an EA around the clock, your computer must stay on and connected. Many traders use a virtual private server (VPS) for this.",
      ],
    },
  ],
  related: ["how-to-install-an-ea-in-mt4", "how-to-install-a-forex-indicator", "metatrader-ea-errors-troubleshooting"],
  cta: { label: "Browse MT4 Expert Advisors", href: "/marketplace?platform=MT4&type=EA", text: "Find Expert Advisors built for MetaTrader 4 on the FXBotHub marketplace." },
};

export const howToInstallMt5: Guide = {
  slug: "how-to-install-metatrader-5",
  title: "How to Install MetaTrader 5 on Your Computer",
  seoTitle: "How to Install MetaTrader 5 (MT5) — Download, Setup and Login",
  description:
    "How to download MetaTrader 5 from the official site or your broker, install it on Windows, connect to your trading account and locate the MT5 data folder.",
  category: "mt5",
  published: "2026-10-13",
  updated: "2026-10-13",
  intro:
    "This guide walks through installing MetaTrader 5, logging in to a demo or live account, and finding where MT5 stores Expert Advisors, indicators and other files.",
  riskDisclaimer: false,
  blocks: [
    { type: "h2", text: "Where to download MetaTrader 5" },
    {
      type: "p",
      text: "You can download MT5 from the official [MetaTrader 5 website](https://www.metatrader5.com/en/download) or from your broker's website. A broker's version is the same platform, often pre-configured with that broker's servers. MetaQuotes also publishes versions for other operating systems and mobile devices on its download page.",
    },
    {
      type: "ul",
      items: [
        "You'll need your account **login**, **password** and **server name** from your broker (or you can open a demo account inside MT5).",
        "MT5 is a separate program from MT4. Their files are not interchangeable: MT4 tools (.ex4) don't run in MT5, and vice versa.",
      ],
    },

    { type: "h2", text: "Install MT5 step by step" },
    {
      type: "steps",
      items: [
        { title: "Run the installer", text: "Open the downloaded setup file and accept the Windows security prompt." },
        { title: "Review the options", text: "Accept the licence agreement. Use **Settings** if you want to change the installation folder — useful if you install MT5 for more than one broker." },
        { title: "Wait for the download to complete", text: "The installer downloads the latest platform files and launches MT5 when it's done." },
        { title: "Connect to your account", text: "Choose **File → Login to Trade Account**, enter your login and password, and select your broker's server. If the server isn't listed, type the broker's name into the server search box." },
        { title: "Check the connection", text: "The status in the bottom-right corner shows the connection and ping once you're logged in." },
      ],
    },

    { type: "h2", text: "The MT5 data folder" },
    {
      type: "p",
      text: "Open **File → Open Data Folder** and go into `MQL5`. Expert Advisors belong in `MQL5\\Experts`, custom indicators in `MQL5\\Indicators`, scripts in `MQL5\\Scripts`, and preset files in `MQL5\\Presets`.",
    },

    { type: "h2", text: "Turning on automated trading" },
    {
      type: "p",
      text: "Expert Advisors can only trade when automated trading is enabled. In MT5 this is the **Algo Trading** button on the toolbar, and each EA also needs permission in its own settings. The full process is in [How to Install an Expert Advisor in MT5](/guides/how-to-install-an-ea-in-mt5).",
    },

    { type: "h2", text: "MT5 features worth knowing" },
    {
      type: "ul",
      items: [
        "A multi-threaded **Strategy Tester** that can test using real tick data — see [How to Backtest an Expert Advisor](/guides/how-to-backtest-an-expert-advisor).",
        "More timeframes and built-in analytical tools than MT4.",
        "Support for both hedging and netting account modes, depending on your broker.",
      ],
    },
  ],
  related: ["how-to-install-an-ea-in-mt5", "how-to-backtest-an-expert-advisor", "how-to-install-a-forex-indicator"],
  cta: { label: "Browse MT5 Expert Advisors", href: "/marketplace?platform=MT5&type=EA", text: "Explore trading robots and tools built for MetaTrader 5." },
};
