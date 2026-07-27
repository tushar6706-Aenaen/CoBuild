import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@cobuild/db";

import { compressImage } from "./compress";

/**
 * Browser → Storage upload for project gallery images.
 *
 * Bytes go straight from the browser to Supabase Storage. They are deliberately
 * NOT proxied through a Next route handler: that would burn double bandwidth and
 * run into serverless request-body ceilings, and it buys nothing — Storage RLS
 * already enforces that a user can only write under their own `auth.uid()`
 * prefix (verified live; see removeProjectImage's note).
 */

export const PROJECT_MEDIA_BUCKET = "project-media";

/**
 * Object paths contain a fresh UUID and are never overwritten, so they can be
 * cached indefinitely. One year, in seconds.
 */
const CACHE_CONTROL = "31536000";

export type UploadedImage = {
  /**
   * The value for `project_images.storage_path`. A PATH inside the
   * `project-media` bucket — never a resolvable URL. See PROJECT_INFO.md.
   */
  storagePath: string;
  width: number;
  height: number;
};

function abortError(): DOMException {
  return new DOMException("Upload cancelled.", "AbortError");
}

/* -------------------------------------------------------------------------- */
/* Progress-capable transport                                                  */
/* -------------------------------------------------------------------------- */

/**
 * PUT a blob to a Storage signed-upload URL via XMLHttpRequest.
 *
 * Why XHR and not the SDK: the installed `@supabase/supabase-js` (2.110.8,
 * bundling `@supabase/storage-js` 2.110.8) has no upload-progress facility at
 * all. Its `upload()` accepts only `FileOptions` — `cacheControl`, `contentType`,
 * `upsert`, `duplex`, `metadata`, `headers` — with no progress callback and no
 * `signal`. `fetch` can't report request-body progress either. XHR's
 * `upload.onprogress` is the only browser API that does, so we drive the same
 * HTTP request the SDK would have made.
 *
 * The body shape mirrors `StorageFileApi.uploadToSignedUrl` exactly: a PUT of
 * multipart form-data with a `cacheControl` field and the blob under the empty
 * field name. The signed URL carries its own token, so no `apikey` or
 * `Authorization` header is needed (verified: a bare PUT with no auth headers
 * returns 200).
 */
function putWithProgress(
  signedUrl: string,
  blob: Blob,
  contentType: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", CACHE_CONTROL);
    form.append("", new File([blob], "upload", { type: contentType }));

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || !event.total) return;
      // Cap at 99 — the last percent belongs to the server's response, and
      // reporting 100 before we know it succeeded would be a lie.
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let message = `Upload failed (${xhr.status}).`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        if (parsed.message) message = parsed.message;
        else if (parsed.error) message = parsed.error;
      } catch {
        /* non-JSON error body — keep the status-code message */
      }
      reject(new Error(message));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("Network error while uploading."));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error("Upload timed out."));
    };
    xhr.onabort = () => {
      cleanup();
      reject(abortError());
    };

    xhr.send(form);
  });
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export async function uploadProjectImage(opts: {
  client: SupabaseClient<Database>;
  userId: string;
  projectId: string;
  file: File;
  /** 0..100. Real byte progress where the browser can report it. */
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}): Promise<UploadedImage> {
  const { client, userId, projectId, file, onProgress, signal } = opts;

  if (signal?.aborted) throw abortError();

  onProgress?.(0);

  const compressed = await compressImage(file);
  if (signal?.aborted) throw abortError();

  // The first path segment MUST be the user's own id — Storage RLS matches
  // `(storage.foldername(name))[1] = auth.uid()::text` and rejects anything
  // else. The filename is a fresh UUID: `file.name` is attacker-controlled and
  // never appears in the path.
  const storagePath = `${userId}/${projectId}/${crypto.randomUUID()}.${compressed.extension}`;

  const bucket = client.storage.from(PROJECT_MEDIA_BUCKET);

  // Creating the signed URL is itself RLS-checked (it needs `insert` on
  // storage.objects), so a cross-prefix path fails here rather than after the
  // bytes have been sent.
  const signed = await bucket.createSignedUploadUrl(storagePath);
  if (signal?.aborted) throw abortError();
  if (signed.error) throw new Error(signed.error.message);

  if (typeof XMLHttpRequest === "function") {
    await putWithProgress(
      signed.data.signedUrl,
      compressed.blob,
      compressed.contentType,
      onProgress,
      signal,
    );
  } else {
    // No XHR (non-browser environment). The SDK path can't report progress, so
    // jump straight to done rather than inventing intermediate values.
    const { error } = await bucket.uploadToSignedUrl(
      storagePath,
      signed.data.token,
      compressed.blob,
      { contentType: compressed.contentType, cacheControl: CACHE_CONTROL },
    );
    if (error) throw new Error(error.message);
  }

  // A cancel that lands between the last byte and here still leaves an object
  // behind. Clean it up best-effort; if that fails, the 24h orphan sweep gets it.
  if (signal?.aborted) {
    await bucket.remove([storagePath]).catch(() => undefined);
    throw abortError();
  }

  onProgress?.(100);

  return {
    storagePath,
    width: compressed.width,
    height: compressed.height,
  };
}

export async function removeProjectImage(
  client: SupabaseClient<Database>,
  storagePath: string,
): Promise<void> {
  const { error } = await client.storage.from(PROJECT_MEDIA_BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}
