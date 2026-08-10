import { getProfileByUsername, transformedStorageUrl } from "@cobuild/shared";
import { colors } from "@cobuild/tokens";
import { storageUrl } from "@/lib/storage-url";
import { createOgClient } from "@/lib/og/client";
import { fetchOgImage } from "@/lib/og/remote-image";

/**
 * A live profile badge for READMEs: `![CoBuild](https://…/badge/tushar.svg)`.
 *
 * This audience's actual homepage is a GitHub README, so a self-updating card
 * there is a permanent inbound link from every repo someone owns.
 *
 * Constraints that shape the whole file:
 *
 * - **Everything must be inlined.** GitHub proxies README images through Camo,
 *   which fetches this SVG from a different origin and strips nothing — but any
 *   `<image href="https://…">` inside it would then be a cross-origin subrequest
 *   the renderer will not make. The avatar is therefore embedded as a data URI.
 * - **No web fonts.** The SVG is rendered by whatever is displaying it, so the
 *   font stack has to be one that exists everywhere. Text width is consequently
 *   unpredictable, which is why every string is truncated to a character budget
 *   rather than measured.
 * - **Every interpolated string is user-controlled** (`display_name` is free
 *   text) and lands inside XML. `escapeXml` is not optional here.
 */

export const revalidate = 300;

const W = 440;
const H = 132;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

const FONT = "-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

function svgResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Camo caches aggressively on its own, so this mostly governs our CDN.
      // Long `stale-while-revalidate` because a slightly stale badge is fine
      // and a slow one is not.
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}

function shell(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">
  <defs>
    <!-- Monochrome, matching the OG cards and the app: near-white fading into
         the raised surface. This ran accent into status cyan while the palette
         had a brand hue; it was the only chroma left on the badge afterwards,
         and a README badge is the most-repeated impression of the product. -->
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.accent.DEFAULT}"/>
      <stop offset="1" stop-color="${colors.bg.raised}"/>
    </linearGradient>
    <clipPath id="avatar"><circle cx="52" cy="66" r="30"/></clipPath>
    <clipPath id="card"><rect x="0" y="0" width="${W}" height="${H}" rx="11"/></clipPath>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="11"
        fill="${colors.bg.panel}" stroke="rgba(255,255,255,0.12)"/>
  <!-- Clipped to the card, or the square-cornered bar overhangs the rounded
       top corners — visible as two bright nicks at 1x in a README. -->
  <rect x="0" y="0" width="${W}" height="4" fill="url(#edge)" clip-path="url(#card)"/>
  ${inner}
</svg>`;
}

function stat(x: number, value: string, label: string, accent = false): string {
  return `<text x="${x}" y="90" font-family="${MONO}" font-size="17" font-weight="500"
        fill="${accent ? colors.accent.DEFAULT : colors.text.primary}">${escapeXml(value)}</text>
  <text x="${x}" y="107" font-family="${FONT}" font-size="11"
        fill="${colors.text.tertiary}">${escapeXml(label)}</text>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username: raw } = await params;
  // `/badge/tushar.svg` reads better in a README than `/badge/tushar`, and the
  // extension is not part of the handle — accept both.
  const username = raw.replace(/\.svg$/i, "");

  const supabase = createOgClient();
  const profile = await getProfileByUsername(supabase, username);

  if (!profile) {
    // Deliberately 200, not 404: an `<img>` pointed at a 404 renders as a
    // broken-image icon, which tells the reader nothing. A badge that says so
    // is better feedback, and this is a display asset, not an API.
    return svgResponse(
      shell(
        `<text x="24" y="72" font-family="${FONT}" font-size="16" font-weight="700"
           fill="${colors.text.secondary}">No CoBuild profile @${escapeXml(clamp(username, 24))}</text>`,
      ),
    );
  }

  const avatar = await fetchOgImage(
    profile.avatar_url
      ? transformedStorageUrl(storageUrl(profile.avatar_url, "avatars")!, {
          width: 120,
          height: 120,
          fit: "cover",
        })
      : null,
  );

  const name = clamp(profile.display_name ?? profile.username ?? "Builder", 20);
  const handle = clamp(`@${profile.username}`, 22);

  const avatarMarkup = avatar
    ? `<image x="22" y="36" width="60" height="60" clip-path="url(#avatar)"
           href="${escapeXml(avatar)}" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="52" cy="66" r="30" fill="${colors.bg.raised}"/>
       <text x="52" y="74" text-anchor="middle" font-family="${MONO}" font-size="26"
             fill="${colors.accent.muted}">${escapeXml((name[0] ?? "?").toUpperCase())}</text>`;

  return svgResponse(
    shell(`
  ${avatarMarkup}
  <circle cx="52" cy="66" r="30" fill="none" stroke="rgba(255,255,255,0.12)"/>

  <text x="98" y="46" font-family="${FONT}" font-size="17" font-weight="700"
        fill="${colors.text.primary}">${escapeXml(name)}</text>
  <text x="98" y="65" font-family="${MONO}" font-size="13"
        fill="${colors.accent.muted}">${escapeXml(handle)}</text>

  ${stat(98, compact(profile.project_count), "projects")}
  ${stat(198, compact(profile.total_upvotes_received), "upvotes", true)}
  ${stat(298, compact(profile.follower_count), "followers")}

  <text x="${W - 20}" y="26" text-anchor="end" font-family="${FONT}" font-size="11"
        font-weight="700" fill="${colors.text.tertiary}">COBUILD</text>`),
  );
}
