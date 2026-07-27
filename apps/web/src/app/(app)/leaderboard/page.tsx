import type { Metadata } from "next";
import Link from "next/link";
import {
  getLeaderboardBuilders,
  getLeaderboardProjects,
  type LeaderboardWindow,
} from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { BoardControls, BOARD_TABS, type BoardTab } from "./board-controls";
import { BuilderRows, ProjectRows } from "./board-rows";

export const metadata: Metadata = { title: "Leaderboard — CoBuild" };

const TABS = new Set<string>(BOARD_TABS.map((t) => t.key));

/**
 * How stale the numbers are. The header copy promises a 10-minute refresh, so
 * showing when the board was actually computed is the honest version of that
 * claim — and the quickest way to notice the refresh cron has stopped.
 */
function refreshedAgo(iso: string | null): string {
  if (!iso) return "not computed yet";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "updated just now";
  if (mins < 60) return `updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `updated ${hours}h ago`;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; window?: string | string[] }>;
}) {
  const params = await searchParams;
  // Explicit allowlists, never an `as Tab` cast: Next hands back `string[]`
  // for a repeated param, and an unrecognised value must fall back to the
  // default rather than reach the RPC.
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const rawWindow = Array.isArray(params.window) ? params.window[0] : params.window;
  const tab: BoardTab = TABS.has(rawTab ?? "") ? (rawTab as BoardTab) : "projects";
  const window: LeaderboardWindow = rawWindow === "today" ? "today" : "week";

  const supabase = await createClient();
  // Tagged on fetch so the render below narrows to the right row shape without
  // a cast — the two boards return genuinely different columns.
  const board =
    tab === "builders"
      ? { kind: "builders" as const, ...(await getLeaderboardBuilders(supabase, { window })) }
      : { kind: "projects" as const, ...(await getLeaderboardProjects(supabase, { window })) };

  return (
    <div className="flex max-w-[820px] flex-col gap-5">
      <div className="flex flex-col gap-[7px]">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">Leaderboard</h1>
        <p className="text-[13.5px] text-[var(--color-text-secondary)]">
          Ranked by upvotes received in the selected window. Updates every 10 minutes
          <span className="text-[var(--color-text-tertiary)]">
            {" "}
            — {refreshedAgo(board.computedAt)}
          </span>
          .
        </p>
      </div>

      <BoardControls tab={tab} window={window} />

      {board.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card-lg)] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-7 py-14 text-center">
          <div className="text-lg font-bold">
            No upvotes {window === "today" ? "in the last 24 hours" : "in the last 7 days"}
          </div>
          <div className="max-w-[380px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
            This board counts votes cast inside the window, not a project&apos;s lifetime
            score, so it stays empty until people start voting.{" "}
            {window === "today" ? (
              <>
                Try <Link href={`/leaderboard?tab=${tab}`}>this week</Link>, or browse{" "}
                <Link href="/">the feed</Link>.
              </>
            ) : (
              <>
                Browse <Link href="/">the feed</Link> and upvote something.
              </>
            )}
          </div>
        </div>
      ) : board.kind === "builders" ? (
        <BuilderRows rows={board.rows} />
      ) : (
        <ProjectRows rows={board.rows} />
      )}
    </div>
  );
}
