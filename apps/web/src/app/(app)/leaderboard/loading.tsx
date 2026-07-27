import { LoadingLabel, SkeletonBar } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading the leaderboard</LoadingLabel>
      <div aria-hidden className="flex max-w-[820px] flex-col gap-5">
        <div className="flex flex-col gap-[7px]">
          <SkeletonBar className="h-8 w-[200px] animate-pulse" />
          <SkeletonBar className="h-4 w-[420px] max-w-full" />
        </div>
        <SkeletonBar className="h-[52px] w-[260px]" />
        <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[67px] border-b border-[var(--color-border-subtle)] last:border-b-0" />
          ))}
        </div>
      </div>
    </>
  );
}
