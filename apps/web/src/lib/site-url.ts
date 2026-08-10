/**
 * The app's own public origin.
 *
 * Needed because `og:image` and `twitter:image` must be absolute URLs — a
 * crawler has no page context to resolve `/p/foo/bar/opengraph-image` against.
 * Next resolves file-convention metadata images against `metadataBase`, and
 * without one it falls back to `localhost:3000` and silently ships link
 * previews that nothing outside this machine can fetch.
 *
 * `NEXT_PUBLIC_SITE_URL` is the explicit answer; `VERCEL_PROJECT_PRODUCTION_URL`
 * covers a Vercel deploy that hasn't set it (deliberately the *production* host
 * rather than `VERCEL_URL`, which is the per-deployment URL and would pin
 * previews to a build that later gets superseded).
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);

  return new URL("http://localhost:3000");
}
