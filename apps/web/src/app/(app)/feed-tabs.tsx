import Link from "next/link";
import { LOOKING_FOR_OPTIONS, LOOKING_FOR_LABELS } from "@cobuild/shared";
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

/**
 * Builds a feed URL from scratch — tab, window, and the `looking_for` facet
 * — rather than patching whatever the current URL happens to carry. There is
 * no `?cursor=` in this app (pagination lives in `FeedLoadMore`'s client
 * state, never the URL), but building fresh like this is what guarantees
 * that stays true: a param this function doesn't know about can never leak
 * through onto a filtered link.
 */
function feedHref({
  tab,
  window,
  lookingFor,
}: {
  tab: string;
  window: string;
  lookingFor: readonly string[];
}) {
  const params = new URLSearchParams();
  if (tab !== "hot") params.set("tab", tab);
  if (tab === "top") params.set("window", window);
  for (const v of lookingFor) params.append("looking_for", v);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function FeedTabs({
  tab,
  window,
  lookingFor,
}: {
  tab: string;
  window: string;
  lookingFor: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-fit max-w-full gap-1.5 overflow-auto rounded-[var(--radius-control-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-1.5">
        {FEED_TABS.map((t) => (
          <Link
            key={t.key}
            href={feedHref({ tab: t.key, window, lookingFor })}
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
                href={feedHref({ tab: "top", window: w.key, lookingFor })}
                className={w.key === window ? chipActive : chipInactive}
              >
                {w.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <span className={microLabel}>LOOKING FOR</span>
        <div className="flex flex-wrap gap-1.5">
          {LOOKING_FOR_OPTIONS.map((option) => {
            const isActive = lookingFor.includes(option);
            const next = isActive
              ? lookingFor.filter((v) => v !== option)
              : [...lookingFor, option];
            return (
              <Link
                key={option}
                href={feedHref({ tab, window, lookingFor: next })}
                aria-pressed={isActive}
                className={isActive ? chipActive : chipInactive}
              >
                {LOOKING_FOR_LABELS[option]}
              </Link>
            );
          })}
          {lookingFor.length > 0 && (
            <Link
              href={feedHref({ tab, window, lookingFor: [] })}
              className="px-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              Clear
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
