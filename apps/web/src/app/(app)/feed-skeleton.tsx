/** Matches the shimmer skeleton in `CoBuild.dc.html`'s `feedLoading` branch. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-[18px]">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]"
        >
          <div className="aspect-[16/10] animate-pulse bg-[var(--color-bg-panel-alt)]" />
          <div className="flex flex-col gap-3 p-[17px]">
            <div className="h-4 w-1/2 animate-pulse rounded-sm bg-[var(--color-bg-raised)]" />
            <div className="h-3 w-3/4 rounded-sm bg-[var(--color-bg-panel-alt)]" />
            <div className="flex gap-1.5">
              <div className="h-5 w-14 rounded-sm bg-[var(--color-bg-panel-alt)]" />
              <div className="h-5 w-[74px] rounded-sm bg-[var(--color-bg-panel-alt)]" />
              <div className="h-5 w-12 rounded-sm bg-[var(--color-bg-panel-alt)]" />
            </div>
            <div className="flex gap-2 border-t border-[var(--color-border-subtle)] pt-2">
              <div className="h-9 w-[92px] rounded-[var(--radius-control)] bg-[var(--color-bg-panel-alt)]" />
              <div className="h-9 w-[74px] rounded-[var(--radius-control)] bg-[var(--color-bg-panel-alt)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
