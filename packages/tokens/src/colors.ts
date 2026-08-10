/**
 * Base palette from `CoBuild design system/CoBuild.dc.html`, restored from a
 * reference render (`colotheme/colortheme.png`) after a detour through the
 * Tailwind Slate scale.
 *
 * The Slate neutrals were adopted to solve two real problems — surfaces that
 * sat only 3-6 RGB points apart, and text tiers too close in brightness to
 * read as a hierarchy — but they carried a blue cast the product doesn't want.
 * The values below are the sampled originals, matched deliberately and
 * exactly: page/panel/panelAlt are close together on purpose, and cards are
 * separated from the page by their border (a measured
 * `rgba(255,255,255,0.12)`, which is why borders did NOT move) rather than by
 * a brightness step. If elevation ever needs to read more strongly, widen the
 * gaps here — do not reach back for a blue-grey.
 *
 * The chrome now carries no hue at all — see the `accent` note below. The
 * only chroma left in the palette is semantic: `status.shipped` (cyan),
 * `status.inProgress` (amber), `status.danger` (red) and `code.highlight`.
 * Those earn their colour by meaning something; nothing else does.
 *
 * `*Rgb` entries are the same colours as space-separated channels, for
 * composing translucent scrims (`rgb(var(--color-bg-page-rgb)/0.72)`) over
 * imagery. Every such overlay used to hardcode the page colour, so each
 * palette change silently left a handful of stale blue-black scrims behind.
 *
 * Single source of truth — web (Tailwind 4 @theme) and mobile (NativeWind
 * tailwind.config) both map their color scale from this file. Do not
 * hand-edit hex values in either app's Tailwind config directly.
 */
export const colors = {
  // Surfaces are TRUE NEUTRAL. They used to carry a slight green tint (`#090A09`
  // is R9 G10 B9, growing to +3 at `raised`), which was coherent when the accent
  // green was everywhere. It stopped being coherent once green was cut back to
  // one action per screen: a tinted grey competes with the single saturated
  // element instead of setting it off. Neutral greys are what make the green
  // land. Do not reintroduce a tint here without revisiting that decision.
  bg: {
    page: "#0A0A0A",
    panel: "#0A0A0A",
    panelAlt: "#121212",
    input: "#111111",
    raised: "#1A1A1A",
    // The one surface deliberately lighter than the page, so the left rail
    // reads as a distinct plane rather than a hole in it.
    sidebar: "#0C0C0C",
    /** Translucent fill for inner rows (nav items, tag rows, list rows). */
    rowTint: "rgba(255,255,255,0.03)",
  },
  /** Space-separated channels for `rgb(... / alpha)` scrims. Keep in sync with `bg`. */
  bgRgb: {
    page: "10 10 10",
    panel: "10 10 10",
  },
  /**
   * Near-white control fill. This is the emphasis colour for anything that is
   * *selected* rather than *primary*: active tabs, active filter chips, toggled
   * states, secondary CTAs. Emphasis comes from lightness, not saturation —
   * which is what leaves the accent green free to mean "the one action here".
   * 15.83:1 at worst.
   */
  control: {
    primary: "#F4F4F5",
    onPrimary: "#18181B",
  },
  /** `accent` as bare channels. Kept for translucent accent tints. */
  accentRgb: "244 244 245",
  border: {
    default: "rgba(255,255,255,0.12)",
    subtle: "rgba(255,255,255,0.08)",
    strong: "rgba(255,255,255,0.22)",
  },
  // Ratios below are the MINIMUM across all six surfaces. `bg.raised` is the
  // lightest and therefore the binding one — every tier here was re-measured
  // when the surfaces went neutral, because neutralising made `raised` lighter
  // (#181B18 -> #1A1A1A) and moved the bar.
  text: {
    primary: "#EDEDED", // 14.87:1
    secondary: "#8C8C8C", // 5.18:1
    secondaryAlt: "#949494", // 5.74:1
    // 4.53:1 — the lowest neutral grey that clears AA on all six surfaces.
    // `#808080` is the intuitive choice and FAILS at 4.41:1 on `raised`. That is
    // the second eyeballed grey to fail on this palette (the first was #6E736E,
    // at 3.59:1). Measure any replacement against `bg.raised`; do not assume.
    tertiary: "#828282",
    // 2.69:1 at worst — deliberately below AA and therefore ONLY legitimate for
    // genuine `::placeholder` text, which WCAG exempts. Never use it for real
    // content; reach for `tertiary` instead.
    placeholder: "#5A5A5A",
  },
  /**
   * There is no brand hue any more. This palette is monochrome: emphasis comes
   * from lightness alone, so `accent` is a near-white and every ratio below is
   * measured against the six surfaces.
   *
   * The green (`#3BE38F`) is gone deliberately — not softened, removed. Do not
   * reintroduce a chroma accent here without revisiting the restyle spec; the
   * whole design depends on nothing in the chrome competing for attention.
   *
   * NOTE: these now duplicate `control.*`, which is the clearer name for the
   * same idea. They are kept as an alias only so 150+ call sites did not have
   * to churn in the same commit that changed the colour. Collapsing `accent.*`
   * into `control.*` is a mechanical follow-up.
   */
  accent: {
    DEFAULT: "#F4F4F5", // 15.83:1
    hover: "#FFFFFF", // 17.40:1
    onAccent: "#18181B", // 16.12:1 against DEFAULT
    muted: "#A1A1A1", // 6.74:1
    mutedStrong: "#D4D4D4", // 11.74:1
  },
  linkHover: "#FFFFFF",
  status: {
    shipped: "#6FD2E8",
    inProgress: "#F5B950",
    // Kept a separate token from `text.tertiary` (a status is not a text tier)
    // but moves with it, and for the same reason: `status.color` is rendered as
    // the chip's small label text, not just its dot, so it carries the text
    // tier's AA requirement.
    archived: "#828282",
    danger: "#FF7A7A",
    dangerStrong: "#FF9B9B",
  },
  code: {
    highlight: "#DCE86A",
  },
} as const;
