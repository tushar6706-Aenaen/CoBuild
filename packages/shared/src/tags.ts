import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

export type TagSummary = { slug: string; name: string; usage_count: number };
export type RelatedTag = TagSummary & { shared: number };

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
    .select("slug, name, usage_count")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
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
