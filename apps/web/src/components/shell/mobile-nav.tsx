"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./nav-items";

/**
 * Fixed bottom bar below `lg`. The 48px min-height per item is from the
 * design and is also the sane minimum tap target.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-border-subtle)] bg-[rgb(var(--color-bg-page-rgb)/0.94)] backdrop-blur-[14px] lg:hidden">
      {items.map((item) => {
        const active = item.matchPrefix
          ? pathname === item.href || pathname.startsWith(`${item.href}/`)
          : pathname === item.href;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={
              active
                ? "flex min-h-12 flex-1 flex-col items-center gap-1 py-1.5 text-[10.5px] font-semibold text-[var(--color-accent-muted)]"
                : "flex min-h-12 flex-1 flex-col items-center gap-1 py-1.5 text-[10.5px] font-semibold text-[var(--color-text-tertiary)]"
            }
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
