import { LoadingLabel, SkeletonBar, SkeletonTileGrid } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading profile</LoadingLabel>
      <div aria-hidden className="flex flex-col gap-[22px]">
        <div
          className="flex flex-col gap-[18px] rounded-[11px] border border-[var(--color-border-default)] p-[22px]"
          style={{ background: "linear-gradient(160deg, var(--color-bg-panel-alt), var(--color-bg-panel))" }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="h-[92px] w-[92px] flex-none animate-pulse rounded-full bg-[var(--color-bg-raised)]" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <SkeletonBar className="h-6 w-[220px] animate-pulse" />
              <SkeletonBar className="h-3.5 w-[120px]" />
              <SkeletonBar className="h-3.5 w-[300px]" />
            </div>
            <SkeletonBar className="h-9 w-[120px] rounded-[var(--radius-control)]" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--color-border-subtle)] pt-1 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBar key={i} className="h-[54px] rounded-[7px]" />
            ))}
          </div>
        </div>

        <SkeletonBar className="h-9 w-[240px] rounded-[7px]" />

        <SkeletonTileGrid />
      </div>
    </>
  );
}
