import { FeedSkeleton } from "./feed-skeleton";
import { LoadingLabel } from "@/components/shell/skeleton";

/**
 * Fallback for the feed. Also the boundary any nested route inherits when it
 * has no `loading.tsx` of its own, which is why it renders the feed shape —
 * the feed is by far the most-visited route under this segment.
 */
export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading projects</LoadingLabel>
      <div aria-hidden className="flex items-start gap-7">
        <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
          <div className="h-[52px] w-[334px] max-w-full rounded-[7px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]" />
          <FeedSkeleton />
        </div>
      </div>
    </>
  );
}
