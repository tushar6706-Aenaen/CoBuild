import Link from "next/link";
import {
  LOOKING_FOR_OPTIONS,
  LOOKING_FOR_LABELS,
  type ProjectStatus,
  type TagHit,
} from "@cobuild/shared";
import { chipActive, chipInactive, microLabel } from "@/components/ui/control-classes";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  shipped: "Shipped",
  in_progress: "In progress",
  archived: "Archived",
};

const on = chipActive;
const off = chipInactive;

type SearchFacetKey = "status" | "tag" | "looking_for";

type SearchBase = {
  q: string;
  statuses: readonly string[];
  tags: readonly string[];
  lookingFor: readonly string[];
};

/**
 * Builds the URL for toggling one facet value, preserving every other param.
 * Plain links rather than client-side state so the filter row costs no JS and
 * every filtered view is a real, shareable URL.
 */
function toggleHref(base: SearchBase, key: SearchFacetKey, value: string) {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);

  const facets: Record<SearchFacetKey, readonly string[]> = {
    status: base.statuses,
    tag: base.tags,
    looking_for: base.lookingFor,
  };

  for (const paramKey of Object.keys(facets) as SearchFacetKey[]) {
    const values = facets[paramKey];
    const next =
      paramKey === key
        ? values.includes(value)
          ? values.filter((v) => v !== value)
          : [...values, value]
        : values;
    for (const v of next) params.append(paramKey, v);
  }

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
  lookingFor,
  tagOptions,
}: {
  q: string;
  statuses: readonly ProjectStatus[];
  tags: readonly string[];
  lookingFor: readonly string[];
  tagOptions: TagHit[];
}) {
  const base: SearchBase = { q, statuses, tags, lookingFor };
  const selectedMissing = tags.filter((t) => !tagOptions.some((o) => o.slug === t));
  const options: TagHit[] = [
    ...tagOptions,
    ...selectedMissing.map((slug) => ({ slug, name: slug, usage_count: 0 })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={microLabel}>
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

      {LOOKING_FOR_OPTIONS.map((v) => (
        <Link
          key={`looking-for-${v}`}
          href={toggleHref(base, "looking_for", v)}
          aria-pressed={lookingFor.includes(v)}
          className={lookingFor.includes(v) ? on : off}
        >
          {LOOKING_FOR_LABELS[v]}
        </Link>
      ))}

      {(statuses.length > 0 || tags.length > 0 || lookingFor.length > 0) && (
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
