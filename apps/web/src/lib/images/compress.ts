/**
 * Client-side image preparation for CoBuild uploads.
 *
 * Images are the whole "demo" of this product, so this module is deliberately
 * conservative and deterministic:
 *
 *   - EXIF orientation is parsed from the file's own bytes and applied by us on
 *     the canvas. We never rely on the browser to rotate for us, because that
 *     behaviour differs across engines and has changed over time. See
 *     `readExifOrientation` below.
 *   - Animated GIFs pass through byte-for-byte. PROJECT_INFO documents GIFs as
 *     the deliberate stand-in for video; re-encoding one through a canvas would
 *     silently flatten it to a single frame.
 *   - The returned `width`/`height` are always the TRUE display dimensions of
 *     the returned `blob`, because `project_images.width/height` is what the
 *     feed uses to reserve aspect-ratio space. A wrong value here is a visible
 *     layout shift.
 */

/** Reject-before-compress ceiling for still images. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Ceiling for animated GIFs. They bypass compression entirely, so what the user
 * picks is what we store and what every viewer downloads — hence a separate,
 * still-tight cap rather than reusing MAX_UPLOAD_BYTES.
 */
export const MAX_ANIMATED_BYTES = 8 * 1024 * 1024;

/** Cap on the long edge, in CSS pixels, after orientation is applied. */
export const MAX_IMAGE_LONG_EDGE = 2000;

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const satisfies readonly string[];

/** Quality for the lossy re-encode. 0.82 is visually clean at feed sizes. */
const ENCODE_QUALITY = 0.82;

export type CompressedImage = {
  blob: Blob;
  /** True post-rotation display width of `blob`. */
  width: number;
  /** True post-rotation display height of `blob`. */
  height: number;
  /** e.g. "image/webp" */
  contentType: string;
  /** e.g. "webp" — no leading dot. */
  extension: string;
};

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function formatMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export function validateImageFile(file: File): ValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, reason: "That file is empty." };
  }
  if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "Use a JPG, PNG, WEBP, GIF, or AVIF image." };
  }

  const limit = file.type === "image/gif" ? MAX_ANIMATED_BYTES : MAX_UPLOAD_BYTES;
  if (file.size > limit) {
    return {
      ok: false,
      reason:
        file.type === "image/gif"
          ? `GIFs can't be compressed, so they must be under ${formatMb(limit)}.`
          : `Images must be under ${formatMb(limit)}.`,
    };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* EXIF                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Read the EXIF Orientation tag (0x0112) out of a JPEG's APP1 segment.
 *
 * Returns 1 (the identity orientation) for anything we can't read: a non-JPEG,
 * a JPEG with no EXIF, a malformed segment, or an out-of-range value. Failing
 * "closed" to 1 is the safe default — the worst case is we leave an image the
 * way the file already stores it, rather than rotating a correct image wrongly.
 *
 * Only JPEG is handled. PNG has no orientation concept; WebP/AVIF can carry an
 * EXIF chunk in theory but no camera pipeline in practice produces a rotated
 * one, and browsers decode them upright.
 */
export function readExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 4) return 1;
  // SOI
  if (view.getUint16(0, false) !== 0xffd8) return 1;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    // Every JPEG marker starts 0xFF. Anything else means we've lost sync.
    if ((marker & 0xff00) !== 0xff00) return 1;
    // SOS — image data begins, no more metadata segments worth scanning.
    if (marker === 0xffda) return 1;

    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2) return 1;

    if (marker === 0xffe1) {
      const exifStart = offset + 4;
      // "Exif\0\0"
      if (
        exifStart + 6 <= view.byteLength &&
        view.getUint32(exifStart, false) === 0x45786966 &&
        view.getUint16(exifStart + 4, false) === 0x0000
      ) {
        const tiff = exifStart + 6;
        if (tiff + 8 > view.byteLength) return 1;

        const endianMark = view.getUint16(tiff, false);
        const little = endianMark === 0x4949; // "II"
        if (!little && endianMark !== 0x4d4d) return 1; // not "MM" either
        if (view.getUint16(tiff + 2, little) !== 0x002a) return 1;

        const ifd0 = tiff + view.getUint32(tiff + 4, little);
        if (ifd0 + 2 > view.byteLength) return 1;

        const entryCount = view.getUint16(ifd0, little);
        for (let i = 0; i < entryCount; i++) {
          const entry = ifd0 + 2 + i * 12;
          if (entry + 12 > view.byteLength) return 1;
          if (view.getUint16(entry, little) === 0x0112) {
            const value = view.getUint16(entry + 8, little);
            return value >= 1 && value <= 8 ? value : 1;
          }
        }
        return 1;
      }
    }

    offset += 2 + segmentLength;
  }

  return 1;
}

/** Orientations 5–8 rotate by 90°, so the display axes are swapped. */
function orientationSwapsAxes(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}

/* -------------------------------------------------------------------------- */
/* GIF                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * True if the GIF has more than one image frame.
 *
 * Walks the GIF block structure properly rather than counting occurrences of
 * the Graphic Control Extension byte pattern — a naive byte scan gets false
 * positives from compressed pixel data that happens to contain 0x21 0xF9.
 */
export function isAnimatedGif(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 13) return false;
  // "GIF8"
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x38) {
    return false;
  }

  const packed = bytes[10];
  let p = 13;
  if (packed & 0x80) {
    // Global colour table: 3 * 2^(N+1) bytes.
    p += 3 * (1 << ((packed & 0x07) + 1));
  }

  let frames = 0;
  while (p < bytes.length) {
    const block = bytes[p];

    if (block === 0x3b) return false; // trailer

    if (block === 0x21) {
      // Extension: label byte, then sub-blocks.
      p += 2;
      while (p < bytes.length && bytes[p] !== 0x00) p += bytes[p] + 1;
      p += 1;
      continue;
    }

    if (block === 0x2c) {
      // Image descriptor.
      frames++;
      if (frames > 1) return true;
      if (p + 10 > bytes.length) return false;
      const localPacked = bytes[p + 9];
      p += 10;
      if (localPacked & 0x80) p += 3 * (1 << ((localPacked & 0x07) + 1));
      p += 1; // LZW minimum code size
      while (p < bytes.length && bytes[p] !== 0x00) p += bytes[p] + 1;
      p += 1;
      continue;
    }

    // Unknown block — bail rather than guess.
    return false;
  }

  return false;
}

/** Logical screen size from the GIF header (bytes 6–9, little-endian). */
function gifDimensions(buffer: ArrayBuffer): { width: number; height: number } | null {
  const view = new DataView(buffer);
  if (view.byteLength < 10) return null;
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  if (!width || !height) return null;
  return { width, height };
}

/* -------------------------------------------------------------------------- */
/* Encoding                                                                    */
/* -------------------------------------------------------------------------- */

type Canvas2D = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
};

function makeCanvas(width: number, height: number): Canvas2D {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (ctx) return { canvas, ctx };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context.");
  return { canvas, ctx };
}

function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number,
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas encoding failed."))),
      type,
      quality,
    );
  });
}

/**
 * Apply the EXIF orientation transform, then draw the decoded bitmap scaled to
 * the target *display* size.
 *
 * `targetWidth`/`targetHeight` are in display space (already axis-swapped where
 * the orientation calls for it), so the draw itself happens in the pre-rotation
 * space with the axes swapped back.
 */
function drawOriented(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  orientation: number,
  targetWidth: number,
  targetHeight: number,
): void {
  const w = targetWidth;
  const h = targetHeight;

  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, w, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, w, h);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, h);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, w, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, w, h);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, h);
      break;
    default:
      break;
  }

  const swapped = orientationSwapsAxes(orientation);
  ctx.drawImage(source, 0, 0, swapped ? h : w, swapped ? w : h);
}

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

/**
 * Decode an image to something drawable.
 *
 * IMPORTANT: this does NOT promise un-rotated pixels. Whether the engine has
 * already applied EXIF orientation by the time we get here is decided at
 * runtime by `browserAppliesExifOrientation()` — see the long comment there.
 * `imageOrientation: "none"` is still requested because on an engine that
 * honours it we'd rather do the rotation ourselves; the probe tells us which
 * world we're in either way.
 */
async function decodeImage(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "none" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode that image."));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * A 308-byte JPEG whose stored pixels are 16×8 and which carries EXIF
 * Orientation = 6 (rotate 90° clockwise). Correctly oriented it displays as
 * 8×16 — so the decoded aspect ratio alone tells us whether the engine applied
 * the tag.
 */
const ORIENTATION_PROBE_JPEG =
  "/9j/4QAiRXhpZgAASUkqAAgAAAABABIBAwABAAAABgAAAAAAAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAIABADAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAABf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAWAQEBAQAAAAAAAAAAAAAAAAAGBQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwApPMBjQAd//9k=";

let exifHandling: Promise<boolean> | null = null;

/**
 * Does this engine apply EXIF orientation for us during decode?
 *
 * This is measured, not assumed, and that matters: verified in Chrome 141 that
 * `createImageBitmap(file, { imageOrientation: "none" })` returns the ROTATED
 * dimensions for an Orientation=6 JPEG — i.e. the option is ignored and the tag
 * is applied regardless. An earlier version of this module trusted "none" to
 * mean raw pixels and then applied the rotation a second time, which produced a
 * 400×200 output for an image that should have been 200×400. That is exactly
 * the failure that poisons `project_images.width/height` and makes the feed
 * layout-shift, and it is invisible unless you check.
 *
 * Rather than hard-code either behaviour, decode a known-rotated probe once per
 * session and branch on what actually came back. Because the probe goes through
 * `decodeImage`, it measures whichever decode path this browser will really use
 * — including the `<img>` fallback.
 */
function browserAppliesExifOrientation(): Promise<boolean> {
  exifHandling ??= (async () => {
    try {
      const bytes = Uint8Array.from(atob(ORIENTATION_PROBE_JPEG), (c) => c.charCodeAt(0));
      const decoded = await decodeImage(new Blob([bytes], { type: "image/jpeg" }));
      try {
        // Stored 16×8. Taller than wide means the engine rotated it for us.
        return decoded.height > decoded.width;
      } finally {
        decoded.close();
      }
    } catch {
      // If the probe can't run we assume the modern behaviour (engine applies
      // it). Being wrong here leaves an image un-rotated; the alternative wrong
      // guess rotates a correct image, which is worse.
      return true;
    }
  })();
  return exifHandling;
}

let webpSupport: Promise<boolean> | null = null;

/**
 * Can this browser *encode* WebP from a canvas? Asking for an unsupported type
 * doesn't throw — the canvas silently hands back a PNG — so the only reliable
 * check is to encode a 1×1 probe and look at the blob's actual type.
 */
function supportsWebpEncode(): Promise<boolean> {
  webpSupport ??= (async () => {
    try {
      const { canvas } = makeCanvas(1, 1);
      const blob = await canvasToBlob(canvas, "image/webp", 0.5);
      return blob.type === "image/webp";
    } catch {
      return false;
    }
  })();
  return webpSupport;
}

/** Pick the best output codec this browser can actually produce. */
async function encodeBest(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  webp: boolean,
): Promise<{ blob: Blob; contentType: string; extension: string }> {
  if (webp) {
    const blob = await canvasToBlob(canvas, "image/webp", ENCODE_QUALITY);
    if (blob.type === "image/webp") {
      return { blob, contentType: "image/webp", extension: "webp" };
    }
  }

  const jpeg = await canvasToBlob(canvas, "image/jpeg", ENCODE_QUALITY);
  if (jpeg.type === "image/jpeg") {
    return { blob: jpeg, contentType: "image/jpeg", extension: "jpg" };
  }

  // Last resort: whatever we got (a PNG, in practice).
  const type = jpeg.type || "image/png";
  return { blob: jpeg, contentType: type, extension: EXTENSION_BY_MIME[type] ?? "png" };
}

/** Formats that can carry an alpha channel, and so need a matte for JPEG output. */
const MAY_HAVE_ALPHA = new Set(["image/png", "image/webp", "image/gif", "image/avif"]);

/* -------------------------------------------------------------------------- */
/* Public entry point                                                          */
/* -------------------------------------------------------------------------- */

export async function compressImage(file: File): Promise<CompressedImage> {
  const validation = validateImageFile(file);
  if (!validation.ok) throw new Error(validation.reason);

  const buffer = await file.arrayBuffer();

  // --- Animated GIF: pass through untouched, but still report true dimensions.
  if (file.type === "image/gif" && isAnimatedGif(buffer)) {
    const dims = gifDimensions(buffer);
    if (!dims) throw new Error("Could not read that GIF.");
    return {
      blob: file,
      width: dims.width,
      height: dims.height,
      contentType: "image/gif",
      extension: "gif",
    };
  }

  const exifOrientation = file.type === "image/jpeg" ? readExifOrientation(buffer) : 1;

  // If the engine already rotated during decode, applying the tag again would
  // double-rotate. Measured per session, never assumed.
  const alreadyOriented = await browserAppliesExifOrientation();

  const decoded = await decodeImage(file);
  try {
    const orientation = alreadyOriented ? 1 : exifOrientation;

    const swapped = orientationSwapsAxes(orientation);
    const displayWidth = swapped ? decoded.height : decoded.width;
    const displayHeight = swapped ? decoded.width : decoded.height;
    if (!displayWidth || !displayHeight) throw new Error("Could not read that image.");

    const longEdge = Math.max(displayWidth, displayHeight);
    // Never upscale — an image already under the cap keeps its size.
    const scale = longEdge > MAX_IMAGE_LONG_EDGE ? MAX_IMAGE_LONG_EDGE / longEdge : 1;
    const targetWidth = Math.max(1, Math.round(displayWidth * scale));
    const targetHeight = Math.max(1, Math.round(displayHeight * scale));
    const resized = scale < 1;

    const webp = await supportsWebpEncode();

    const { canvas, ctx } = makeCanvas(targetWidth, targetHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Falling back to JPEG means losing alpha; without a matte, transparent
    // pixels encode as black. Paint white first so they read as "no background".
    if (!webp && MAY_HAVE_ALPHA.has(file.type)) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    drawOriented(ctx, decoded.source, orientation, targetWidth, targetHeight);

    const encoded = await encodeBest(canvas, webp);

    // Keeping the original is only sound when we changed nothing about the
    // geometry. If we resized, or if EXIF said the file's stored pixels are
    // rotated relative to how it should display, the re-encode is the only
    // thing whose bytes actually match the width/height we're about to store.
    // Note this tests the tag we PARSED, not the `orientation` we ended up
    // applying. When the engine rotates for us, `orientation` is forced to 1
    // even for a sideways photo — but the original file still carries the EXIF
    // flag, so handing it back would ship bytes whose stored dimensions don't
    // match the width/height we report. Re-encode bakes the rotation in and
    // strips the tag; that's the only version we can honestly measure.
    const geometryUnchanged = !resized && exifOrientation === 1;
    const reencodeIsBigger = encoded.blob.size >= file.size;

    if (geometryUnchanged && reencodeIsBigger) {
      return {
        blob: file,
        width: displayWidth,
        height: displayHeight,
        contentType: file.type,
        extension: EXTENSION_BY_MIME[file.type] ?? "jpg",
      };
    }

    return {
      blob: encoded.blob,
      width: targetWidth,
      height: targetHeight,
      contentType: encoded.contentType,
      extension: encoded.extension,
    };
  } finally {
    decoded.close();
  }
}
