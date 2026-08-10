/**
 * Fetches a Supabase-hosted image as raw bytes for embedding in an
 * `ImageResponse`.
 *
 * TWO gotchas are load-bearing here, both verified rather than assumed:
 *
 * 1. **satori decodes only `png` / `apng` / `jpeg` / `gif` / `svg`.** Anything
 *    else throws `Unsupported image type: image/webp` and takes the whole card
 *    down. This app stores WebP by preference (`lib/images/compress.ts` probes
 *    for WebP support and only falls back to JPEG), so the majority of covers
 *    and avatars in Storage are exactly the format satori refuses.
 *
 * 2. **Supabase's `/render/image/` endpoint picks its output format from the
 *    request's `Accept` header**, independent of how the object was stored —
 *    confirmed live against this project: one stored JPEG returns
 *    `Content-Type: image/webp` for `Accept: image/webp` and `image/jpeg` for
 *    `Accept: image/png,image/jpeg`. Asking for a satori-safe format is
 *    therefore enough; no server-side transcode (`sharp`) is needed.
 *
 * `fetch` would otherwise send `Accept: * / *`, and Supabase's default for that
 * is currently JPEG — but that default is not ours to rely on, so the header is
 * explicit. The magic-byte check afterwards is the belt to that suspenders: if
 * Supabase ever changes negotiation, the card silently drops its image instead
 * of returning a 500 to every crawler.
 */

/** Formats satori can actually decode, identified by magic bytes. */
function satoriMimeType(bytes: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG (incl. APNG): 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => bytes[i] === b)) return "image/png";
  // GIF: "GIF8"
  const gif = [0x47, 0x49, 0x46, 0x38];
  if (gif.every((b, i) => bytes[i] === b)) return "image/gif";
  return null;
}

const FETCH_TIMEOUT_MS = 3_000;

/**
 * Returns a `data:` URI ready for an `<img src>` inside `ImageResponse`, or
 * `null` for any failure at all — a link preview without a cover is a weaker
 * card, but a card that 500s is no card, and the crawler will not come back.
 *
 * A data URI rather than the raw `ArrayBuffer` satori also accepts: the format
 * has already been sniffed here, and passing bytes would need a
 * `@ts-expect-error` at every call site (`<img src>` is typed as `string`).
 *
 * Sizing depends on which `fit` the call site asks Supabase for, and the two
 * are NOT interchangeable:
 *
 * - `fit: "cover"` crops to fill both axes, so the returned bytes really are
 *   the requested box and satori's intrinsic-size read is enough. The profile
 *   card's avatar relies on this and sets no width/height.
 * - `fit: "contain"` bounds only the **width** — Supabase ignores the `height`
 *   argument (see PROJECT_INFO.md's gotchas; verified live, a 736×1054 source
 *   asked for 420×460 came back 420×~610). A `contain` call site must compute
 *   the fitted box itself with `fitContain()` and set **both** axes explicitly
 *   on the element, or a portrait image overflows and is clipped. The project
 *   card's cover panel does exactly that.
 *
 * Don't "simplify" a `contain` call site by dropping its explicit width/height
 * — that is the clipped-cover bug Phase 7 already found and fixed.
 */
export async function fetchOgImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: { Accept: "image/png,image/jpeg" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const mime = satoriMimeType(new Uint8Array(buffer.slice(0, 12)));
    if (!mime) return null;

    return `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}
