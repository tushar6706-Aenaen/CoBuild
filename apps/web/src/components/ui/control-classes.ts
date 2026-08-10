/**
 * The two small control shapes that recur across the app's filter/tab rows,
 * and their selected/unselected treatments.
 *
 * Both shapes were previously declared as byte-identical local `const`s in five
 * files, and each call site then invented its own active/inactive colours. They
 * are the same control in each place, so they drift as a set or not at all.
 *
 * **Selected is near-white, not accent green.** Emphasis here comes from
 * lightness rather than saturation, which is what leaves the green free to mean
 * "the one action on this screen" (see the restyle spec). A tab is a *selected*
 * thing, not a *primary* thing — reaching for the accent here is what made the
 * old UI read loud.
 */

const pillShape =
  "rounded-[var(--radius-pill)] px-3.5 py-1.5 text-[12.5px] leading-5 font-semibold transition-colors";

const chipShape =
  "rounded-[var(--radius-pill)] border px-2.5 py-1 text-[11.5px] leading-[18px] font-semibold transition-colors";

/** Tab-row pill: feed tabs, leaderboard window switch, tag-page tabs. */
export const pill = pillShape;

/** Smaller bordered facet chip: leaderboard scope, search filters. */
export const chip = chipShape;

/** Selected tab. */
export const pillActive = `${pillShape} bg-[var(--color-control-primary)] text-[var(--color-control-on-primary)]`;

/** Unselected tab — a translucent tint, so the row reads as one object. */
export const pillInactive = `${pillShape} text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-row-tint)] hover:text-[var(--color-text-primary)]`;

/** Selected facet chip. */
export const chipActive = `${chipShape} border-transparent bg-[var(--color-control-primary)] text-[var(--color-control-on-primary)]`;

/** Unselected facet chip. */
export const chipInactive = `${chipShape} border-[var(--color-border-default)] bg-[var(--color-bg-row-tint)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]`;

/**
 * Section micro-label — "DISCOVERY", "WINDOW", "TOP BUILDERS".
 *
 * 10px at 3px tracking is a deliberate recipe, not an arbitrary size: at this
 * scale the wide tracking is what makes the label read as a quiet system label
 * rather than as small body text. Do not shrink the tracking without also
 * reconsidering the size.
 */
export const microLabel =
  "text-[10px] font-normal uppercase tracking-[3px] text-[var(--color-text-tertiary)]";
