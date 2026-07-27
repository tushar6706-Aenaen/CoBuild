import type { ReactNode } from "react";

/**
 * Nav definition shared by the desktop sidebar and the mobile bottom bar.
 * Icons and ordering come straight from `CoBuild.dc.html` (ICONS + the `nav`
 * array in its render function) — keep them in sync with that file.
 */
export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  /** Match `href` and everything nested under it for the active state. */
  matchPrefix?: boolean;
};

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconHome = (
  <svg width="17" height="17" viewBox="0 0 24 24" {...s} aria-hidden="true">
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9" />
  </svg>
);

export const IconSearch = (
  <svg width="17" height="17" viewBox="0 0 24 24" {...s} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </svg>
);

export const IconBoard = (
  <svg width="17" height="17" viewBox="0 0 24 24" {...s} aria-hidden="true">
    <path d="M5 20V11M12 20V5M19 20v-6" />
  </svg>
);

export const IconBell = (
  <svg width="17" height="17" viewBox="0 0 24 24" {...s} aria-hidden="true">
    <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M13.7 21a2 2 0 01-3.4 0" />
  </svg>
);

export const IconBookmark = (
  <svg width="17" height="17" viewBox="0 0 24 24" {...s} aria-hidden="true">
    <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />
  </svg>
);

export const IconUser = (
  <svg width="17" height="17" viewBox="0 0 24 24" {...s} aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20a7.5 7.5 0 0115 0" />
  </svg>
);

export const IconPlus = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * Desktop sidebar nav. `profileHref` is null when signed out.
 *
 * `/bookmarks` is a real standalone page (`scBookmarks` in the design),
 * distinct from the "Bookmarks" tab on your own profile — both read
 * `getProfileBookmarks`, which is always scoped to the signed-in caller.
 *
 * Signed out, the personal destinations (Notifications, Bookmarks) are
 * dropped rather than shown-and-gated. Both would bounce straight to
 * `/login`, and a nav item that only ever refuses is worse than no nav item —
 * it advertises a dead end. Home / Explore / Leaderboard all read fine
 * logged-out, so those stay. The design file's nav is static because its
 * mockup is always "signed in"; this is the signed-out branch it implies.
 */
export function sidebarNav(profileHref: string | null, signedIn = true): NavItem[] {
  const items: NavItem[] = [
    { key: "feed", label: "Home", href: "/", icon: IconHome },
    { key: "search", label: "Explore", href: "/search", icon: IconSearch, matchPrefix: true },
    { key: "board", label: "Leaderboard", href: "/leaderboard", icon: IconBoard, matchPrefix: true },
  ];

  if (signedIn) {
    items.push(
      { key: "notifs", label: "Notifications", href: "/notifications", icon: IconBell, matchPrefix: true },
      { key: "bookmarks", label: "Bookmarks", href: "/bookmarks", icon: IconBookmark, matchPrefix: true },
      { key: "profile", label: "Profile", href: profileHref ?? "/login", icon: IconUser, matchPrefix: true },
    );
  }

  return items;
}

/**
 * Mobile bottom bar — a 5-item subset with Post promoted to the centre.
 *
 * Signed out this drops to three, and "You" becomes an explicit "Sign in"
 * rather than a Profile link that redirects. The bar stretches its items to
 * fill the width, so a shorter list stays balanced without a layout change.
 */
export function mobileNav(profileHref: string | null, signedIn = true): NavItem[] {
  if (!signedIn) {
    return [
      { key: "feed", label: "Home", href: "/", icon: IconHome },
      { key: "search", label: "Explore", href: "/search", icon: IconSearch, matchPrefix: true },
      { key: "signin", label: "Sign in", href: "/login", icon: IconUser, matchPrefix: true },
    ];
  }

  return [
    { key: "feed", label: "Home", href: "/", icon: IconHome },
    { key: "search", label: "Explore", href: "/search", icon: IconSearch, matchPrefix: true },
    { key: "create", label: "Post", href: "/new", icon: IconPlus, matchPrefix: true },
    { key: "notifs", label: "Alerts", href: "/notifications", icon: IconBell, matchPrefix: true },
    { key: "profile", label: "You", href: profileHref ?? "/login", icon: IconUser, matchPrefix: true },
  ];
}
