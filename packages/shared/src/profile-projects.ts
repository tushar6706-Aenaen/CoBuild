import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

export type ProjectTile = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_image_path: string | null;
  status: string;
  visibility: string;
  upvote_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  published_at: string | null;
  author: { username: string | null } | null;
  tags: { slug: string; name: string }[];
};

/**
 * Hard cap on rows per profile tab. Without it these are unbounded scans: a
 * profile with thousands of projects/bookmarks made Postgres sort the whole
 * set to disk (measured: 15k rows, ~350 ms, external merge sort) and shipped
 * every tile to the client. Paging is a Phase 3 concern; until then the cap
 * is what keeps the page O(1). Kept in sync with the composite indexes
 * `projects_author_created_idx`, `bookmarks_profile_created_idx`, and
 * `project_collaborators_profile_status_idx`, which make these ordered
 * top-N lookups index-only rather than sort-everything.
 */
export const PROFILE_TAB_LIMIT = 48;

const PROJECT_FIELDS = `
  id, slug, title, tagline, cover_image_path, status, visibility,
  upvote_count, comment_count, view_count, created_at, published_at,
  author:profiles!projects_author_id_fkey(username),
  project_tags(tags(slug,name))
`;

// PostgREST returns the embedded join shape below; flatten it to `ProjectTile`
// so callers don't deal with `project_tags[].tags` nesting.
type RawProjectRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_image_path: string | null;
  status: string;
  visibility: string;
  upvote_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  published_at: string | null;
  author: { username: string | null } | null;
  project_tags: { tags: { slug: string; name: string } | null }[] | null;
};

function toTile(row: RawProjectRow): ProjectTile {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    cover_image_path: row.cover_image_path,
    status: row.status,
    visibility: row.visibility,
    upvote_count: row.upvote_count,
    comment_count: row.comment_count,
    view_count: row.view_count,
    created_at: row.created_at,
    published_at: row.published_at,
    author: row.author,
    tags: (row.project_tags ?? []).map((pt) => pt.tags).filter((t): t is { slug: string; name: string } => t !== null),
  };
}

/**
 * A profile's own projects. `includeNonPublic` shows drafts/unlisted too —
 * pass `true` only when the viewer IS this profile (their own portfolio
 * management view). For anyone else, RLS would still allow an author to see
 * their own non-public rows, but this is a *listing* surface, so the
 * `visibility = 'public'` filter is applied explicitly regardless of RLS —
 * see PROJECT_INFO.md's unlisted-visibility gotcha.
 */
export async function getProfileProjects(
  client: Client,
  authorId: string,
  includeNonPublic: boolean,
): Promise<ProjectTile[]> {
  let query = client
    .from("projects")
    .select(PROJECT_FIELDS)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(PROFILE_TAB_LIMIT);

  if (!includeNonPublic) query = query.eq("visibility", "public");

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as RawProjectRow[]).map(toTile);
}

/**
 * Projects this profile is credited on as an accepted co-builder.
 *
 * The `!inner` hint on the embedded `projects` resource is load-bearing when
 * `includeNonPublic` is false. PostgREST applies `project.visibility=eq.public`
 * to the *embedded* resource; on a normal (left-join) embed that only nulls out
 * the embed, so non-public rows come back as `{ project: null }` and the
 * collaborator row still occupies a slot in the result (and in `limit`).
 * `!inner` turns it into an inner join so those rows drop out server-side —
 * verified against the live API, not assumed.
 *
 * Ordering must be expressed as PostgREST's `order=project(created_at).desc`
 * (ordering the parent rows by a to-one embedded column). Note that
 * supabase-js's `{ referencedTable: "project" }` option is NOT the same thing:
 * it emits `project.order=...`, which orders rows *within* a to-many embed and
 * leaves the parent order undefined. Without an explicit order the result set
 * is non-deterministic, which turns the `limit` below into an arbitrary slice.
 */
export async function getProfileContributions(
  client: Client,
  profileId: string,
  includeNonPublic: boolean,
): Promise<ProjectTile[]> {
  const relation = includeNonPublic
    ? `project:projects!project_collaborators_project_id_fkey(${PROJECT_FIELDS})`
    : `project:projects!project_collaborators_project_id_fkey!inner(${PROJECT_FIELDS})`;

  let query = client
    .from("project_collaborators")
    .select(relation)
    .eq("profile_id", profileId)
    .eq("status", "accepted")
    .order("project(created_at)", { ascending: false })
    .limit(PROFILE_TAB_LIMIT);

  if (!includeNonPublic) query = query.eq("project.visibility", "public");

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as { project: RawProjectRow }[])
    .map((row) => row.project)
    .filter((p): p is RawProjectRow => p !== null)
    .map(toTile);
}

/**
 * A profile's own bookmarks. Always scoped to the signed-in caller by RLS
 * (`bookmarks_select_own`) — there is no `includeNonPublic` flag because this
 * is inherently a private "my list" view, never a public listing: a bookmarked
 * project that's since gone private simply drops out via the embedded
 * `projects` row's own RLS, which is the correct behavior here.
 */
export async function getProfileBookmarks(client: Client, profileId: string): Promise<ProjectTile[]> {
  const { data, error } = await client
    .from("bookmarks")
    .select(`project:projects!bookmarks_project_id_fkey(${PROJECT_FIELDS})`)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(PROFILE_TAB_LIMIT);

  if (error) throw error;
  return (data as unknown as { project: RawProjectRow }[])
    .map((row) => row.project)
    .filter((p): p is RawProjectRow => p !== null)
    .map(toTile);
}
