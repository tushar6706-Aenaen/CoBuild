import Link from "next/link";
import type { LeaderboardWindow } from "@cobuild/shared";
import { pill, chip } from "@/components/ui/control-classes";

export const BOARD_TABS = [
  { key: "projects", label: "Top projects" },
  { key: "builders", label: "Top builders" },
] as const;

export type BoardTab = (typeof BOARD_TABS)[number]["key"];

export const BOARD_WINDOWS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
] as const;


function href(tab: BoardTab, window: LeaderboardWindow) {
  const params = new URLSearchParams();
  if (tab !== "projects") params.set("tab", tab);
  if (window !== "week") params.set("window", window);
  const qs = params.toString();
  return qs ? `/leaderboard?${qs}` : "/leaderboard";
}

/** Tab group + window selector for `/leaderboard` (scBoard). */
export function BoardControls({ tab, window }: { tab: BoardTab; window: LeaderboardWindow }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1.5 rounded-[var(--radius-control-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-1.5">
        {BOARD_TABS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key, window)}
            aria-current={t.key === tab ? "page" : undefined}
            className={
              t.key === tab
                ? `${pill} bg-[var(--color-accent)] text-[var(--color-accent-on)]`
                : `${pill} text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex-1" />

      <div className="flex gap-1.5">
        {BOARD_WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={href(tab, w.key)}
            aria-current={w.key === window ? "page" : undefined}
            className={
              w.key === window
                ? `${chip} border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12 text-[var(--color-accent-muted)]`
                : `${chip} border-[var(--color-border-default)] bg-[var(--color-bg-panel)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`
            }
          >
            {w.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
