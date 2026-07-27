import Link from "next/link";

/**
 * Hot / New / Top — the design's `feedTabs3`. Deliberately no Following tab:
 * "projects by people I follow, that also use this stack" is a different and
 * much narrower query than the one this page exists to answer.
 */
export const TAG_TABS = [
  { key: "hot", label: "Hot" },
  { key: "new", label: "New" },
  { key: "top", label: "Top" },
] as const;

export type TagTab = (typeof TAG_TABS)[number]["key"];

export const TAG_TAB_KEYS = new Set<string>(TAG_TABS.map((t) => t.key));

const pill = "rounded-[5px] px-3.5 py-2 text-[13px] font-semibold transition-colors";

export function TagTabs({ slug, tab }: { slug: string; tab: TagTab }) {
  return (
    <div className="flex w-fit gap-1.5 rounded-[7px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-1.5">
      {TAG_TABS.map((t) => (
        <Link
          key={t.key}
          href={t.key === "hot" ? `/tag/${slug}` : `/tag/${slug}?tab=${t.key}`}
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
  );
}
