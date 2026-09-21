export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

// Single source of truth for the primary nav — header, footer, and mobile
// menu all render from this instead of hard-coding links per component.
export const PRIMARY_NAV: NavGroup[] = [
  {
    label: "Marketplace",
    links: [
      { label: "MT4 EAs", href: "/marketplace?platform=MT4&type=EA" },
      { label: "MT5 EAs", href: "/marketplace?platform=MT5&type=EA" },
      { label: "MT4 Indicators", href: "/marketplace?platform=MT4&type=INDICATOR" },
      { label: "MT5 Indicators", href: "/marketplace?platform=MT5&type=INDICATOR" },
      { label: "Signal Tools", href: "/marketplace?type=SIGNAL" },
      { label: "Popular", href: "/marketplace?sort=popular" },
      { label: "New Releases", href: "/marketplace?sort=newest" },
      { label: "Top Rated", href: "/marketplace?sort=rating" },
      { label: "Best Sellers", href: "/marketplace?sort=best_sellers" },
      { label: "Free Products", href: "/marketplace?pricingType=FREE" },
      { label: "Featured Products", href: "/marketplace?featured=true" },
    ],
  },
  {
    label: "Market Intelligence",
    links: [
      { label: "Dashboard", href: "/intelligence" },
      { label: "News Calendar", href: "/calendar" },
      { label: "News Articles", href: "/news" },
      { label: "Forex Signals", href: "/signals" },
      { label: "Market Analysis", href: "/analysis" },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Guides", href: "/resources/guides" },
      { label: "Tutorials", href: "/resources/tutorials" },
      { label: "Developer Resources", href: "/resources/developers" },
    ],
  },
];

export const COMMUNITY_HREF = "/community";

// Stand-alone links shown directly in the header menu bar (desktop bar and mobile
// menu), in addition to the dropdown groups above. `after` is the label of the
// PRIMARY_NAV group the link sits right behind. Kept out of PRIMARY_NAV itself
// because the footer renders one column per group.
export interface MenuBarLink extends NavLink {
  after: string;
}

export const MENU_BAR_LINKS: MenuBarLink[] = [{ label: "News Calendar", href: "/calendar", after: "Market Intelligence" }];
