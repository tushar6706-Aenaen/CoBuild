import { LoadingLabel, SkeletonBar, SkeletonBlock } from "@/components/shell/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingLabel>Searching</LoadingLabel>
      <div aria-hidden className="flex max-w-[860px] flex-col gap-5">
        <SkeletonBlock className="h-[54px] w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBar key={i} className="h-[30px] w-[86px]" />
          ))}
        </div>
        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-2 xl:gap-[18px]">
          <SkeletonBar className="h-[360px]" />
          <SkeletonBar className="h-[360px]" />
        </div>
      </div>
    </>
  );
}
