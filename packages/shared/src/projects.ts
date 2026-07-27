import type { Database, SupabaseClient } from "@cobuild/db";
import { uniqueSlug } from "./slug";
import type { ProjectDraft } from "./project-schema";

type Client = SupabaseClient<Database>;

/** Slugs already used by this author, for `uniqueSlug` collision avoidance. */
export async function getAuthorSlugs(client: Client, authorId: string): Promise<string[]> {
  const { data, error } = await client.from("projects").select("slug").eq("author_id", authorId);
  if (error) throw error;
  return data.map((r) => r.slug);
}

export type TagOption = { id: string; slug: string; name: string; usage_count: number };

/** Type-ahead for the tech-stack picker. */
export async function searchTags(client: Client, query: string, limit = 8): Promise<TagOption[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await client
    .from("tags")
    .select("id, slug, name, usage_count")
    .eq("kind", "tech")
    // `%` and `_` are LIKE wildcards; escape so a user typing them doesn't
    // silently match everything.
    .ilike("name", `%${trimmed.replace(/[%_\\]/g, "\\$&")}%`)
    .order("usage_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Finds an existing tag by slug or creates it. Tag creation is open to any
 * authenticated user (like GitHub topics); the DB CHECK enforces slug format.
 */
export async function findOrCreateTag(client: Client, name: string): Promise<TagOption> {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (!slug) throw new Error("Tag name is empty.");

  const { data: existing, error: findError } = await client
    .from("tags")
    .select("id, slug, name, usage_count")
    .eq("slug", slug)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await client
    .from("tags")
    .insert({ slug, name: name.trim(), kind: "tech" })
    .select("id, slug, name, usage_count")
    .single();
  // Another client may have created the same tag between our lookup and insert.
  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await client
        .from("tags")
        .select("id, slug, name, usage_count")
        .eq("slug", slug)
        .single();
      if (raced) return raced;
    }
    throw error;
  }
  return data;
}

export type CollaboratorOption = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/** Username type-ahead for crediting co-builders. */
export async function searchProfiles(
  client: Client,
  query: string,
  excludeId: string,
  limit = 6,
): Promise<CollaboratorOption[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .not("username", "is", null)
    .neq("id", excludeId)
    .ilike("username", `%${trimmed.replace(/[%_\\]/g, "\\$&")}%`)
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Creates or updates a project plus its images, tags and collaborators.
 *
 * Child rows are replaced wholesale (delete-then-insert) rather than diffed:
 * the sets are tiny (<= 8 images, a handful of tags/credits) and a diff would
 * be far more code for no user-visible gain.
 *
 * Never writes `upvote_count`/`hot_score`/`search_tsv`/etc — those are
 * trigger-maintained and client writes to them are discarded (PROJECT_INFO).
 */
export async function saveProject(
  client: Client,
  authorId: string,
  draft: ProjectDraft,
  opts: { isNew: boolean; existingSlug?: string },
): Promise<{ id: string; slug: string }> {
  const takenSlugs = await getAuthorSlugs(client, authorId);
  const slug = uniqueSlug(draft.title, takenSlugs, opts.existingSlug);

  const cover = draft.images[draft.coverIndex] ?? draft.images[0] ?? null;

  const row = {
    id: draft.id,
    author_id: authorId,
    slug,
    title: draft.title.trim(),
    tagline: draft.tagline.trim() || null,
    description: draft.description || null,
    live_url: draft.liveUrl.trim() || null,
    repo_url: draft.repoUrl.trim() || null,
    status: draft.status,
    visibility: draft.visibility,
    cover_image_path: cover?.storagePath ?? null,
    // Set once, when it first becomes publicly visible — this is what the feed
    // ranks on, so re-publishing an edit must not reset it to "brand new".
    ...(draft.visibility !== "draft" && opts.isNew
      ? { published_at: new Date().toISOString() }
      : {}),
  };

  if (opts.isNew) {
    const { error } = await client.from("projects").insert(row);
    if (error) throw error;
  } else {
    const { error } = await client
      .from("projects")
      .update(row)
      .eq("id", draft.id)
      .eq("author_id", authorId);
    if (error) throw error;

    // A draft being published for the first time has no published_at yet.
    if (draft.visibility !== "draft") {
      const { data: current } = await client
        .from("projects")
        .select("published_at")
        .eq("id", draft.id)
        .maybeSingle();
      if (current && current.published_at === null) {
        await client
          .from("projects")
          .update({ published_at: new Date().toISOString() })
          .eq("id", draft.id)
          .eq("author_id", authorId);
      }
    }

    await Promise.all([
      client.from("project_images").delete().eq("project_id", draft.id),
      client.from("project_tags").delete().eq("project_id", draft.id),
      client.from("project_collaborators").delete().eq("project_id", draft.id),
    ]);
  }

  if (draft.images.length > 0) {
    const { error } = await client.from("project_images").insert(
      draft.images.map((img, index) => ({
        project_id: draft.id,
        storage_path: img.storagePath,
        alt: img.alt.trim() || null,
        caption: img.caption?.trim() || null,
        width: img.width,
        height: img.height,
        position: index,
      })),
    );
    if (error) throw error;
  }

  if (draft.tagIds.length > 0) {
    const { error } = await client
      .from("project_tags")
      .insert(draft.tagIds.map((tagId) => ({ project_id: draft.id, tag_id: tagId })));
    if (error) throw error;
  }

  if (draft.collaborators.length > 0) {
    const { error } = await client.from("project_collaborators").insert(
      draft.collaborators.map((c, index) => ({
        project_id: draft.id,
        profile_id: c.profileId,
        invited_name: c.invitedName,
        role_label: c.roleLabel.trim() || null,
        // Credits are self-accepted for now; an invite/accept flow is a later
        // phase. The column exists so that flow needs no migration.
        status: "accepted",
        position: index,
      })),
    );
    if (error) throw error;
  }

  return { id: draft.id, slug };
}

export async function deleteProject(client: Client, projectId: string, authorId: string) {
  const { error } = await client
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("author_id", authorId);
  if (error) throw error;
}
