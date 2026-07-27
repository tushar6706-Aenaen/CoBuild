"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getFeedPage,
  getViewerVoteState,
  type FeedTab,
  type TopWindow,
  type FeedCursor,
  type FeedItem,
} from "@cobuild/shared";
import { ProjectCard, type ProjectCardData } from "@/components/project/project-card";

type VoteState = { voted: Set<string>; bookmarked: Set<string> };

function toCardData(item: FeedItem): ProjectCardData {
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

/**
 * Client-side continuation of the feed. The first page is rendered
 * server-side (fast paint, works with JS off); this only takes over once the
 * user scrolls to "load more" — same `getFeedPage` call the server used, run
 * against the browser client, so ranking logic lives in exactly one place.
 */
export function FeedLoadMore({
  tab,
  window,
  viewerId,
  initialCursor,
  initialVoteState,
  tag = null,
}: {
  tab: FeedTab;
  window: TopWindow;
  viewerId: string | null;
  initialCursor: FeedCursor;
  initialVoteState: VoteState;
  /** Scopes continuation to one tag slug — set by `/tag/[slug]`. */
  tag?: string | null;
}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<FeedCursor>(initialCursor);
  const [voteState, setVoteState] = useState(initialVoteState);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  async function loadMore() {
    if (loading || !cursor) return;
    setLoading(true);

    const supabase = createClient();
    const { items: nextItems, nextCursor } = await getFeedPage(supabase, {
      tab,
      window,
      viewerId,
      cursor,
      tag,
    });

    if (viewerId && nextItems.length > 0) {
      const extra = await getViewerVoteState(
        supabase,
        viewerId,
        nextItems.map((i) => i.id),
      );
      setVoteState((prev) => ({
        voted: new Set([...prev.voted, ...extra.voted]),
        bookmarked: new Set([...prev.bookmarked, ...extra.bookmarked]),
      }));
    }

    startTransition(() => {
      setItems((prev) => [...prev, ...nextItems]);
      setCursor(nextCursor);
      setLoading(false);
    });
  }

  return (
    <>
      {items.map((item) => (
        <ProjectCard
          key={item.id}
          project={toCardData(item)}
          viewerId={viewerId}
          voted={voteState.voted.has(item.id)}
          bookmarked={voteState.bookmarked.has(item.id)}
        />
      ))}

      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="flex items-center justify-center gap-2.5 py-6 text-[13px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
        >
          {loading && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" />
          )}
          {loading ? "Loading more projects…" : "Load more"}
        </button>
      )}
    </>
  );
}
