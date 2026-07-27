import type { Metadata } from "next";
import { getFeedPage, getViewerVoteState, type FeedTab, type TopWindow } from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/session";
import { ProjectCard, type ProjectCardData } from "@/components/project/project-card";
import { FeedTabs, FEED_TABS } from "./feed-tabs";
import { FeedEmpty } from "./feed-empty";
import { FeedLoadMore } from "./feed-load-more";
import { FeedSidebar } from "./feed-sidebar";

export const metadata: Metadata = {
  title: "CoBuild — Post what you built",
};

const TAB_KEYS = new Set(FEED_TABS.map((t) => t.key));
const WINDOW_KEYS = new Set(["today", "week", "month", "all"]);

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; window?: string }>;
}) {
  const { tab: rawTab, window: rawWindow } = await searchParams;
  const tab: FeedTab = TAB_KEYS.has(rawTab as FeedTab) ? (rawTab as FeedTab) : "hot";
  const topWindow: TopWindow = WINDOW_KEYS.has(rawWindow as TopWindow)
    ? (rawWindow as TopWindow)
    : "week";

  const supabase = await createClient();
  const { user: viewer } = await getAuthState();

  const { items, nextCursor } = await getFeedPage(supabase, {
    tab,
    window: topWindow,
    viewerId: viewer?.id ?? null,
  });

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
        <FeedTabs tab={tab} window={topWindow} />

        {items.length === 0 ? (
          <FeedEmpty tab={tab} signedIn={!!viewer} />
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
              window={topWindow}
              viewerId={viewer?.id ?? null}
              initialCursor={nextCursor}
              initialVoteState={voteState}
            />
          </div>
        )}
      </div>

      <FeedSidebar />
    </div>
  );
}
