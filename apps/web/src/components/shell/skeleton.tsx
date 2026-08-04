/**
 * Skeleton primitives shared by every route's `loading.tsx`.
 *
 * Only the largest block on each screen pulses. A page where every bar
 * animates independently reads as noise rather than as loading, and the
 * pulse is what carries the "this is not real content yet" signal — so it is
 * spent on the one element the eye lands on first.
 *
 * These are decorative: each `loading.tsx` marks its wrapper `aria-hidden`
 * and carries a single visually-hidden status message instead, so a screen
 * reader hears "Loading" once rather than reading out a tree of empty boxes.
 */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`rounded-sm bg-[var(--color-bg-panel-alt)] ${className}`} />;
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-card)] bg-[var(--color-bg-panel-alt)] ${className}`} />;
}

/** Announces loading to assistive tech without rendering anything visible. */
export function LoadingLabel({ children = "Loading" }: { children?: string }) {
  return (
    <span role="status" className="sr-only">
      {children}
    </span>
  );
}

/** A stack of list rows — notifications, leaderboard, search people. */
export function SkeletonRows({ count = 6, height = "h-[68px]" }: { count?: number; height?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${height} rounded-[8px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]`}
        />
      ))}
    </div>
  );
}

/** A 2-col grid of tile-shaped cards — matches `ProjectTileCard` (bookmarks, profile tabs). */
export function SkeletonTileGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)]"
        >
          <div className="aspect-[16/10] animate-pulse bg-[var(--color-bg-raised)]" />
          <div className="flex flex-col gap-2.5 p-4">
            <SkeletonBar className="h-4 w-2/3" />
            <SkeletonBar className="h-3 w-full" />
            <div className="flex gap-1.5">
              <SkeletonBar className="h-5 w-14" />
              <SkeletonBar className="h-5 w-[70px]" />
            </div>
            <div className="flex gap-3 border-t border-[var(--color-border-subtle)] pt-2.5">
              <SkeletonBar className="h-3 w-16" />
              <SkeletonBar className="h-3 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
