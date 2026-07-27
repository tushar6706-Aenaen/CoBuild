/**
 * Resolves a stored Storage path to its public object URL.
 *
 * `packages/shared`'s `publicStorageUrl` needs a Supabase client to do the
 * same job. In a Server Component that means constructing a cookie-reading
 * client purely to string-concatenate a URL — the exact per-tile cost that
 * had to be removed from `ProjectTileCard` in Phase 2. The bucket layout is
 * a stable public contract, so building the URL from the project URL is both
 * cheaper and honest about what it is.
 *
 * The returned URL still has to go through `transformedStorageUrl()` before
 * it reaches an `<Image>` — see PROJECT_INFO.md's gotchas.
 */
export function storageUrl(path: string | null, bucket: "avatars" | "project-media") {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
