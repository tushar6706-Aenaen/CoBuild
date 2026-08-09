/**
 * Class strings for the two small control shapes that recur across the app's
 * filter/tab rows.
 *
 * Both were previously declared as byte-identical local `const`s in five
 * files (`pill` in feed-tabs, board-controls and tag-tabs; `chip` in
 * board-controls and search-filters). They are the same control in each
 * place, so they drift as a set or not at all — a padding tweak applied to
 * three of five is the failure this prevents.
 *
 * These carry shape and type only. The active/inactive colours stay at the
 * call site, because each row expresses selection differently (the feed's
 * tabs fill with the accent, the search facets tint a border).
 */

/** Tab-row pill: feed tabs, leaderboard window switch, tag-page tabs. */
export const pill = "rounded-[var(--radius-pill)] px-3.5 py-2 text-[13px] font-semibold transition-colors";

/** Smaller bordered facet chip: leaderboard scope, search filters. */
export const chip = "rounded-[var(--radius-pill)] border px-2.5 py-1.5 text-xs font-semibold transition-colors";
