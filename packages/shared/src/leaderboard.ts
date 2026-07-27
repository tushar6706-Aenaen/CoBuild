import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

/**
 * The board only offers Today and This week — deliberately narrower than the
 * feed's Top window selector. A leaderboard is a "who is winning right now"
 * surface; an all-time board is a hall of fame that never changes, and the
 * design file (`scBoard`) offers exactly these two.
 */
export type LeaderboardWindow = "today" | "week";

export const LEADERBOARD_LIMIT = 25;

/**
 * `delta` is the change in rank since the previous refresh, positive meaning
 * "climbed". `null` means the entity was not on the previous board at all,
 * which the UI renders as `new` — semantically different from `0` ("held its
 * position"), and worth keeping distinct all the way through the stack rather
 * than collapsing to a number here.
 */
export type LeaderboardProjectRow = {
  rank: number;
  delta: number | null;
  votes: number;
  id: string;
  slug: string;
  title: string;
  cover_image_path: string | null;
  author_username: string | null;
  author_display_name: string | null;
  tags: string[];
};

export type LeaderboardBuilderRow = {
  rank: number;
  delta: number | null;
  votes: number;
  projects_in_window: number;
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
};

/**
 * `computed_at` is the materialized view's refresh timestamp, not the time of
 * this request. The board's own copy promises "updates every 10 minutes", so
 * showing the reader when the numbers were actually computed is the honest
 * version of that claim — and it is the fastest way to notice the refresh cron
 * has stopped running.
 */
export type Leaderboard<Row> = { rows: Row[]; computedAt: string | null };

function normalizeWindow(w: LeaderboardWindow | undefined): LeaderboardWindow {
  return w === "today" ? "today" : "week";
}

/**
 * Top projects by upvotes *received* in the window.
 *
 * Note this is not the feed's Top tab with a shorter window: Top ranks
 * projects *published* recently by their lifetime score, while the board ranks
 * every public project by the votes it collected inside the window. A
 * two-year-old project having a great week belongs on the board and can never
 * appear on Top.
 *
 * Served from the `leaderboard_daily` materialized view via a SECURITY DEFINER
 * RPC — the view itself is ungranted, since a materialized view is not covered
 * by RLS and PostgREST would otherwise expose it directly.
 */
export async function getLeaderboardProjects(
  client: Client,
  opts: { window?: LeaderboardWindow; limit?: number } = {},
): Promise<Leaderboard<LeaderboardProjectRow>> {
  const { data, error } = await client.rpc("leaderboard_projects", {
    p_window: normalizeWindow(opts.window),
    p_limit: opts.limit ?? LEADERBOARD_LIMIT,
  });
  if (error) throw error;

  const rows = data ?? [];
  return {
    rows: rows.map((r) => ({
      rank: r.rank,
      delta: r.delta ?? null,
      votes: r.votes,
      id: r.id,
      slug: r.slug,
      title: r.title,
      cover_image_path: r.cover_image_path ?? null,
      author_username: r.author_username ?? null,
      author_display_name: r.author_display_name ?? null,
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    })),
    computedAt: rows[0]?.computed_at ?? null,
  };
}

/** Top builders by upvotes their public projects received in the window. */
export async function getLeaderboardBuilders(
  client: Client,
  opts: { window?: LeaderboardWindow; limit?: number } = {},
): Promise<Leaderboard<LeaderboardBuilderRow>> {
  const { data, error } = await client.rpc("leaderboard_builders", {
    p_window: normalizeWindow(opts.window),
    p_limit: opts.limit ?? LEADERBOARD_LIMIT,
  });
  if (error) throw error;

  const rows = data ?? [];
  return {
    rows: rows
      // The RPC already filters `username is not null`; this keeps the
      // narrowing visible to TypeScript, since a builder row without a
      // username has no profile URL to link to.
      .filter((r) => !!r.username)
      .map((r) => ({
        rank: r.rank,
        delta: r.delta ?? null,
        votes: r.votes,
        projects_in_window: r.projects_in_window,
        id: r.id,
        username: r.username,
        display_name: r.display_name ?? null,
        avatar_url: r.avatar_url ?? null,
        headline: r.headline ?? null,
      })),
    computedAt: rows[0]?.computed_at ?? null,
  };
}
