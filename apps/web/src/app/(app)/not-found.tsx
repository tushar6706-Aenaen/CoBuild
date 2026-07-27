import Link from "next/link";

/**
 * 404 inside the app shell. Without this, `notFound()` — thrown by
 * `/tag/[slug]`, `/u/[username]` and `/p/[username]/[slug]` for unknown
 * records — falls through to Next's unstyled default, which drops the sidebar
 * and header entirely and leaves the reader with no way back.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card-lg)] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-7 py-16 text-center">
      <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[8px] bg-[var(--color-bg-panel-alt)] text-[var(--color-accent)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.2 9.5a2.8 2.8 0 015.5.7c0 1.9-2.7 2.4-2.7 2.4" />
          <path d="M12 17.2h.01" />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-bold">We couldn&apos;t find that page</h1>
        <p className="max-w-[360px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
          The project, profile, or tag you followed may have been renamed, made private, or deleted.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Link
          href="/"
          className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-[17px] py-2.5 text-[13.5px] font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)]"
        >
          Back to the feed
        </Link>
        <Link
          href="/search"
          className="rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-[17px] py-2.5 text-[13.5px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
        >
          Search instead
        </Link>
      </div>
    </div>
  );
}
