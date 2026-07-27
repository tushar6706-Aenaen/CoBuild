import { LoadingLabel, SkeletonBar, SkeletonRows } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading notifications</LoadingLabel>
      <div aria-hidden className="flex max-w-[720px] flex-col gap-[18px]">
        <SkeletonBar className="h-8 w-[220px] animate-pulse" />
        <SkeletonRows count={6} />
      </div>
    </>
  );
}
