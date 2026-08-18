import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

/** Mirrors the DB CHECK on `collab_requests.message`. */
export const COLLAB_MESSAGE_MAX = 500;

export type CollabRequestStatus = "pending" | "accepted" | "declined" | "withdrawn";

export type CollabRequest = {
  id: string;
  project_id: string;
  requester_id: string;
  message: string;
  status: CollabRequestStatus;
  created_at: string;
  requester: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const SELECT = `
  id, project_id, requester_id, message, status, created_at,
  requester:profiles!collab_requests_requester_id_fkey (username, display_name, avatar_url)
` as const;

/**
 * Sends a request to join. `requesterId` is a value, not an authorization
 * check — `collab_requests_insert` pins it to `auth.uid()`, so a forged id
 * is rejected by the database rather than trusted here.
 *
 * Two failures are expected rather than exceptional and callers should map
 * them to copy: `23505` is an existing pending request (the partial unique
 * index), `53400` is the 24-hour rate limit.
 */
export async function createCollabRequest(
  client: Client,
  projectId: string,
  requesterId: string,
  message: string,
): Promise<void> {
  const { error } = await client
    .from("collab_requests")
    .insert({ project_id: projectId, requester_id: requesterId, message: message.trim() });
  if (error) throw error;
}

/** The viewer's own most recent request against this project, if any. */
export async function getViewerCollabRequest(
  client: Client,
  projectId: string,
  viewerId: string,
): Promise<CollabRequest | null> {
  if (!viewerId) return null;
  const { data, error } = await client
    .from("collab_requests")
    .select(SELECT)
    .eq("project_id", projectId)
    .eq("requester_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CollabRequest | null) ?? null;
}

/** Every request against a project. RLS returns [] unless you are the author. */
export async function getProjectCollabRequests(
  client: Client,
  projectId: string,
): Promise<CollabRequest[]> {
  const { data, error } = await client
    .from("collab_requests")
    .select(SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CollabRequest[];
}

export async function withdrawCollabRequest(client: Client, requestId: string): Promise<void> {
  const { error } = await client
    .from("collab_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId);
  if (error) throw error;
}

/**
 * Accept goes through an RPC because it is two writes — the status change and
 * the `project_collaborators` credit row — and a partial failure would leave a
 * request marked accepted with no credit behind it. The function is
 * SECURITY INVOKER, so the existing policies still authorize both writes.
 *
 * This is the ONLY code path in the app that may move a request to
 * `accepted`. Never `update collab_requests set status = 'accepted'` from
 * application code — the guard trigger permits that transition for the
 * project author (so this RPC can do its job), which means a direct PATCH
 * would also succeed, but with no credit row behind it.
 */
export async function acceptCollabRequest(
  client: Client,
  requestId: string,
  roleLabel?: string | null,
): Promise<void> {
  const { error } = await client.rpc("accept_collab_request", {
    p_request_id: requestId,
    p_role_label: roleLabel?.trim() || undefined,
  });
  if (error) throw error;
}

export async function declineCollabRequest(client: Client, requestId: string): Promise<void> {
  const { error } = await client
    .from("collab_requests")
    .update({ status: "declined" })
    .eq("id", requestId);
  if (error) throw error;
}

/**
 * Resolves the pending request a `collab_request` notification refers to.
 *
 * The notification row doesn't carry the request id (it's keyed by
 * project/actor like every other notification type), so the accept/decline
 * controls in `/notifications` need to look it up by the pair that *is*
 * on the row. Scoped to `status = 'pending'` because a requester can send a
 * new request after a decline or withdrawal — without the filter this could
 * resolve a stale, already-decided row instead of the live one the
 * notification is actually about.
 *
 * A narrow helper rather than widening `getNotifications`'s SELECT: that
 * query runs on every load of `/notifications` and shouldn't grow a join
 * serving two row types out of seven.
 */
export async function getPendingCollabRequestFor(
  client: Client,
  projectId: string,
  requesterId: string,
): Promise<CollabRequest | null> {
  const { data, error } = await client
    .from("collab_requests")
    .select(SELECT)
    .eq("project_id", projectId)
    .eq("requester_id", requesterId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CollabRequest | null) ?? null;
}

/** Just enough of a request to render and act on it from a notification row. */
export type CollabRequestSummary = {
  project_id: string;
  requester_id: string;
  message: string;
  status: CollabRequestStatus;
};

/** Key for `CollabRequestSummary` lookups. Exported so callers can't drift from it. */
export function collabRequestKey(projectId: string, requesterId: string): string {
  return `${projectId}:${requesterId}`;
}

/**
 * The newest request per `(project, requester)` pair across several projects,
 * for the `collab_request` rows on `/notifications`.
 *
 * Deliberately a second query rather than a join added to `getNotifications`:
 * that SELECT runs on every load of the page and already embeds three
 * relations for seven row types, and `notifications` has no FK to
 * `collab_requests` to embed through anyway. This one only runs when the page
 * actually holds a `collab_request` row.
 *
 * Filtering on `project_id` alone is enough — `collab_requests_select` scopes
 * reads to your own requests and requests against your own projects, so an id
 * that isn't yours contributes nothing. Pairs are matched in memory because
 * PostgREST has no tuple `IN`.
 *
 * The newest row per pair is the one to render: the partial unique index
 * allows at most one `pending` request per pair, so a newer row can only exist
 * once the previous one was resolved. That makes "newest is pending"
 * equivalent to "a live pending request exists" — which is exactly what
 * `getPendingCollabRequestFor` will find when the author clicks Accept.
 */
export async function getCollabRequestSummaries(
  client: Client,
  pairs: readonly { projectId: string; requesterId: string }[],
): Promise<Map<string, CollabRequestSummary>> {
  const out = new Map<string, CollabRequestSummary>();
  if (pairs.length === 0) return out;

  const projectIds = [...new Set(pairs.map((p) => p.projectId))];
  const wanted = new Set(pairs.map((p) => collabRequestKey(p.projectId, p.requesterId)));

  const { data, error } = await client
    .from("collab_requests")
    .select("project_id, requester_id, message, status, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  for (const row of (data ?? []) as (CollabRequestSummary & { created_at: string })[]) {
    const key = collabRequestKey(row.project_id, row.requester_id);
    // Rows arrive newest-first, so the first hit for a pair is the one to keep.
    if (!wanted.has(key) || out.has(key)) continue;
    out.set(key, {
      project_id: row.project_id,
      requester_id: row.requester_id,
      message: row.message,
      status: row.status,
    });
  }

  return out;
}
