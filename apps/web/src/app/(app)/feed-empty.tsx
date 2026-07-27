import Link from "next/link";

/**
 * Empty-feed copy is per-tab on purpose: "Following is empty" is a very
 * different problem from "nothing shipped this week", and a single generic
 * message would leave the user with no idea what to do next.
 */
export function FeedEmpty({ tab, signedIn }: { tab: string; signedIn: boolean }) {
  const copy =
    tab === "following"
      ? {
          title: signedIn ? "Nothing here yet" : "Sign in to build a feed",
          body: signedIn
            ? "You're not following anyone who has posted. Follow a few builders, or explore what shipped this week."
            : "Follow builders you like and their projects show up here.",
        }
      : tab === "top"
        ? {
            title: "Nothing in this window",
            body: "No projects were upvoted in this time range. Try a wider window.",
          }
        : {
            title: "Nothing here yet",
            body: "No projects have been posted yet. Be the first — it takes about two minutes.",
          };

  return (
    <div className="flex flex-col items-center gap-4 rounded-[11px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-7 py-16 text-center">
      <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[8px] bg-[var(--color-bg-panel-alt)] text-[var(--color-accent)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h10M4 18h7" />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-lg font-bold">{copy.title}</div>
        <div className="max-w-[340px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
          {copy.body}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {tab === "following" && !signedIn ? (
          <Link
            href="/login"
            className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-[17px] py-2.5 text-[13.5px] font-bold text-[var(--color-accent-on)]"
          >
            Sign in
          </Link>
        ) : (
          <Link
            href="/new"
            className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-[17px] py-2.5 text-[13.5px] font-bold text-[var(--color-accent-on)]"
          >
            Post a project
          </Link>
        )}
        {tab !== "hot" && (
          <Link
            href="/"
            className="rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-[17px] py-2.5 text-[13.5px] font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-raised)]"
          >
            See what&rsquo;s hot
          </Link>
        )}
      </div>
    </div>
  );
}
