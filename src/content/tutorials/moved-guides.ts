/**
 * Procedural guides that moved to /tutorials: old /guides/<key> → /tutorials/<value>.
 * next.config.ts 308-redirects each one, so keep this file dependency-free (it's
 * imported by the Next config, not just by app code). Never remove an entry — external
 * links and search results may still point at the old URL.
 */
export const MOVED_FROM_GUIDES: Record<string, string> = {
  "how-to-install-metatrader-4": "install-metatrader-4",
  "how-to-install-metatrader-5": "install-metatrader-5",
  "how-to-install-an-ea-in-mt4": "install-ea-mt4",
  "how-to-install-an-ea-in-mt5": "install-ea-mt5",
  "how-to-install-a-forex-indicator": "install-indicator-mt5",
  "how-to-backtest-an-expert-advisor": "backtest-ea-mt5",
  "how-to-buy-and-download-on-fxbothub": "find-trading-tools-fxbothub",
};
