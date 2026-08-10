import Link from "next/link";
import { AccountMenu } from "./account-menu";

/**
 * Sticky top bar.
 *
 * The left rail owns orientation — brand, nav, and your account card. This bar
 * owns *action*: find something, post something, see what happened. Without
 * that split the bar had nothing to do on desktop, because the rail already did
 * everything, and it showed: a single stretched field and one icon.
 *
 * The search is a real `<input>` inside a plain GET form, not a link dressed as
 * one. It previously looked exactly like a text field and wasn't — clicking it
 * navigated you to /search instead of letting you type, which is the worst kind
 * of affordance mismatch. A native GET form needs no client JS and still works
 * with JS disabled: submitting lands on /search?q=… , the same URL the search
 * page already reads.
 *
 * The "Post" button is deliberately the *secondary* treatment even though it is
 * a create action — the rail's full-width button is the primary one, and two
 * near-white fills competing on the same screen is what the restyle exists to
 * avoid. Here it reads as a toolbar shortcut.
 */
export function AppHeader({
  username,
  displayName,
  avatarUrl,
  unreadCount,
  signedIn,
}: {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  unreadCount: number;
  signedIn: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[rgb(var(--color-bg-page-rgb)/0.86)] px-5 py-3 backdrop-blur-[14px] print:hidden">
      {/* Compact logo — only when the sidebar is hidden. */}
      <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="CoBuild home">
        <span className="flex h-[27px] w-[27px] items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-accent)] text-[14px] font-extrabold text-[var(--color-accent-on)]">
          C
        </span>
      </Link>

      <form
        action="/search"
        method="get"
        role="search"
        className="flex w-full max-w-[440px] items-center gap-2.5 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3.5 py-2.5 transition-colors focus-within:border-[var(--color-border-strong)] focus-within:ring-2 focus-within:ring-[var(--color-border-default)]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="flex-none text-[var(--color-text-tertiary)]">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="search"
          name="q"
          aria-label="Search projects, people, and tags"
          placeholder="Search projects, people, tags"
          className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13.5px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] [&::-webkit-search-cancel-button]:hidden"
        />
      </form>

      <div className="flex-1" />

      {signedIn ? (
        <>
          <Link
            href="/new"
            className="hidden flex-none items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-row-tint)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)] sm:flex"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Post
          </Link>

          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-10 w-10 flex-none items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-panel-alt)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-[9px] h-2 w-2 rounded-full border-2 border-[var(--color-bg-page)] bg-[var(--color-accent)]" />
            )}
          </Link>

          {/* Shown at every width now. The rail's account card is orientation
              ("who am I signed in as"); this is the reach-anywhere account menu,
              and it gives the bar a right-hand anchor. */}
          {username && (
            <AccountMenu username={username} displayName={displayName} avatarUrl={avatarUrl} />
          )}
        </>
      ) : (
        <Link
          href="/login"
          className="flex-none rounded-[var(--radius-control)] bg-[var(--color-text-primary)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--color-bg-page)] hover:bg-white"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}
