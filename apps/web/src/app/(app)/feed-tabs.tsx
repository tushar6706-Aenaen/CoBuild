import Link from "next/link";

export const FEED_TABS = [
  { key: "hot", label: "Hot" },
  { key: "new", label: "New" },
  { key: "top", label: "Top" },
  { key: "following", label: "Following" },
] as const;

export const TOP_WINDOWS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
] as const;

const pill = "rounded-[5px] px-3.5 py-2 text-[13px] font-semibold transition-colors";
const active = `${pill} bg-[var(--color-accent)] text-[var(--color-accent-on)]`;
const inactive = `${pill} text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`;

export function FeedTabs({ tab, window }: { tab: string; window: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-fit max-w-full gap-1.5 overflow-auto rounded-[7px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-1.5">
        {FEED_TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "hot" ? "/" : `/?tab=${t.key}`}
            className={t.key === tab ? active : inactive}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "top" && (
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--color-text-tertiary)]">
            WINDOW
          </span>
          <div className="flex flex-wrap gap-1.5">
            {TOP_WINDOWS.map((w) => (
              <Link
                key={w.key}
                href={`/?tab=top&window=${w.key}`}
                className={
                  w.key === window
                    ? "rounded-[5px] border border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12 px-2.5 py-1.5 text-xs font-semibold text-[var(--color-accent-muted)]"
                    : "rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }
              >
                {w.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
