import type { Metadata } from "next";
import Link from "next/link";
import { getProfileBookmarks, publicStorageUrl } from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/lib/auth/session";
import { ProjectTileCard } from "@/app/(app)/u/[username]/project-tile";

export const metadata: Metadata = { title: "Bookmarks — CoBuild" };

/**
 * Standalone nav destination (`scBookmarks` in CoBuild.dc.html) — distinct
 * from the "Bookmarks" tab on your own profile page, which shows the same
 * data but in the profile's context. Both read `getProfileBookmarks`, which
 * is always scoped to the signed-in caller by RLS.
 */
export default async function BookmarksPage() {
  const { user } = await requireOnboardedUser("/bookmarks");

  const supabase = await createClient();
  const tiles = await getProfileBookmarks(supabase, user.id);

  return (
    <div className="flex max-w-[860px] flex-col gap-[18px]">
      <h1 className="text-[26px] font-extrabold tracking-tight">Bookmarks</h1>

      {tiles.length === 0 ? (
        <div className="flex flex-col items-center gap-[15px] rounded-[11px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-7 py-16 text-center">
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[8px] bg-[var(--color-bg-panel-alt)] text-[var(--color-accent)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-lg font-bold">No bookmarks yet</div>
            <div className="max-w-[340px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              Tap the bookmark icon on any project to keep it here. Only you can see this list.
            </div>
          </div>
          <Link
            href="/"
            className="rounded-[6px] bg-[var(--color-accent)] px-[17px] py-[11px] text-[13.5px] font-bold text-[var(--color-accent-on)]"
          >
            Browse the feed
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
          {tiles.map((p) => (
            <ProjectTileCard
              key={p.id}
              project={p}
              cover={publicStorageUrl(supabase, "project-media", p.cover_image_path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
