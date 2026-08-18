"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  COLLAB_MESSAGE_MAX,
  createCollabRequest,
  getViewerCollabRequest,
  withdrawCollabRequest,
  acceptCollabRequest,
  declineCollabRequest,
  getPendingCollabRequestFor,
} from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/redirects";

export type CollabActionState = { error?: string; ok?: boolean; requestId?: string };

/**
 * `errorLike` narrows the `unknown` a catch clause hands back. PostgREST
 * errors carry a `.code`, but a transport-level failure (offline, DNS, CORS)
 * throws something that doesn't — Phase 6 established that distinction
 * matters, since that failure mode rejects instead of returning `{ error }`.
 */
function pgCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e
    ? (e as { code?: string }).code
    : undefined;
}

/**
 * `projectPath` arrives from a hidden form field, so it is attacker-controlled
 * on every write path below. Handing it to `revalidatePath()` unchecked lets
 * any authenticated user invalidate an arbitrary route — and `withdrawRequest`
 * makes that unlimited, since it carries no rate limit and a 0-row PATCH comes
 * back 204 with `error` null, so a loop against it never fails.
 *
 * The shape is fully known (`/p/${username}/${slug}` — see the mount site in
 * `p/[username]/[slug]/page.tsx`), so it is validated rather than trusted:
 * `USERNAME_REGEX`'s character class, and `slugify`'s `[a-z0-9-]` output plus
 * `uniqueSlug`'s numeric suffix. Anything else revalidates nothing at all,
 * which is the safe failure — the write itself has already succeeded and the
 * pages involved are dynamic.
 */
const PROJECT_PATH_RE = /^\/p\/[a-zA-Z0-9_-]{2,39}\/[a-z0-9-]{1,120}$/;

function safeProjectPath(raw: string): string | null {
  return PROJECT_PATH_RE.test(raw) ? raw : null;
}

/**
 * Sends a request to join a project. The two DB errors that are expected
 * rather than exceptional — an existing pending request, and the 24h rate
 * limit — get real copy; anything else falls back to a generic message and
 * is logged for follow-up.
 */
export async function requestToJoin(
  _prev: CollabActionState,
  formData: FormData,
): Promise<CollabActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const projectId = String(formData.get("projectId") ?? "");
  const projectPath = String(formData.get("projectPath") ?? "");
  const message = String(formData.get("message") ?? "").trim().slice(0, COLLAB_MESSAGE_MAX);
  if (!projectId) return { error: "Something went wrong sending your request. Try again." };
  if (!message) return { error: "Say a little about why you'd like to join." };

  try {
    await createCollabRequest(supabase, projectId, user.id, message);
  } catch (e) {
    const code = pgCode(e);
    if (code === "23505") {
      return { error: "You already have a request pending on this project." };
    }
    if (code === "53400") {
      // `collab_requests_rate_limit()` counts every row created in the window,
      // whatever its status — withdrawing does not give a slot back. The copy
      // says so, because "try again tomorrow" alone reads as though it might.
      return {
        error:
          "You've hit the limit of 10 join requests in 24 hours. Withdrawing one doesn't free up a slot — try again tomorrow.",
      };
    }
    console.error("[collab] request failed", e);
    return { error: "Something went wrong sending your request. Try again." };
  }

  const safePath = safeProjectPath(projectPath);
  if (safePath) revalidatePath(safePath);

  // Hand the new request's id back so the button can show "Request sent" plus
  // a working Withdraw control without a reload. `createCollabRequest` only
  // returns `void` (its signature is pinned), so the row is read back here;
  // if that second read fails, the request still exists — swallow it and let
  // the UI fall back to a status-only render rather than reporting failure
  // for a write that actually succeeded.
  let requestId: string | undefined;
  try {
    const created = await getViewerCollabRequest(supabase, projectId, user.id);
    requestId = created?.id;
  } catch (e) {
    console.error("[collab] could not read back the new request", e);
  }

  return { ok: true, requestId };
}

/** Requester withdraws their own pending request. RLS scopes this to the requester. */
export async function withdrawRequest(
  _prev: CollabActionState,
  formData: FormData,
): Promise<CollabActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const requestId = String(formData.get("requestId") ?? "");
  const projectPath = String(formData.get("projectPath") ?? "");
  if (!requestId) return { error: "Something went wrong. Try again." };

  try {
    await withdrawCollabRequest(supabase, requestId);
  } catch (e) {
    console.error("[collab] withdraw failed", e);
    return { error: "Couldn't withdraw your request. Try again." };
  }

  const safePath = safeProjectPath(projectPath);
  if (safePath) revalidatePath(safePath);
  return { ok: true };
}

/**
 * Accept, invoked from a `collab_request` notification. The notification row
 * carries `(projectId, requesterId)`, not the request id, so the pending
 * request is resolved first — see `getPendingCollabRequestFor`.
 *
 * The actual status change goes through `acceptCollabRequest`, which is the
 * ONLY caller of the `accept_collab_request` RPC in this codebase. This
 * function must never write `status: "accepted"` itself — see the note on
 * `acceptCollabRequest` in `packages/shared/src/collab.ts` for why a direct
 * update would "succeed" while silently skipping the credit row.
 *
 * This is enforced, not just documented: `pnpm check:invariants` fails on a
 * direct `status: "accepted"` write to `collab_requests` and on any call to
 * the RPC outside its single wrapper.
 */
export async function acceptRequest(
  _prev: CollabActionState,
  formData: FormData,
): Promise<CollabActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const projectId = String(formData.get("projectId") ?? "");
  const requesterId = String(formData.get("requesterId") ?? "");
  if (!projectId || !requesterId) return { error: "Something went wrong. Try again." };

  try {
    const request = await getPendingCollabRequestFor(supabase, projectId, requesterId);
    if (!request) return { error: "This request has already been handled." };
    await acceptCollabRequest(supabase, request.id);
  } catch (e) {
    console.error("[collab] accept failed", e);
    return { error: "Couldn't accept this request. Try again." };
  }

  revalidatePath("/notifications");
  // The requester's `credit` notification (from `notify_on_credit`) and the
  // recipient's own badge both live in the shell layout.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Decline, invoked from a `collab_request` notification. See `acceptRequest` for the id lookup. */
export async function declineRequest(
  _prev: CollabActionState,
  formData: FormData,
): Promise<CollabActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const projectId = String(formData.get("projectId") ?? "");
  const requesterId = String(formData.get("requesterId") ?? "");
  if (!projectId || !requesterId) return { error: "Something went wrong. Try again." };

  try {
    const request = await getPendingCollabRequestFor(supabase, projectId, requesterId);
    if (!request) return { error: "This request has already been handled." };
    await declineCollabRequest(supabase, request.id);
  } catch (e) {
    console.error("[collab] decline failed", e);
    return { error: "Couldn't decline this request. Try again." };
  }

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { ok: true };
}
