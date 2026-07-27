"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LOGIN_PATH } from "@/lib/auth/redirects";

export function BookmarkButton({
  projectId,
  viewerId,
  initialBookmarked,
}: {
  projectId: string;
  viewerId: string | null;
  initialBookmarked: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialBookmarked);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!viewerId) {
      router.push(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (pending) return;

    const next = !saved;
    setSaved(next);
    setPending(true);

    const supabase = createClient();
    const { error } = next
      ? await supabase.from("bookmarks").insert({ project_id: projectId, profile_id: viewerId })
      : await supabase
          .from("bookmarks")
          .delete()
          .eq("project_id", projectId)
          .eq("profile_id", viewerId);

    setPending(false);
    if (error) {
      setSaved(!next);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove bookmark" : "Bookmark"}
      title={saved ? "Bookmarked" : "Bookmark"}
      className={
        saved
          ? "flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/12 text-[var(--color-accent-muted)]"
          : "flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
      }
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
        <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />
      </svg>
    </button>
  );
}
