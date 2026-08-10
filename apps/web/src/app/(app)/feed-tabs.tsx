import Link from "next/link";
import {
  pillActive,
  pillInactive,
  chipActive,
  chipInactive,
  microLabel,
} from "@/components/ui/control-classes";

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

const active = pillActive;
const inactive = pillInactive;

export function FeedTabs({ tab, window }: { tab: string; window: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-fit max-w-full gap-1.5 overflow-auto rounded-[var(--radius-control-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-1.5">
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
          <span className={microLabel}>WINDOW</span>
          <div className="flex flex-wrap gap-1.5">
            {TOP_WINDOWS.map((w) => (
              <Link
                key={w.key}
                href={`/?tab=top&window=${w.key}`}
                className={w.key === window ? chipActive : chipInactive}
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
