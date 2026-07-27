"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LOGIN_PATH } from "@/lib/auth/redirects";

/**
 * Two "not following" treatments per `CoBuild.dc.html`, deliberately
 * different by context — not a bug, matches the design exactly:
 *   - "accent" (green): the profile page's `scProfile`, where Follow is the
 *     primary action on the page.
 *   - "light" (off-white): the project detail page's `scDetail` sidebar,
 *     where the green Upvote button up top is already the primary CTA, so
 *     Follow here is intentionally secondary.
 * The "already following" state is identical in both contexts.
 */
export function FollowButton({
  profileId,
  viewerId,
  initialFollowing,
  variant = "accent",
}: {
  profileId: string;
  /** `null` when signed out. */
  viewerId: string | null;
  initialFollowing: boolean;
  variant?: "accent" | "light";
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (!viewerId) {
      router.push(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (pending) return;

    const next = !following;
    setFollowing(next); // optimistic
    setPending(true);

    const supabase = createClient();
    const { error } = next
      ? await supabase.from("follows").insert({ follower_id: viewerId, following_id: profileId })
      : await supabase
          .from("follows")
          .delete()
          .eq("follower_id", viewerId)
          .eq("following_id", profileId);

    setPending(false);
    if (error) {
      setFollowing(!next); // revert
      return;
    }
    // Refresh so the header's follower_count (a Server Component read) catches up.
    startTransition(() => router.refresh());
  }

  if (following) {
    return (
      <Button
        type="button"
        onClick={toggle}
        variant="outline"
        className={`rounded-[var(--radius-control)] border-[var(--color-border-strong)] bg-[var(--color-bg-panel-alt)] px-5 py-2.5 text-[13.5px] font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)] ${variant === "light" ? "w-full" : ""}`}
      >
        Following
      </Button>
    );
  }

  if (variant === "light") {
    return (
      <Button
        type="button"
        onClick={toggle}
        className="w-full rounded-[var(--radius-control)] bg-[var(--color-text-primary)] px-5 py-2.5 text-[13.5px] font-bold text-[var(--color-bg-page)] hover:bg-white"
      >
        Follow
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={toggle}
      className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-2.5 text-[13.5px] font-bold text-[var(--color-accent-on)] shadow-[0_8px_20px_rgba(59,227,143,0.3)] hover:bg-[var(--color-accent-hover)]"
    >
      Follow
    </Button>
  );
}
