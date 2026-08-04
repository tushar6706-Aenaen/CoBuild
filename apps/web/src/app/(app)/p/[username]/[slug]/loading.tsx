import { LoadingLabel, SkeletonBar } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading project</LoadingLabel>
      <div aria-hidden className="flex flex-col gap-[22px]">
        <SkeletonBar className="h-[15px] w-[90px]" />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-[22px]">
            <div className="flex flex-col gap-2.5">
              <SkeletonBar className="h-5 w-[130px] rounded-full" />
              <SkeletonBar className="h-[29px] w-[70%] animate-pulse" />
              <SkeletonBar className="h-4 w-[55%]" />
            </div>

            <div className="animate-pulse overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel-alt)]">
              <div className="aspect-[16/10] bg-[var(--color-bg-raised)]" />
            </div>

            <div className="flex items-center gap-2.5 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-3.5">
              <SkeletonBar className="h-11 w-[92px] rounded-[var(--radius-control)]" />
              <SkeletonBar className="h-11 w-[110px] rounded-[var(--radius-control)]" />
              <div className="flex-1" />
              <SkeletonBar className="h-11 w-11 rounded-[var(--radius-control)]" />
              <SkeletonBar className="h-11 w-11 rounded-[var(--radius-control)]" />
            </div>

            <div className="flex flex-col gap-3.5">
              <SkeletonBar className="h-[19px] w-[180px]" />
              <SkeletonBar className="h-3.5 w-full" />
              <SkeletonBar className="h-3.5 w-full" />
              <SkeletonBar className="h-3.5 w-2/3" />
            </div>
          </div>

          <aside className="flex min-w-0 flex-col gap-3.5">
            <div className="flex flex-col gap-3.5 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-[18px]">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 flex-none animate-pulse rounded-full bg-[var(--color-bg-raised)]" />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <SkeletonBar className="h-3.5 w-[110px]" />
                  <SkeletonBar className="h-3 w-[80px]" />
                </div>
              </div>
              <SkeletonBar className="h-9 w-full rounded-[var(--radius-control)]" />
            </div>

            <div className="flex flex-col gap-2.5 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-[18px]">
              <SkeletonBar className="h-3.5 w-[90px]" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <SkeletonBar className="h-3 w-[60px]" />
                  <SkeletonBar className="h-3 w-[30px]" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
