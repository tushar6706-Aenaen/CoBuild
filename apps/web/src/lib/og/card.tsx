import { OG } from "./theme";

/**
 * Shared chrome for the OG cards.
 *
 * These live outside the `opengraph-image.tsx` route files on purpose: those
 * are metadata Route Handlers with a fixed export contract (`alt`, `size`,
 * `contentType`, the default export, plus route segment config), so component
 * helpers don't belong in them.
 *
 * Everything here is satori-safe — flexbox only, no CSS variables, no
 * `color-mix()`, explicit `display: flex` on every element with more than one
 * child (satori errors on a multi-child div without it).
 */

export function Wordmark({ scale = 1 }: { scale?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 * scale }}>
      <div
        style={{
          display: "flex",
          width: 26 * scale,
          height: 26 * scale,
          borderRadius: 7 * scale,
          backgroundColor: OG.accent,
        }}
      />
      <div
        style={{
          display: "flex",
          fontSize: 21 * scale,
          fontWeight: 700,
          letterSpacing: -0.4,
        }}
      >
        CoBuild
      </div>
    </div>
  );
}

/**
 * Avatars are optional everywhere in this product — `profiles.avatar_url` is
 * deliberately left null at signup, even when the OAuth provider supplied one —
 * so the initial-letter placeholder is a first-class state, not an error path.
 */
export function Avatar({
  src,
  fallback,
  size,
}: {
  src: string | null;
  fallback: string;
  size: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 999, border: `1px solid ${OG.border}` }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        border: `1px solid ${OG.border}`,
        backgroundColor: OG.raised,
        color: OG.accentMuted,
        fontFamily: OG.mono,
        fontSize: size * 0.42,
        fontWeight: 500,
      }}
    >
      {(fallback.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

/**
 * The rule every card opens with — the fallback card included, so an unresolved
 * link still reads as ours.
 *
 * Monochrome, like the rest of the palette. This used to run accent green into
 * status cyan, which was the single loudest element on the card and the only
 * chroma left once the app went neutral: a link preview is the first thing
 * anyone sees of CoBuild, so a two-hue band there would have undone the
 * restraint everywhere else. It now fades near-white into the raised surface,
 * which reads as a highlight catching the top edge rather than as a brand bar.
 */
export function AccentStrip() {
  return (
    <div
      style={{
        display: "flex",
        height: 8,
        backgroundImage: `linear-gradient(90deg, ${OG.accent} 0%, ${OG.raised} 100%)`,
      }}
    />
  );
}

export function Stat({
  value,
  label,
  icon,
  color,
}: {
  value: string;
  label?: string;
  icon?: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 16px",
        borderRadius: 999,
        border: `1px solid ${OG.border}`,
        backgroundColor: OG.panel,
        color,
        fontSize: 20,
        fontWeight: 500,
      }}
    >
      {icon}
      {value}
      {label && <div style={{ display: "flex", color: OG.textTertiary }}>{label}</div>}
    </div>
  );
}

export function UpvoteIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
      <path d="M12 4l8 12H4z" />
    </svg>
  );
}

export function CommentIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
      <path d="M4 4h16v12H8l-4 4z" />
    </svg>
  );
}

/**
 * Shown when the target no longer resolves for an anonymous reader. A generic
 * branded card unfurls better than a broken image, and a crawler that got a 500
 * here would not come back to retry.
 */
export function FallbackCard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: OG.bg,
        color: OG.text,
        fontFamily: OG.sans,
      }}
    >
      <AccentStrip />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
        }}
      >
        <Wordmark scale={1.8} />
        <div style={{ display: "flex", fontSize: 30, color: OG.textSecondary }}>
          Post what you&apos;ve built. Get discovered.
        </div>
      </div>
    </div>
  );
}
