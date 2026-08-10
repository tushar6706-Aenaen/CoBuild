import { colors } from "@cobuild/tokens";

/**
 * OG cards read from `@cobuild/tokens` like the rest of the app, so a palette
 * change moves the link previews too.
 *
 * The one place they can't follow the app is CSS variables: satori resolves no
 * `var(--…)`, no `color-mix()`, and no `oklch()`. Every colour below is a
 * literal, and translucency has to be a pre-composed `rgba()` rather than the
 * `rgb(var(--color-bg-page-rgb)/…)` form the app uses for scrims.
 */
export const OG = {
  size: { width: 1200, height: 630 },
  bg: colors.bg.page,
  panel: colors.bg.panel,
  panelAlt: colors.bg.panelAlt,
  raised: colors.bg.raised,
  border: colors.border.default,
  borderSubtle: colors.border.subtle,
  text: colors.text.primary,
  textSecondary: colors.text.secondaryAlt,
  textTertiary: colors.text.tertiary,
  accent: colors.accent.DEFAULT,
  accentMuted: colors.accent.muted,
  status: colors.status,
  sans: "Jakarta",
  mono: "Mono",
} as const;

export const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  shipped: { label: "Shipped", color: colors.status.shipped },
  in_progress: { label: "In progress", color: colors.status.inProgress },
  archived: { label: "Archived", color: colors.status.archived },
};

/**
 * satori has no `-webkit-line-clamp` and no text-overflow ellipsis, so overflow
 * has to be resolved before layout: an untruncated title simply overruns the
 * card and gets clipped mid-glyph. Character budgets are per-card, measured
 * against the font size each one renders at.
 */
export function clamp(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Scales `w`×`h` down to fit inside `box`, preserving aspect ratio.
 *
 * Needed because **Supabase's `resize=contain` does not honour the `height`
 * bound** — verified live: a 736×1073 source requested at `width=420&
 * height=460&resize=contain` came back 420×~610, i.e. fitted to the width and
 * ignoring the height entirely. Trusting the transform to bound both axes let a
 * portrait cover overflow the card and get clipped at the top and bottom.
 *
 * This is a cousin of the gotcha already in PROJECT_INFO.md (passing only
 * `width` silently keeps the source height): the safe rule is that the endpoint
 * bounds *one* axis, so the caller must compute the other and set both
 * explicitly on the element.
 *
 * Never scales up — a small source stays small rather than being blown up soft.
 */
export function fitContain(
  w: number,
  h: number,
  box: { width: number; height: number },
): { width: number; height: number } {
  const scale = Math.min(box.width / w, box.height / h, 1);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** 1_284 → "1.3k". Keeps long counts from reflowing a fixed-width stat row. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}
