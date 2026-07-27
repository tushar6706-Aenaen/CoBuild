import Image from "next/image";
import Link from "next/link";

/**
 * Sticky top bar. The search field is the dominant element by design — it's a
 * link styled as an input rather than a live input, because search has its own
 * route; the real field lives there.
 */
export function AppHeader({
  username,
  avatarUrl,
  unreadCount,
  signedIn,
}: {
  username: string | null;
  avatarUrl: string | null;
  unreadCount: number;
  signedIn: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[rgb(var(--color-bg-page-rgb)/0.86)] px-5 py-3 backdrop-blur-[14px]">
      {/* Compact logo — only when the sidebar is hidden. */}
      <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="CoBuild home">
        <span className="flex h-[27px] w-[27px] items-center justify-center rounded-[4px] bg-[var(--color-accent)] text-[14px] font-extrabold text-[var(--color-accent-on)]">
          C
        </span>
      </Link>

      <Link
        href="/search"
        className="flex flex-1 items-center gap-2.5 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        Search projects, people, tags
      </Link>

      {signedIn ? (
        <>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-10 w-10 flex-none items-center justify-center rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-panel-alt)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-[9px] h-2 w-2 rounded-full border-2 border-[var(--color-bg-page)] bg-[var(--color-accent)]" />
            )}
          </Link>

          {/* Avatar is the profile entry point on mobile; the sidebar owns it on desktop. */}
          {username && (
            <Link
              href={`/u/${username}`}
              aria-label="Your profile"
              className="h-10 w-10 flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)] lg:hidden"
            >
              {avatarUrl && (
                <Image src={avatarUrl} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" />
              )}
            </Link>
          )}
        </>
      ) : (
        <Link
          href="/login"
          className="flex-none rounded-[6px] bg-[var(--color-text-primary)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--color-bg-page)] hover:bg-white"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}
