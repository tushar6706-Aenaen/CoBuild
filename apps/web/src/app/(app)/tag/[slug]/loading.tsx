import { LoadingLabel, SkeletonBar } from "@/components/shell/skeleton";
import { FeedSkeleton } from "../../feed-skeleton";

export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading tag</LoadingLabel>
      <div aria-hidden className="flex items-start gap-7">
        <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
          <div
            className="flex items-center gap-3.5 rounded-[var(--radius-card)] border p-[18px]"
            style={{
              background: "linear-gradient(140deg, rgba(59,227,143,0.16), rgba(59,227,143,0.03))",
              borderColor: "rgba(59,227,143,0.24)",
            }}
          >
            <div className="h-[52px] w-[52px] flex-none animate-pulse rounded-[8px] bg-[var(--color-bg-panel-alt)]" />
            <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
              <SkeletonBar className="h-[21px] w-[140px]" />
              <SkeletonBar className="h-3 w-[180px]" />
            </div>
          </div>

          <SkeletonBar className="h-9 w-[220px] rounded-[7px]" />

          <FeedSkeleton />
        </div>

        <div className="sticky top-[82px] hidden w-[296px] flex-none flex-col gap-3 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-[17px] lg:flex">
          <SkeletonBar className="h-3.5 w-[110px]" />
          <div className="flex flex-wrap gap-[7px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBar key={i} className="h-[26px] w-[70px] rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
