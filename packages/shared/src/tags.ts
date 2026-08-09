import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

export type TagSummary = {
  id: string;
  slug: string;
  name: string;
  usage_count: number;
  follower_count: number;
};
export type RelatedTag = Omit<TagSummary, "id" | "follower_count"> & { shared: number };

/**
 * Header data for `/tag/[slug]`. Returns null for an unknown slug so the route
 * can `notFound()` — a tag page that renders an empty feed under a made-up
 * heading is worse than a 404, since it looks like a real but deserted stack.
 *
 * `usage_count` is trigger-maintained from `project_tags` and counts every
 * project carrying the tag, including unlisted and draft ones, so it can read
 * higher than the number of projects the feed below it shows. That is the
 * right trade: making it match would mean recomputing per request.
 */
export async function getTagBySlug(client: Client, slug: string): Promise<TagSummary | null> {
  const { data, error } = await client
    .from("tags")
    .select("id, slug, name, usage_count, follower_count")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Whether `viewerId` follows `tagId`. Mirrors `isFollowing` for people.
 *
 * `tag_follows` is world-readable (same as `follows`), so this is a plain
 * primary-key probe rather than anything RLS-sensitive — the write side is
 * what's restricted to the owner.
 */
export async function isFollowingTag(
  client: Client,
  viewerId: string,
  tagId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("tag_follows")
    .select("tag_id")
    .eq("profile_id", viewerId)
    .eq("tag_id", tagId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * The stacks a viewer follows, newest first — served by
 * `tag_follows_profile_idx` as an ordered index scan.
 *
 * Used to tell someone with an empty Following feed what they've actually
 * followed, which is the difference between "nobody has posted" and "you
 * follow nothing".
 */
export async function getFollowedTags(
  client: Client,
  viewerId: string,
  limit = 24,
): Promise<Pick<TagSummary, "slug" | "name">[]> {
  const { data, error } = await client
    .from("tag_follows")
    .select("created_at, tag:tags!tag_follows_tag_id_fkey(slug, name)")
    .eq("profile_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.tag)
    .filter((t): t is { slug: string; name: string } => !!t);
}

/**
 * Stacks that co-occur with this one on public, published projects, most-shared
 * first — the "Related stacks" rail on the tag page.
 */
export async function getRelatedTags(
  client: Client,
  slug: string,
  limit = 8,
): Promise<RelatedTag[]> {
  const { data, error } = await client.rpc("related_tags", { p_slug: slug, p_limit: limit });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    usage_count: r.usage_count,
    shared: r.shared,
  }));
}
