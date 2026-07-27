import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboardBuilders, transformedStorageUrl } from "@cobuild/shared";
import { storageUrl } from "@/lib/storage-url";

type TrendingTag = { slug: string; name: string; usage_count: number };

/**
 * Right rail: trending stacks, top builders, and a post CTA — per
 * `CoBuild.dc.html`'s `scFeed` aside. Desktop only (`lg:flex`); the design
 * drops this column entirely below that breakpoint rather than stacking it.
 */
export async function FeedSidebar() {
  const supabase = await createClient();

  const [{ data: tags }, builders] = await Promise.all([
    supabase
      .from("tags")
      .select("slug, name, usage_count")
      .eq("kind", "tech")
      .gt("usage_count", 0)
      .order("usage_count", { ascending: false })
      .limit(8),
    // Now genuinely "this week": the Phase 4 stand-in ranked by the lifetime
    // `total_upvotes_received` counter, which made the heading a lie for
    // anyone whose best work shipped a year ago. This reads the same
    // materialized board `/leaderboard` shows, so the rail and the board can
    // never disagree.
    getLeaderboardBuilders(supabase, { window: "week", limit: 4 }),
  ]);

  const trending = (tags ?? []) as TrendingTag[];
  const topBuilders = builders.rows;

  return (
    <aside className="sticky top-[82px] hidden w-[296px] flex-none flex-col gap-4 lg:flex">
      {trending.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-[17px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold">Trending stacks</span>
            <Link href="/search" className="text-xs">
              All
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trending.map((t) => (
              <Link
                key={t.slug}
                href={`/tag/${t.slug}`}
                className="flex items-center gap-1.5 rounded-sm bg-[var(--color-bg-raised)] px-2 py-1.5 font-mono text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/[0.16] hover:text-[var(--color-accent-muted-strong)]"
              >
                {t.name}
                <span className="text-[var(--color-text-tertiary)]">{t.usage_count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {topBuilders.length > 0 && (
        <div className="flex flex-col gap-[13px] rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-[17px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold">Top builders this week</span>
            <Link href="/leaderboard" className="text-xs">
              Board
            </Link>
          </div>
          <div className="flex flex-col gap-[11px]">
            {topBuilders.map((b) => {
              const avatarBase = storageUrl(b.avatar_url, "avatars");
              const avatar = avatarBase
                ? transformedStorageUrl(avatarBase, { width: 56, height: 56, fit: "cover" })
                : null;
              return (
                <Link
                  key={b.username}
                  href={`/u/${b.username}`}
                  className="flex items-center gap-2.5"
                >
                  <span className="w-3.5 font-mono text-[11.5px] text-[var(--color-text-tertiary)]">
                    {b.rank}
                  </span>
                  <span className="h-7 w-7 flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)]">
                    {avatar && (
                      <Image src={avatar} alt="" width={28} height={28} unoptimized className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[12.5px] font-semibold text-[var(--color-text-primary)]">
                      {b.display_name ?? b.username}
                    </span>
                    <span className="truncate font-mono text-[10.5px] text-[var(--color-text-tertiary)]">
                      @{b.username}
                    </span>
                  </span>
                  <span className="font-mono text-[11.5px] text-[var(--color-accent-muted)]">
                    {b.votes}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div
        className="flex flex-col gap-2.5 rounded-[9px] border p-[17px]"
        style={{
          background: "linear-gradient(150deg, rgba(59,227,143,0.18), rgba(59,227,143,0.04))",
          borderColor: "rgba(59,227,143,0.25)",
        }}
      >
        <span className="text-[13.5px] font-bold">Built something this term?</span>
        <span className="text-[12.5px] leading-snug text-[var(--color-text-secondary)]">
          Post it with screenshots and credit your teammates.
        </span>
        <Link
          href="/new"
          className="rounded-[var(--radius-control)] bg-[var(--color-accent)] py-2.5 text-center text-[13px] font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)]"
        >
          Post a project
        </Link>
      </div>
    </aside>
  );
}
