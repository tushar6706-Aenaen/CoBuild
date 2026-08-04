import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

export type ProjectDetail = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  cover_image_path: string | null;
  live_url: string | null;
  repo_url: string | null;
  status: string;
  visibility: string;
  upvote_count: number;
  comment_count: number;
  bookmark_count: number;
  view_count: number;
  created_at: string;
  published_at: string | null;
  author: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    headline: string | null;
    roles: string[];
    is_student: boolean;
    college: string | null;
    grad_year: number | null;
  };
  images: { storage_path: string; alt: string | null; caption: string | null; width: number | null; height: number | null; position: number }[];
  /** `id`/`usage_count` are included so the editor can round-trip tags without a second query. */
  tags: { id: string; slug: string; name: string; usage_count: number }[];
  collaborators: {
    profile_id: string | null;
    invited_name: string | null;
    role_label: string | null;
    position: number;
    profile: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  }[];
};

const DETAIL_FIELDS = `
  id, slug, title, tagline, description, cover_image_path, live_url, repo_url,
  status, visibility, upvote_count, comment_count, bookmark_count, view_count,
  created_at, published_at,
  author:profiles!projects_author_id_fkey(
    id, username, display_name, avatar_url, headline, roles, is_student, college, grad_year
  ),
  images:project_images(storage_path, alt, caption, width, height, position),
  project_tags(tags(id, slug, name, usage_count)),
  collaborators:project_collaborators(
    profile_id, invited_name, role_label, position,
    profile:profiles!project_collaborators_profile_id_fkey(username, display_name, avatar_url)
  )
`;

type TagRow = { id: string; slug: string; name: string; usage_count: number };

type RawDetail = Omit<ProjectDetail, "tags"> & {
  project_tags: { tags: TagRow | null }[] | null;
};

/**
 * Fetches a project by author handle + slug.
 *
 * Deliberately does NOT filter `visibility` — this is a direct-link surface,
 * so `unlisted` must resolve here (that's the whole point of unlisted). RLS
 * is what blocks other people's drafts. The app-layer `visibility = 'public'`
 * rule in PROJECT_INFO applies to *listing* surfaces (feed/search/leaderboard),
 * not to this one.
 */
export async function getProjectDetail(
  client: Client,
  username: string,
  slug: string,
): Promise<ProjectDetail | null> {
  const { data: author, error: authorError } = await client
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (authorError) throw authorError;
  if (!author) return null;

  const { data, error } = await client
    .from("projects")
    .select(DETAIL_FIELDS)
    .eq("author_id", author.id)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const raw = data as unknown as RawDetail;
  return {
    ...raw,
    images: [...(raw.images ?? [])].sort((a, b) => a.position - b.position),
    collaborators: [...(raw.collaborators ?? [])].sort((a, b) => a.position - b.position),
    tags: (raw.project_tags ?? []).map((pt) => pt.tags).filter((t): t is TagRow => t !== null),
  };
}

export type CommentNode = {
  id: string;
  body: string;
  created_at: string;
  upvote_count: number;
  parent_id: string | null;
  depth: number;
  author: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
  replies: CommentNode[];
};

type RawComment = Omit<CommentNode, "replies">;

/** Max nesting the UI renders; deeper replies are flattened onto this level. */
export const MAX_COMMENT_DEPTH = 2;

/**
 * Loads a project's comments and assembles the reply tree in one round trip.
 * Soft-deleted rows are excluded by RLS, which can orphan a reply whose parent
 * is gone — those are re-attached at the root rather than silently dropped.
 */
export async function getProjectComments(client: Client, projectId: string): Promise<CommentNode[]> {
  const { data, error } = await client
    .from("comments")
    .select(
      `id, body, created_at, upvote_count, parent_id, depth,
       author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)`,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;

  const rows = data as unknown as RawComment[];
  const byId = new Map<string, CommentNode>();
  for (const row of rows) byId.set(row.id, { ...row, replies: [] });

  const roots: CommentNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    const parent = row.parent_id ? byId.get(row.parent_id) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Flattens the reply tree into a flat id list, for viewer-state lookups. */
export function collectCommentIds(nodes: CommentNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: CommentNode[]) => {
    for (const node of list) {
      ids.push(node.id);
      if (node.replies.length > 0) walk(node.replies);
    }
  };
  walk(nodes);
  return ids;
}

/**
 * Which of `commentIds` the viewer has already upvoted.
 *
 * Returned as a Set, mirroring the feed's `getViewerVoteState`, so rendering
 * the tree is a lookup per node rather than a scan.
 *
 * Without this every comment vote button mounted un-voted regardless of
 * history, so clicking a comment you'd already upvoted fired an INSERT that
 * the `comment_votes` unique constraint rejected — the arrow lit up, the
 * count ticked, and both snapped back. There was no way to un-vote at all.
 */
export async function getViewerCommentVotes(
  client: Client,
  viewerId: string,
  commentIds: string[],
): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();

  const { data, error } = await client
    .from("comment_votes")
    .select("comment_id")
    .eq("profile_id", viewerId)
    .in("comment_id", commentIds);
  if (error) throw error;

  return new Set((data ?? []).map((row) => row.comment_id));
}

/** Whether the viewer has upvoted / bookmarked, for initial button state. */
export async function getViewerProjectState(
  client: Client,
  projectId: string,
  viewerId: string,
): Promise<{ voted: boolean; bookmarked: boolean }> {
  const [vote, bookmark] = await Promise.all([
    client.from("votes").select("project_id").eq("project_id", projectId).eq("profile_id", viewerId).maybeSingle(),
    client.from("bookmarks").select("project_id").eq("project_id", projectId).eq("profile_id", viewerId).maybeSingle(),
  ]);
  return { voted: vote.data !== null, bookmarked: bookmark.data !== null };
}
