import Link from "next/link";
import type { ProjectStatus, TagHit } from "@cobuild/shared";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  shipped: "Shipped",
  in_progress: "In progress",
  archived: "Archived",
};

const chip = "rounded-[5px] border px-2.5 py-1.5 text-xs font-semibold transition-colors";
const on = `${chip} border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12 text-[var(--color-accent-muted)]`;
const off = `${chip} border-[var(--color-border-default)] bg-[var(--color-bg-panel)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`;

/**
 * Builds the URL for toggling one facet value, preserving every other param.
 * Plain links rather than client-side state so the filter row costs no JS and
 * every filtered view is a real, shareable URL.
 */
function toggleHref(
  base: { q: string; statuses: readonly string[]; tags: readonly string[] },
  key: "status" | "tag",
  value: string,
) {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);

  const current = key === "status" ? base.statuses : base.tags;
  const other = key === "status" ? base.tags : base.statuses;
  const otherKey = key === "status" ? "tag" : "status";

  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];

  for (const v of next) params.append(key, v);
  for (const v of other) params.append(otherKey, v);

  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/**
 * Status facets plus the most-used tags, per `scSearch`'s FILTER row.
 *
 * The tag chips come from the tag directory rather than from the current
 * result set, so the row does not reshuffle under the cursor as the query
 * changes — and so a facet you have already selected never disappears.
 */
export function SearchFilters({
  q,
  statuses,
  tags,
  tagOptions,
}: {
  q: string;
  statuses: readonly ProjectStatus[];
  tags: readonly string[];
  tagOptions: TagHit[];
}) {
  const base = { q, statuses, tags };
  const selectedMissing = tags.filter((t) => !tagOptions.some((o) => o.slug === t));
  const options: TagHit[] = [
    ...tagOptions,
    ...selectedMissing.map((slug) => ({ slug, name: slug, usage_count: 0 })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--color-text-tertiary)]">
        FILTER
      </span>

      {options.map((t) => (
        <Link
          key={`tag-${t.slug}`}
          href={toggleHref(base, "tag", t.slug)}
          aria-pressed={tags.includes(t.slug)}
          className={tags.includes(t.slug) ? on : off}
        >
          {t.name}
        </Link>
      ))}

      {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
        <Link
          key={`status-${s}`}
          href={toggleHref(base, "status", s)}
          aria-pressed={statuses.includes(s)}
          className={statuses.includes(s) ? on : off}
        >
          {STATUS_LABELS[s]}
        </Link>
      ))}

      {(statuses.length > 0 || tags.length > 0) && (
        <Link
          href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}
          className="px-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
