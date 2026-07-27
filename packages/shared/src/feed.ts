import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

export type FeedTab = "hot" | "new" | "top" | "following";
export type TopWindow = "today" | "week" | "month" | "all";

/**
 * Opaque keyset cursor: the sort position of the last row of the previous page.
 *
 * Callers must treat it as a blob — it is a flat object of strings purely so it
 * can `JSON.stringify` (and base64) into a URL search param and back unchanged.
 * The fields are `(upvote_count, published_at, id)` for every tab; tabs that
 * sort on fewer columns simply ignore the leading one.
 *
 * Notably it does NOT carry `hot_score`, even though Hot sorts by it. This
 * database runs with `extra_float_digits = 0`, so PostgREST serialises float8
 * to 15 significant digits and the value does not round trip — verified live:
 * for a real row, `hot_score = '<the printed value>'::float8` is FALSE. A
 * cursor carrying the printed score fails its own equality tie-break and the
 * feed either repeats one row forever or skips rows at every page boundary
 * (both were observed before this design). Carrying the score's *inputs*
 * instead is lossless, and `feed_page` reconstructs the exact stored float
 * server-side with `compute_hot_score` — the same function the
 * `projects_refresh_hot_score` trigger uses, so the reconstruction is
 * bit-identical by construction rather than by re-deriving the formula.
 */
export type FeedCursor = { a: string; b: string; c: string } | null;

export type FeedItem = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_image_path: string | null;
  status: string;
  upvote_count: number;
  comment_count: number;
  view_count: number;
  published_at: string | null;
  hot_score: number;
  author: { username: string | null; display_name: string | null; avatar_url: string | null };
  tags: { slug: string; name: string }[];
};

/** Default rows per page. */
export const FEED_PAGE_SIZE = 20;
/** Hard ceiling, mirrored server-side, so a hostile `limit` can't widen a page. */
export const FEED_MAX_PAGE_SIZE = 50;

type FeedRpcRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_image_path: string | null;
  status: string;
  upvote_count: number;
  comment_count: number;
  view_count: number;
  published_at: string | null;
  hot_score: number;
  author: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  tags: { slug: string; name: string }[] | null;
};

function toItem(row: FeedRpcRow): FeedItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    cover_image_path: row.cover_image_path,
    status: row.status,
    upvote_count: row.upvote_count,
    comment_count: row.comment_count,
    view_count: row.view_count,
    published_at: row.published_at,
    hot_score: row.hot_score,
    author: row.author ?? { username: null, display_name: null, avatar_url: null },
    tags: row.tags ?? [],
  };
}

/**
 * One page of a ranked feed, keyset-paginated.
 *
 * Ordering per tab, all strictly descending:
 *   hot        (hot_score, published_at, id)
 *   new        (published_at, id)
 *   top        (upvote_count, published_at, id)   + a `window` filter
 *   following  (published_at, id)                 + author followed by viewer
 *
 * Every tuple ends in `id` (the primary key). Without a unique final
 * tie-breaker a keyset cursor cannot separate rows that agree on the other
 * sort columns, and the page boundary silently drops or repeats them — and
 * ties are not hypothetical here, since `hot_score` is a pure function of
 * `(upvote_count, published_at)` and collides exactly for projects published
 * in the same instant with the same score.
 *
 * Pagination is keyset, never OFFSET: Hot re-scores continuously (every vote
 * rewrites `hot_score` through a trigger), so an offset boundary shifts under
 * the reader mid-scroll. A keyset cursor is anchored to a value rather than a
 * position, so a concurrent re-rank can move a row across the boundary but can
 * never renumber the boundary itself.
 *
 * The work happens in the `feed_page` RPC (SECURITY INVOKER, so RLS still
 * applies as the caller). Three reasons it is not a query-builder chain:
 * the float-precision problem described on `FeedCursor`; PostgREST has no
 * syntax for the row-value comparison `(a,b,c) < (x,y,z)` that a matching
 * index can drive; and it keeps the feed off PostgREST embedded-relation
 * ordering entirely, which is where `getProfileContributions` was previously
 * bitten.
 *
 * `visibility = 'public'` is filtered explicitly server-side on every tab. RLS
 * deliberately lets `unlisted` through so direct links work, so that filter —
 * not RLS — is what keeps unlisted projects out of listings. Rows with a null
 * `published_at` are excluded too: a public project without one is a data
 * anomaly, and since Postgres orders DESC as NULLS FIRST it would pin itself
 * to the top of New forever while being unreachable by any cursor.
 *
 * @param opts.viewerId Only meaningful for `following`. Hot/New/Top are
 *   identical signed-out; pass `null`. `following` without a viewer returns an
 *   empty page rather than throwing, so the tab can render logged-out. A
 *   viewer who follows nobody likewise gets an empty page, never everyone's
 *   projects.
 * @param opts.tag Restricts the page to projects carrying this tag slug — the
 *   tag page (`/tag/[slug]`) is the same ranked feed, scoped. An unknown slug
 *   yields an empty page, never an unfiltered one.
 * @returns `nextCursor` is null exactly when there are no further rows, so the
 *   caller can use it directly to decide whether to offer "load more".
 */
export async function getFeedPage(
  client: Client,
  opts: {
    tab: FeedTab;
    window?: TopWindow;
    viewerId?: string | null;
    cursor?: FeedCursor;
    limit?: number;
    tag?: string | null;
  },
): Promise<{ items: FeedItem[]; nextCursor: FeedCursor | null }> {
  const limit = Math.max(1, Math.min(opts.limit ?? FEED_PAGE_SIZE, FEED_MAX_PAGE_SIZE));

  if (opts.tab === "following" && !opts.viewerId) return { items: [], nextCursor: null };

  const cursor = opts.cursor ?? null;

  // Over-fetch by one: the extra row is the only reliable "there is more"
  // signal. A page that happens to be exactly `limit` long is otherwise
  // indistinguishable from the last page, and a non-null cursor on the last
  // page leaves the UI with a "load more" button that returns nothing.
  const { data, error } = await client.rpc("feed_page", {
    p_tab: opts.tab,
    p_limit: limit + 1,
    p_window: opts.window ?? "all",
    p_viewer: opts.viewerId ?? undefined,
    p_cur_num: cursor ? Number(cursor.a) : undefined,
    p_cur_ts: cursor ? cursor.b : undefined,
    p_cur_id: cursor ? cursor.c : undefined,
    p_tag: opts.tag ?? undefined,
  });
  if (error) throw error;

  const rows = (data ?? []) as unknown as FeedRpcRow[];
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = items[items.length - 1];

  return {
    items: items.map(toItem),
    nextCursor:
      hasMore && last
        ? { a: String(last.upvote_count), b: last.published_at ?? "", c: last.id }
        : null,
  };
}

/**
 * Vote + bookmark state for a whole page of cards in two round trips, instead
 * of `getViewerProjectState` once per card.
 *
 * Requires a client carrying the viewer's session: `votes_select_own` and
 * `bookmarks_select_own` are `authenticated`-only and scoped to
 * `profile_id = auth.uid()`, so an anon client gets empty sets rather than an
 * error. Passing someone else's `viewerId` likewise yields empty sets — RLS
 * makes this un-spoofable; the argument is only a filter.
 */
export async function getViewerVoteState(
  client: Client,
  viewerId: string,
  projectIds: string[],
): Promise<{ voted: Set<string>; bookmarked: Set<string> }> {
  if (projectIds.length === 0 || !viewerId) return { voted: new Set(), bookmarked: new Set() };

  const [votes, bookmarks] = await Promise.all([
    client.from("votes").select("project_id").eq("profile_id", viewerId).in("project_id", projectIds),
    client.from("bookmarks").select("project_id").eq("profile_id", viewerId).in("project_id", projectIds),
  ]);
  if (votes.error) throw votes.error;
  if (bookmarks.error) throw bookmarks.error;

  return {
    voted: new Set((votes.data ?? []).map((r) => r.project_id)),
    bookmarked: new Set((bookmarks.data ?? []).map((r) => r.project_id)),
  };
}
