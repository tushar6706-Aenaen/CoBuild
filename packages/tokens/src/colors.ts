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
 * Nothing in the UI chrome is blue-tinted any more: `linkHover` was a lavender
 * `#D3C6FF` and `status.archived` a Slate `#94A3B8`; both are now in the
 * green/neutral family. `status.shipped` stays cyan — it is a semantic badge
 * from the design file, and the one place a cool hue earns its keep by not
 * colliding with the accent green.
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
  bg: {
    page: "#090A09",
    panel: "#0F110F",
    panelAlt: "#121412",
    input: "#111311",
    raised: "#181B18",
    // The one surface deliberately lighter than the page, so the left rail
    // reads as a distinct plane rather than a hole in it.
    sidebar: "#0C0E0C",
  },
  /** Space-separated channels for `rgb(... / alpha)` scrims. Keep in sync with `bg`. */
  bgRgb: {
    page: "9 10 9",
    panel: "15 17 15",
  },
  border: {
    default: "rgba(255,255,255,0.12)",
    subtle: "rgba(255,255,255,0.08)",
    strong: "rgba(255,255,255,0.22)",
  },
  text: {
    primary: "#E8EDE8",
    secondary: "#8B8F8B",
    secondaryAlt: "#949994",
    tertiary: "#6E736E",
    placeholder: "#5A605A",
  },
  accent: {
    DEFAULT: "#3BE38F",
    hover: "#55EAA1",
    onAccent: "#04180E",
    muted: "#8DEEBB",
    mutedStrong: "#A5F2C9",
  },
  linkHover: "#A5F2C9",
  status: {
    shipped: "#6FD2E8",
    inProgress: "#F5B950",
    archived: "#6E736E",
    danger: "#FF7A7A",
    dangerStrong: "#FF9B9B",
  },
  code: {
    highlight: "#DCE86A",
  },
} as const;
