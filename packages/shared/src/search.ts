import type { Database, SupabaseClient } from "@cobuild/db";
import { PROJECT_STATUSES, type ProjectStatus } from "./project-schema";

type Client = SupabaseClient<Database>;

export const SEARCH_PROJECT_LIMIT = 24;
export const SEARCH_PEOPLE_LIMIT = 8;
export const SEARCH_TAG_LIMIT = 12;

/**
 * A project search hit. Shaped as a superset of what `ProjectCard` needs so
 * search results render with the same component as the feed — deliberately no
 * `hot_score`, because search ranks by text relevance, not by heat, and
 * carrying a ranking field the caller must not sort on invites misuse.
 */
export type SearchProjectHit = {
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
  author: { username: string | null; display_name: string | null; avatar_url: string | null };
  tags: { slug: string; name: string }[];
};

export type PersonHit = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  follower_count: number;
};

export type TagHit = { slug: string; name: string; usage_count: number };

/** `total` is the full match count, not the number of rows returned. */
export type SearchResult<Hit> = { items: Hit[]; total: number };

function empty<Hit>(): SearchResult<Hit> {
  return { items: [], total: 0 };
}

/** Narrows arbitrary URL input down to real status values. */
export function parseStatusFilters(input: readonly string[]): ProjectStatus[] {
  const allowed = new Set<string>(PROJECT_STATUSES);
  return [...new Set(input.filter((s) => allowed.has(s)))] as ProjectStatus[];
}

/**
 * Full-text project search over `search_tsv` (title weight A, tagline B,
 * description C), narrowed by optional status and tag facets.
 *
 * Ranked by `ts_rank_cd`, then upvotes, then id. That ordering lives in SQL
 * rather than here because `ts_rank_cd` needs the tsquery, and — more to the
 * point — a float ranking column must never leave the database as a paging
 * key (see `FeedCursor`). Search is therefore a single bounded top-N page
 * rather than a keyset scroll: the result set is small, re-queried on every
 * edit of the query string, and capped server-side at 60 rows.
 *
 * The query goes through `websearch_to_tsquery`, so quoted phrases, `or`, and
 * a leading `-` all work as a user expects, and malformed input returns
 * nothing instead of raising the way `to_tsquery` would.
 */
export async function searchProjects(
  client: Client,
  opts: {
    q: string;
    statuses?: readonly ProjectStatus[];
    tags?: readonly string[];
    limit?: number;
  },
): Promise<SearchResult<SearchProjectHit>> {
  const q = opts.q.trim();
  if (!q) return empty();

  const statuses = opts.statuses?.length ? [...opts.statuses] : undefined;
  const tags = opts.tags?.length ? [...opts.tags] : undefined;

  const { data, error } = await client.rpc("search_projects", {
    p_q: q,
    p_status: statuses,
    p_tags: tags,
    p_limit: opts.limit ?? SEARCH_PROJECT_LIMIT,
  });
  if (error) throw error;

  const rows = data ?? [];
  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      tagline: r.tagline ?? null,
      cover_image_path: r.cover_image_path ?? null,
      status: r.status,
      upvote_count: r.upvote_count,
      comment_count: r.comment_count,
      view_count: r.view_count,
      published_at: r.published_at ?? null,
      author: (r.author as SearchProjectHit["author"] | null) ?? {
        username: null,
        display_name: null,
        avatar_url: null,
      },
      tags: (r.tags as SearchProjectHit["tags"] | null) ?? [],
    })),
    total: rows[0]?.total ?? 0,
  };
}

/**
 * People search across username, display name, and headline.
 *
 * Trigram-indexed substring match rather than FTS: names are not English prose
 * (stemming "Menon" or "renlin" helps nobody) and users expect a partial handle
 * to match. The term is escaped server-side by `like_escape` — without that a
 * query containing `%` matches every profile and one containing `_` silently
 * matches an extra character, the same trap that makes `.ilike()` the wrong
 * tool for username availability checks.
 */
export async function searchPeople(
  client: Client,
  opts: { q: string; limit?: number },
): Promise<SearchResult<PersonHit>> {
  const q = opts.q.trim();
  if (!q) return empty();

  const { data, error } = await client.rpc("search_people", {
    p_q: q,
    p_limit: opts.limit ?? SEARCH_PEOPLE_LIMIT,
  });
  if (error) throw error;

  const rows = data ?? [];
  return {
    items: rows
      .filter((r) => !!r.username)
      .map((r) => ({
        id: r.id,
        username: r.username,
        display_name: r.display_name ?? null,
        avatar_url: r.avatar_url ?? null,
        headline: r.headline ?? null,
        follower_count: r.follower_count,
      })),
    total: rows[0]?.total ?? 0,
  };
}

/**
 * Tag search, doubling as the tag directory: an empty query returns the
 * most-used tags, which is what the search screen shows before anyone types.
 * Unlike the other two, this one is meaningful with no query at all.
 *
 * Distinct from `searchTags` in `projects.ts`, which is the composer's tag
 * picker — that one is restricted to `kind = 'tech'` and returns tag ids so a
 * new tag can be created inline. This one is a public browse surface: any
 * kind, no ids, and it links to `/tag/[slug]`.
 */
export async function searchTagDirectory(
  client: Client,
  opts: { q?: string; limit?: number } = {},
): Promise<SearchResult<TagHit>> {
  const { data, error } = await client.rpc("search_tags", {
    p_q: (opts.q ?? "").trim(),
    p_limit: opts.limit ?? SEARCH_TAG_LIMIT,
  });
  if (error) throw error;

  const rows = data ?? [];
  return {
    items: rows.map((r) => ({ slug: r.slug, name: r.name, usage_count: r.usage_count })),
    total: rows[0]?.total ?? 0,
  };
}
