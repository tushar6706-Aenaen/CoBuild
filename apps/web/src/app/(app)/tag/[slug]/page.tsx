import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFeedPage,
  getRelatedTags,
  getTagBySlug,
  getViewerVoteState,
} from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/session";
import { ProjectCard, type ProjectCardData } from "@/components/project/project-card";
import { FeedLoadMore } from "../../feed-load-more";
import { TagTabs, TAG_TAB_KEYS, type TagTab } from "./tag-tabs";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const tag = await getTagBySlug(supabase, slug);
  if (!tag) return { title: "Tag not found — CoBuild" };
  return {
    title: `${tag.name} projects — CoBuild`,
    description: `Projects built with ${tag.name} on CoBuild.`,
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { slug } = await params;
  const { tab: rawTab } = await searchParams;
  const tabParam = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  const tab: TagTab = TAG_TAB_KEYS.has(tabParam ?? "") ? (tabParam as TagTab) : "hot";

  const supabase = await createClient();
  const tag = await getTagBySlug(supabase, slug);
  // 404 rather than an empty feed under an invented heading — a made-up slug
  // would otherwise render as a real but deserted stack.
  if (!tag) notFound();

  const { user: viewer } = await getAuthState();

  const [{ items, nextCursor }, related] = await Promise.all([
    // Top on a tag page has no window selector in the design, so it means
    // "highest scoring, all time, within this tag".
    getFeedPage(supabase, { tab, window: "all", viewerId: viewer?.id ?? null, tag: slug }),
    getRelatedTags(supabase, slug),
  ]);

  const voteState =
    viewer && items.length > 0
      ? await getViewerVoteState(
          supabase,
          viewer.id,
          items.map((i) => i.id),
        )
      : { voted: new Set<string>(), bookmarked: new Set<string>() };

  function toCardData(item: (typeof items)[number]): ProjectCardData {
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      tagline: item.tagline,
      cover_image_path: item.cover_image_path,
      status: item.status,
      upvote_count: item.upvote_count,
      comment_count: item.comment_count,
      view_count: item.view_count,
      published_at: item.published_at,
      author: item.author,
      tags: item.tags,
    };
  }

  return (
    <div className="flex items-start gap-7">
      <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
        <div
          className="flex flex-wrap items-center gap-3.5 rounded-[var(--radius-card)] border p-[18px]"
          style={{
            background:
              "linear-gradient(140deg, rgba(59,227,143,0.16), rgba(59,227,143,0.03))",
            borderColor: "rgba(59,227,143,0.24)",
          }}
        >
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[8px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel-alt)] font-mono text-[19px] text-[var(--color-accent-muted)]">
            #
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <h1 className="font-mono text-[21px] font-medium tracking-[-0.02em]">{tag.name}</h1>
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              <b className="text-[var(--color-text-primary)]">
                {tag.usage_count.toLocaleString()}
              </b>{" "}
              {tag.usage_count === 1 ? "project uses" : "projects use"} this stack
            </p>
          </div>
        </div>

        <TagTabs slug={slug} tab={tab} />

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-7 py-14 text-center">
            <div className="text-lg font-bold">Nothing published with {tag.name} yet</div>
            <div className="max-w-[360px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              Be the first — <Link href="/new">post a project</Link> and tag it {tag.name}.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[18px]">
            {items.map((item) => (
              <ProjectCard
                key={item.id}
                project={toCardData(item)}
                viewerId={viewer?.id ?? null}
                voted={voteState.voted.has(item.id)}
                bookmarked={voteState.bookmarked.has(item.id)}
              />
            ))}
            <FeedLoadMore
              tab={tab}
              window="all"
              viewerId={viewer?.id ?? null}
              initialCursor={nextCursor}
              initialVoteState={voteState}
              tag={slug}
            />
          </div>
        )}
      </div>

      {related.length > 0 && (
        <aside className="sticky top-[82px] hidden w-[296px] flex-none flex-col gap-3 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-[17px] lg:flex">
          <span className="text-[13px] font-bold">Related stacks</span>
          <div className="flex flex-wrap gap-[7px]">
            {related.map((t) => (
              <Link
                key={t.slug}
                href={`/tag/${t.slug}`}
                className="flex items-center gap-1.5 rounded-sm bg-[var(--color-bg-raised)] px-2 py-1.5 font-mono text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/[0.16] hover:text-[var(--color-accent-muted-strong)]"
              >
                {t.name}
                <span className="text-[var(--color-text-tertiary)]">{t.shared}</span>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
