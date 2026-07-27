"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UNREAD_BADGE_CAP } from "@cobuild/shared";
import type { NavItem } from "./nav-items";

function isActive(pathname: string, item: NavItem) {
  if (item.matchPrefix) return pathname === item.href || pathname.startsWith(`${item.href}/`);
  return pathname === item.href;
}

/**
 * Client component purely so the active item can be derived from the current
 * path. Rendered inside the (server) sidebar so the rest of the shell — which
 * needs the session — stays on the server.
 */
export function SidebarNav({ items, unreadCount }: { items: NavItem[]; unreadCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-[3px]">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={
              active
                ? "flex w-full items-center gap-[11px] rounded-[6px] bg-[var(--color-accent)]/[0.14] px-3 py-2.5 text-[13.5px] font-bold text-[var(--color-accent-muted-strong)]"
                : "flex w-full items-center gap-[11px] rounded-[6px] px-3 py-2.5 text-[13.5px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-panel)] hover:text-[var(--color-text-primary)]"
            }
          >
            <span className="flex w-[18px] flex-none items-center justify-center">{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.key === "notifs" && unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread notifications`}
                className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[var(--color-accent)] px-[5px] text-[11px] font-bold text-[var(--color-accent-on)]"
              >
                {/* Capped so a busy inbox can't stretch the pill across the rail. */}
                {unreadCount > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
