import type { Database, Json, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

/**
 * Deliberately narrower than the full `profiles` row (`Tables<"profiles">`)
 * — this is exactly the column list `getProfileByUsername` selects, used on
 * a public-facing page. Add fields here (and to `PROFILE_COLUMNS` below)
 * only when a UI actually needs them, not by widening to the full row.
 */
export type ProfileSummary = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  headline: string | null;
  github_username: string | null;
  roles: string[];
  is_student: boolean;
  college: string | null;
  grad_year: number | null;
  location: string | null;
  timezone: string | null;
  links: Json;
  follower_count: number;
  following_count: number;
  project_count: number;
  total_upvotes_received: number;
  created_at: string;
};

const PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, bio, headline, github_username, roles, is_student, college, grad_year, location, timezone, links, follower_count, following_count, project_count, total_upvotes_received, created_at";

/**
 * Public profile lookup by handle. `profiles` is world-readable, so this
 * works for signed-out visitors too. Returns `null` for a nonexistent or
 * not-yet-claimed (`username IS NULL`) handle — never throws on "not found".
 */
export async function getProfileByUsername(
  client: Client,
  username: string,
): Promise<ProfileSummary | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("username", username.trim())
    .maybeSingle();

  if (error) throw error;
  return data as ProfileSummary | null;
}

/** Whether `followerId` currently follows `followingId`. */
export async function isFollowing(
  client: Client,
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

/**
 * Live availability check for a candidate username.
 *
 * `profiles.username` is `extensions.citext`, so PostgREST's `eq` filter
 * compares case-insensitively at the database level — `eq("username", "Foo")`
 * matches a stored `foo`. Do **not** use `ilike` here: `_` is a legal username
 * character but a single-character wildcard in LIKE, so `ilike` would report
 * `a_b` as taken whenever `axb` exists.
 *
 * `profiles` is world-readable (`profiles_select_all` RLS policy), so this
 * works for anon and authenticated callers alike. Only `id` is selected so the
 * check never leaks anything beyond "exists / does not exist".
 */
export async function usernameIsTaken(client: Client, candidate: string): Promise<boolean> {
  const trimmed = candidate.trim();
  if (!trimmed) return false;

  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("username", trimmed)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}
