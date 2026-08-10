import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Fonts for `ImageResponse` (satori), loaded from `apps/web/assets/fonts`.
 *
 * These are deliberately vendored `.ttf` files rather than reused from
 * `next/font/google`: satori needs raw font bytes, and it only parses
 * `ttf`/`otf`/`woff` — `next/font` emits `woff2`, which it cannot read. They
 * also can't be served from `public/`, since satori runs server-side and would
 * have to fetch its own origin to get them.
 *
 * Only the weights the cards actually use are shipped (Jakarta 500/700, Mono
 * 500), because every byte here is loaded per render.
 */
const FONT_DIR = join(process.cwd(), "assets", "fonts");

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal";
};

/**
 * Memoised at module scope: a warm server renders many cards, and re-reading
 * ~240KB of fonts per request is pure waste. The promise (not the value) is
 * cached so concurrent first-renders share one read.
 */
let fontsPromise: Promise<OgFont[]> | null = null;

async function load(file: string): Promise<ArrayBuffer> {
  const buf = await readFile(join(FONT_DIR, file));
  // Copy out of Node's pooled Buffer — `buf.buffer` is a shared allocation and
  // would hand satori the whole pool, not just this file's bytes.
  return Uint8Array.from(buf).buffer;
}

export function ogFonts(): Promise<OgFont[]> {
  fontsPromise ??= (async () => {
    const [sansMedium, sansBold, mono] = await Promise.all([
      load("PlusJakartaSans-Medium.ttf"),
      load("PlusJakartaSans-Bold.ttf"),
      load("JetBrainsMono-Medium.ttf"),
    ]);
    return [
      { name: "Jakarta", data: sansMedium, weight: 500, style: "normal" },
      { name: "Jakarta", data: sansBold, weight: 700, style: "normal" },
      { name: "Mono", data: mono, weight: 500, style: "normal" },
    ];
  })();
  return fontsPromise;
}
