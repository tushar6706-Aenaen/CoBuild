"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { transformedStorageUrl } from "@cobuild/shared";

type AuthorSummary = {
  display_name: string | null;
  headline: string | null;
  avatar_url: string | null;
  project_count: number;
  follower_count: number;
};

/**
 * The dashed-underline author handle plus its hover mini-card, per
 * `ProjectCard.dc.html`. The profile lookup is deferred until first hover and
 * cached per-instance — fetching it eagerly for every card would mean N extra
 * round trips to render a feed page where most cards are never hovered.
 */
export function AuthorHoverCard({
  username,
  avatarUrl,
  timeAgo,
}: {
  username: string | null;
  /** Already-transformed URL for the small inline avatar. */
  avatarUrl: string | null;
  timeAgo: string;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<AuthorSummary | null>(null);
  const fetched = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  async function handleEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
    if (fetched.current || !username) return;
    fetched.current = true;

    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("display_name, headline, avatar_url, project_count, follower_count")
      .eq("username", username)
      .maybeSingle<AuthorSummary>();
    if (data) setSummary(data);
  }

  function handleLeave() {
    // Small grace period so moving the pointer into the card doesn't close it.
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  if (!username) {
    return <span className="text-[13px] font-semibold text-[var(--color-text-tertiary)]">[deleted]</span>;
  }

  const cardAvatar = summary?.avatar_url
    ? transformedStorageUrl(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${summary.avatar_url}`,
        { width: 42, height: 42, fit: "cover" },
      )
    : null;

  return (
    <span className="relative flex items-center gap-2.5">
      <span className="h-[26px] w-[26px] flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)]">
        {avatarUrl && (
          <Image src={avatarUrl} alt="" width={26} height={26} unoptimized className="h-full w-full object-cover" />
        )}
      </span>

      <Link
        href={`/u/${username}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={(e) => e.stopPropagation()}
        className="border-b border-dashed border-[var(--color-border-strong)] text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        @{username}
      </Link>
      <span className="text-xs text-[var(--color-text-placeholder)]">·</span>
      <span className="text-[12.5px] text-[var(--color-text-tertiary)]">{timeAgo}</span>

      {open && (
        <span
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className="absolute bottom-[30px] left-0 z-40 flex w-[268px] flex-col gap-2.5 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-bg-raised)] p-[15px] shadow-[0_20px_44px_rgba(0,0,0,0.6)]"
        >
          <span className="flex items-center gap-2.5">
            <span className="h-[42px] w-[42px] flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-panel-alt)_0_4px,var(--color-bg-panel)_4px_8px)]">
              {cardAvatar && (
                <Image src={cardAvatar} alt="" width={42} height={42} unoptimized className="h-full w-full object-cover" />
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-px">
              <span className="text-sm font-bold text-[var(--color-text-primary)]">
                {summary?.display_name ?? username}
              </span>
              <span className="font-mono text-[11px] text-[var(--color-accent)]">@{username}</span>
            </span>
          </span>
          {summary?.headline && (
            <span className="text-[12.5px] leading-snug text-[var(--color-text-secondary-alt)]">
              {summary.headline}
            </span>
          )}
          <span className="flex gap-3.5 font-mono text-[11.5px] text-[var(--color-text-secondary)]">
            <span>
              <b className="text-[var(--color-text-primary)]">{summary?.project_count ?? 0}</b> projects
            </span>
            <span>
              <b className="text-[var(--color-text-primary)]">{summary?.follower_count ?? 0}</b> followers
            </span>
          </span>
          <Link
            href={`/u/${username}`}
            className="w-full rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] py-2 text-center text-[12.5px] font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-panel-alt)]"
          >
            View profile
          </Link>
        </span>
      )}
    </span>
  );
}
