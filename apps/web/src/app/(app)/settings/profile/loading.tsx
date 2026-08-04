import { LoadingLabel, SkeletonBar } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading settings</LoadingLabel>
      <div aria-hidden className="flex w-full max-w-[560px] flex-col items-center gap-8">
        <div className="flex w-full flex-col items-center gap-5">
          <div className="h-[92px] w-[92px] animate-pulse rounded-full bg-[var(--color-bg-panel-alt)]" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex w-full flex-col gap-1.5">
              <SkeletonBar className="h-3 w-[90px]" />
              <SkeletonBar className={`h-11 w-full rounded-[var(--radius-control)] ${i === 0 ? "animate-pulse" : ""}`} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
