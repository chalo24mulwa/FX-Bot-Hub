import type { Tutorial } from "../types";

export const installIndicatorMt5: Tutorial = {
  slug: "install-indicator-mt5",
  title: "How to Install a Custom Indicator in MT5",
  seoTitle: "How to Install a Custom Indicator in MetaTrader 5 — Tutorial",
  description:
    "Install a custom indicator in MetaTrader 5: copy the .ex5 to MQL5\\Indicators, add it to a chart, adjust its inputs and save the setup as a template.",
  category: "indicators",
  difficulty: "beginner",
  estimatedMinutes: 10,
  published: "2026-10-13",
  updated: "2026-10-14",
  intro: "Add a custom indicator to MetaTrader 5, configure its inputs and colours, and save the chart as a template you can reuse.",
  requirements: [
    "MetaTrader 5 installed — see [How to Install MetaTrader 5](/tutorials/install-metatrader-5).",
    "The indicator's MT5 file (`.ex5`). An MT4 `.ex4` will not load in MT5. Extract `.zip` downloads first.",
  ],
  outcomes: ["Install a custom indicator in the right folder.", "Add it to a chart and change its settings later.", "Reuse the setup with a template."],
  steps: [
    { title: "Open the data folder", text: ["In MT5, choose **File → Open Data Folder**, then open `MQL5` → `Indicators`."] },
    { title: "Copy the indicator file", text: ["Paste the `.ex5` file into `Indicators` (a sub-folder per product is fine)."] },
    { title: "Refresh the Navigator", text: ["Open the **Navigator** (Ctrl+N), right-click **Indicators** and choose **Refresh**."] },
    {
      title: "Add it to a chart",
      text: ["Drag the indicator from the Navigator onto a chart, or double-click it. It can also be found under **Insert → Indicators → Custom**."],
    },
    {
      title: "Set its inputs and colours",
      text: [
        "Use the **Inputs** tab for its parameters and the **Colors** tab for its appearance, then click **OK**. Some indicators draw on the price chart; others open their own window beneath it.",
      ],
    },
    {
      title: "Edit it later",
      text: ["Right-click the chart and open **Indicators List** (Ctrl+I), select the indicator and choose **Properties** to change its settings or **Delete** to remove it."],
    },
    {
      title: "Save the chart as a template",
      text: ["Right-click the chart and choose **Templates → Save Template**. Applying that template to another chart adds the same indicators with the same settings."],
    },
  ],
  expectedResult: "The indicator is drawn on your chart (or in a sub-window), appears in the chart's Indicators List, and can be re-applied to any chart from your saved template.",
  troubleshooting: [
    { problem: "The indicator doesn't appear in the Navigator", fix: "It must be an `.ex5` in `MQL5\\Indicators` of the data folder. Refresh the Navigator or restart MT5." },
    { problem: "It's on the chart but shows nothing", fix: "Check the Experts tab (Ctrl+T) for errors, and scroll back — some indicators need a minimum number of bars, so open a chart with more history." },
    { problem: "Historical signals look perfect but live ones don't", fix: "Some indicators recalculate past values (repaint). Watch it live for a while before relying on its history." },
  ],
  related: ["install-indicator-mt4", "install-ea-mt5", "compare-mt4-mt5-tools"],
  guides: ["what-is-a-forex-expert-advisor"],
  next: "install-indicator-mt4",
  links: [{ label: "MT5 indicators", href: "/marketplace?platform=MT5&type=INDICATOR" }],
  riskDisclaimer: false,
};

export const installIndicatorMt4: Tutorial = {
  slug: "install-indicator-mt4",
  title: "How to Install a Custom Indicator in MT4",
  seoTitle: "How to Install a Custom Indicator in MetaTrader 4 — Tutorial",
  description:
    "Install a custom indicator in MetaTrader 4: copy the .ex4 to MQL4\\Indicators, refresh the Navigator, add it to a chart and edit its inputs.",
  category: "indicators",
  difficulty: "beginner",
  estimatedMinutes: 10,
  published: "2026-10-14",
  updated: "2026-10-14",
  intro: "Add a custom indicator to MetaTrader 4, adjust its inputs and colours, and keep the setup in a reusable template.",
  requirements: [
    "MetaTrader 4 installed — see [How to Install MetaTrader 4](/tutorials/install-metatrader-4).",
    "The indicator's MT4 file (`.ex4`, sometimes with `.mq4` source). Extract `.zip` downloads first.",
  ],
  outcomes: ["Install the indicator in `MQL4\\Indicators`.", "Add it to a chart and edit its settings.", "Save the chart as a template."],
  steps: [
    { title: "Open the data folder", text: ["In MT4, go to **File → Open Data Folder**, then open `MQL4` → `Indicators`."] },
    { title: "Copy the indicator file", text: ["Paste the `.ex4` file (and `.mq4`, if provided) into `Indicators`."] },
    { title: "Refresh the Navigator", text: ["Open the **Navigator** (Ctrl+N), right-click **Indicators** and choose **Refresh**, or restart MT4."] },
    {
      title: "Add it to a chart",
      text: ["Drag it from the Navigator's **Indicators** list onto a chart, or use **Insert → Indicators → Custom**."],
    },
    { title: "Set its inputs and colours", text: ["Adjust the **Inputs** and **Colors** tabs, then click **OK**."] },
    {
      title: "Edit it later",
      text: ["Right-click the chart, open **Indicators List** (Ctrl+I), select the indicator and choose **Edit** — or **Delete** to remove it."],
    },
    { title: "Save a template", text: ["Right-click the chart and choose **Template → Save Template** to reuse this setup on other charts."] },
  ],
  expectedResult: "The indicator draws on the chart or in its own sub-window, is listed in the chart's Indicators List, and your template re-applies it with the same settings.",
  troubleshooting: [
    { problem: "It isn't in the Navigator", fix: "Check it's an `.ex4` (not `.ex5`) in `MQL4\\Indicators` of the data folder, then refresh." },
    { problem: "\"DLL calls are not allowed\" in the Experts tab", fix: "Some indicators use DLLs. Enable **Allow DLL imports** on the indicator's **Common** tab only if you trust its developer." },
    { problem: "The indicator is slow or freezes the chart", fix: "Reduce its history/bars input if it has one, or ask the developer — heavy calculations on every tick can slow MT4." },
  ],
  related: ["install-indicator-mt5", "install-ea-mt4", "read-mt4-experts-journal-logs"],
  guides: ["what-is-a-forex-expert-advisor"],
  next: "configure-ea-settings",
  links: [{ label: "MT4 indicators", href: "/marketplace?platform=MT4&type=INDICATOR" }],
  riskDisclaimer: false,
};
