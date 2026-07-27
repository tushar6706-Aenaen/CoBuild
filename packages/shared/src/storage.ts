import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

/**
 * Resolves a stored path (from `profiles.avatar_url`, `projects.cover_image_path`,
 * or `project_images.storage_path`) to a public URL. These columns hold paths,
 * not URLs — see PROJECT_INFO.md's "Known gotchas" — so every render site must
 * go through this, never use the raw column value as an `<img src>`/`next/image`
 * `src` directly.
 */
export function publicStorageUrl(
  client: Client,
  bucket: "avatars" | "project-media",
  path: string | null,
): string | null {
  if (!path) return null;
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export type TransformFit = "contain" | "cover";

/**
 * Builds a Supabase image-transform URL from a public object URL.
 *
 * IMPORTANT — verified live against the actual API: passing only `width`
 * does NOT preserve aspect ratio (default resize mode is `cover`, so height
 * silently stays at the source's original height — a 1200×800 image
 * requested at `width=640` comes back 640×800, visibly squashed). Always
 * pass `fit`:
 *   - `"contain"` for anything shown at its natural aspect ratio (feed
 *     covers, gallery, lightbox) — this is almost always what you want.
 *   - `"cover"` only for a forced square/fixed-box crop (avatars), and only
 *     with both `width` AND `height` set.
 *
 * next/image must be told `unoptimized` for any URL built here — its default
 * loader appends its own `?w=&q=` query params, which Supabase's transform
 * endpoint does not understand, silently serving an untransformed image.
 */
export function transformedStorageUrl(
  publicUrl: string,
  opts: { width: number; height?: number; fit?: TransformFit; quality?: number },
): string {
  const transformPath = publicUrl.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );
  const params = new URLSearchParams();
  params.set("width", String(Math.round(opts.width)));
  if (opts.height) params.set("height", String(Math.round(opts.height)));
  params.set("resize", opts.fit ?? "contain");
  params.set("quality", String(opts.quality ?? 75));
  return `${transformPath}?${params.toString()}`;
}

/** Recommended widths per surface, from live measurement against the transform API. */
export const IMAGE_SIZES = {
  feedCard: [640, 960, 1400],
  gallery: [1080, 1440, 2000],
  avatarSquare: [64, 96, 192],
} as const;
