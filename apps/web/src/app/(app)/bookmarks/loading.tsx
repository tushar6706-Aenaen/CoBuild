import { LoadingLabel, SkeletonBar, SkeletonTileGrid } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading bookmarks</LoadingLabel>
      <div aria-hidden className="flex max-w-[860px] flex-col gap-[18px]">
        <SkeletonBar className="h-[26px] w-[160px] animate-pulse" />
        <SkeletonTileGrid />
      </div>
    </>
  );
}
