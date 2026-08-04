"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LOGIN_PATH } from "@/lib/auth/redirects";
import { useToast } from "@/components/ui/toast";

/**
 * Optimistic upvote toggle, translated from `ProjectCard.dc.html`'s vote
 * behaviour: the count must move instantly, then reconcile. Signed-out clicks
 * route to sign-in rather than silently failing.
 *
 * `size="lg"` is the detail-page treatment; `sm` is the card treatment.
 */
export function VoteButton({
  projectId,
  viewerId,
  initialVoted,
  initialCount,
  size = "sm",
}: {
  projectId: string;
  viewerId: string | null;
  initialVoted: boolean;
  initialCount: number;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const toast = useToast();
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  async function toggle(e: React.MouseEvent) {
    // Cards wrap this in a <Link>; don't navigate when voting.
    e.preventDefault();
    e.stopPropagation();

    if (!viewerId) {
      router.push(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (pending) return;

    const next = !voted;
    setVoted(next);
    setCount((c) => c + (next ? 1 : -1));
    setPending(true);

    const supabase = createClient();
    // Two failure shapes, and both have to land here. PostgREST reports most
    // problems as `{ error }`, but a transport-level failure — offline, DNS,
    // CORS — rejects instead. Handling only the first let the exception escape
    // this function: the optimistic count stayed up showing a vote the server
    // never recorded, `pending` never cleared so the button stuck disabled,
    // and nothing was ever said about it.
    let failed = false;
    try {
      const { error } = next
        ? await supabase.from("votes").insert({ project_id: projectId, profile_id: viewerId })
        : await supabase
            .from("votes")
            .delete()
            .eq("project_id", projectId)
            .eq("profile_id", viewerId);
      failed = !!error;
    } catch {
      failed = true;
    }

    setPending(false);
    if (failed) {
      setVoted(!next);
      setCount((c) => c + (next ? -1 : 1));
      toast("Couldn't save your upvote. Check your connection and try again.", "danger");
      return;
    }
    startTransition(() => router.refresh());
  }

  const large = size === "lg";
  const base = large
    ? "flex items-center gap-2.5 rounded-[var(--radius-control)] px-5 py-3 text-[15px] font-extrabold transition-transform active:scale-95 disabled:opacity-70"
    : "flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-extrabold transition-transform active:scale-95 disabled:opacity-70";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-busy={pending}
      aria-pressed={voted}
      aria-label={voted ? "Remove upvote" : "Upvote"}
      className={
        voted
          ? `${base} border border-transparent bg-[var(--color-accent)] text-[var(--color-accent-on)] shadow-[0_6px_18px_rgba(59,227,143,0.35)]`
          : `${base} border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent-muted)] hover:bg-[var(--color-accent)]/20`
      }
    >
      <svg
        width={large ? 18 : 17}
        height={large ? 18 : 17}
        viewBox="0 0 24 24"
        fill={voted ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2.1}
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 4l8 9h-5v7h-6v-7H4z" />
      </svg>
      <span className="tabular-nums">{count}</span>
      {large && (
        <span className="text-[12.5px] font-semibold opacity-75">{voted ? "Upvoted" : "Upvote"}</span>
      )}
    </button>
  );
}
