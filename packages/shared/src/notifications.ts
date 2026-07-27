import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

export const NOTIFICATION_TYPES = ["upvote", "comment", "reply", "follow", "credit"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Page size for `/notifications`. */
export const NOTIFICATION_PAGE_LIMIT = 50;
/** Above this the nav badge renders as "N+" rather than a precise count. */
export const UNREAD_BADGE_CAP = 99;

export type NotificationItem = {
  id: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  actor: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  /** Null when the referenced project is gone or no longer readable by the viewer. */
  project: { slug: string; title: string; author_username: string | null } | null;
  /** Body of the comment that triggered this, for `comment` / `reply` only. */
  excerpt: string | null;
};

type Row = {
  id: string;
  type: string;
  read_at: string | null;
  created_at: string;
  actor: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  project: {
    slug: string;
    title: string;
    author: { username: string | null } | null;
  } | null;
  comment: { body: string; deleted_at: string | null } | null;
};

/**
 * `profiles` is reachable from `notifications` through two different foreign
 * keys (recipient and actor), so the embed MUST name the constraint — an
 * unqualified `profiles(...)` is ambiguous and PostgREST rejects it.
 */
const SELECT = `
  id, type, read_at, created_at,
  actor:profiles!notifications_actor_id_fkey (username, display_name, avatar_url),
  project:projects!notifications_project_id_fkey (
    slug, title,
    author:profiles!projects_author_id_fkey (username)
  ),
  comment:comments!notifications_comment_id_fkey (body, deleted_at)
` as const;

function isType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

function toItem(row: Row): NotificationItem | null {
  // A type outside the known set means the DB check constraint gained a value
  // this client predates. Dropping the row is better than rendering a blank
  // one with no icon and no copy.
  if (!isType(row.type)) return null;

  return {
    id: row.id,
    type: row.type,
    read: row.read_at !== null,
    created_at: row.created_at,
    actor: row.actor ?? null,
    project: row.project
      ? {
          slug: row.project.slug,
          title: row.project.title,
          author_username: row.project.author?.username ?? null,
        }
      : null,
    // A soft-deleted comment keeps its row (so threads don't reparent), but
    // its body must not resurface here after the author removed it.
    excerpt: row.comment && !row.comment.deleted_at ? row.comment.body : null,
  };
}

/**
 * The viewer's notifications, newest first.
 *
 * `viewerId` is a filter, not an authorization check — `notifications_select_own`
 * scopes every read to `auth.uid()`, so passing someone else's id returns an
 * empty list rather than their inbox. Passing it explicitly lets the query use
 * `notifications_recipient_created_idx` instead of relying on the policy's
 * predicate alone.
 *
 * Embedded projects come back null when the project was deleted or is no
 * longer visible to the viewer (an author flipping a project back to draft
 * after crediting someone). Callers must render those without a link rather
 * than assuming a project is always present.
 */
export async function getNotifications(
  client: Client,
  viewerId: string,
  limit = NOTIFICATION_PAGE_LIMIT,
): Promise<NotificationItem[]> {
  if (!viewerId) return [];

  const { data, error } = await client
    .from("notifications")
    .select(SELECT)
    .eq("recipient_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return ((data ?? []) as unknown as Row[])
    .map(toItem)
    .filter((n): n is NotificationItem => n !== null);
}

/**
 * Unread count for the nav badge, capped.
 *
 * Bounded on purpose. This runs in the app shell on *every* authenticated page
 * load, and an exact `count: "exact"` is O(unread) — it walks every matching
 * index entry. Measured on 40k unread for one recipient: 8.9ms for the exact
 * count versus 0.128ms for this, and the exact version keeps getting slower
 * the longer someone ignores their notifications. That is a slow burn that
 * would never show up in development, where nobody has more than a handful.
 *
 * The badge renders `99+` above `UNREAD_BADGE_CAP` anyway, so precision past
 * the cap was never displayed. Fetching `CAP + 1` ids and counting them makes
 * the work constant, and the extra row is what distinguishes "exactly 99"
 * from "99 or more".
 *
 * @returns the exact count up to `UNREAD_BADGE_CAP`, or `UNREAD_BADGE_CAP + 1`
 *   to mean "at least this many" — callers should render that as `99+`.
 */
export async function getUnreadNotificationCount(
  client: Client,
  viewerId: string,
): Promise<number> {
  if (!viewerId) return 0;

  const { data, error } = await client
    .from("notifications")
    .select("id")
    .eq("recipient_id", viewerId)
    .is("read_at", null)
    .limit(UNREAD_BADGE_CAP + 1);
  if (error) throw error;
  return data?.length ?? 0;
}

/**
 * Marks everything currently unread as read.
 *
 * Filtered on `read_at is null` rather than blanket-updating: without it,
 * every already-read notification is rewritten too, which both writes rows for
 * nothing and resets the timestamps that record when the user actually saw
 * them.
 */
export async function markAllNotificationsRead(client: Client, viewerId: string): Promise<void> {
  if (!viewerId) return;

  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", viewerId)
    .is("read_at", null);
  if (error) throw error;
}

/** Marks one notification read — used when the viewer follows its link. */
export async function markNotificationRead(client: Client, id: string): Promise<void> {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

/** Where clicking a notification should take you. Null when the target is gone. */
export function notificationHref(n: NotificationItem): string | null {
  if (n.type === "follow") {
    return n.actor?.username ? `/u/${n.actor.username}` : null;
  }
  if (!n.project?.author_username) return null;
  return `/p/${n.project.author_username}/${n.project.slug}`;
}
