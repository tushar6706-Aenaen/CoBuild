"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LOGIN_PATH } from "@/lib/auth/redirects";
import { useToast } from "@/components/ui/toast";

/**
 * The "Follow tag" button from `CoBuild.dc.html`, which shipped as a no-op
 * until `tag_follows` existed — the design called for it, but rendering a dead
 * control was the worse option, so it was left out until now.
 *
 * Deliberately a near-copy of `FollowButton` rather than a shared abstraction:
 * the two differ in table, key columns, optimistic count, and copy, and the
 * only thing they'd actually share is the try/catch shape. Wrapping that in a
 * generic hook costs more than it saves at two call sites.
 */
export function FollowTagButton({
  tagId,
  tagName,
  viewerId,
  initialFollowing,
  initialCount,
}: {
  tagId: string;
  tagName: string;
  /** `null` when signed out. */
  viewerId: string | null;
  initialFollowing: boolean;
  initialCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!viewerId) {
      router.push(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (pending) return;

    const next = !following;
    setFollowing(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setPending(true);

    const supabase = createClient();
    // A transport-level failure rejects rather than returning `{ error }`;
    // both paths have to reach the rollback. See vote-button.tsx for the note.
    let failed = false;
    try {
      const { error } = next
        ? await supabase.from("tag_follows").insert({ profile_id: viewerId, tag_id: tagId })
        : await supabase
            .from("tag_follows")
            .delete()
            .eq("profile_id", viewerId)
            .eq("tag_id", tagId);
      failed = !!error;
    } catch {
      failed = true;
    }

    setPending(false);
    if (failed) {
      setFollowing(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast("Couldn't update the stacks you follow. Check your connection and try again.", "danger");
      return;
    }
    // The follower count in the header is a Server Component read, and the
    // Following feed's contents change too — refresh rather than trust the
    // optimistic number alone.
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2.5">
      <Button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-busy={pending}
        aria-pressed={following}
        variant={following ? "outline" : "default"}
        className={
          following
            ? "rounded-[var(--radius-control)] border-[var(--color-border-strong)] bg-[var(--color-bg-panel-alt)] px-5 py-2.5 text-[13.5px] font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
            : "rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-2.5 text-[13.5px] font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)]"
        }
      >
        {following ? "Following" : `Follow ${tagName}`}
      </Button>
      <span className="text-[12px] text-[var(--color-text-tertiary)]">
        {count.toLocaleString()} {count === 1 ? "follower" : "followers"}
      </span>
    </div>
  );
}
