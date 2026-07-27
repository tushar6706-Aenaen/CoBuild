"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for every app route. Must be a Client Component — that is
 * Next's contract for `error.tsx`, since it needs the `reset` callback.
 *
 * Deliberately shows no error text. A thrown Postgres error can carry a
 * policy name, a column list, or fragments of another user's row in its
 * message; `digest` is the server-generated hash Next puts in the server log,
 * which is the safe way to correlate a user's report with the real cause.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cobuild] route error", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card-lg)] border border-dashed border-[var(--color-status-danger)]/40 bg-[var(--color-bg-panel)] px-7 py-16 text-center">
      <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[8px] bg-[var(--color-bg-panel-alt)] text-[var(--color-status-danger)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
          <path d="M10.3 3.9L2.5 17.4A2 2 0 004.2 20.4h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="max-w-[360px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
          That page failed to load. Trying again usually works — if it doesn&apos;t, the problem is
          on our side.
        </p>
        {error.digest && (
          <p className="font-mono text-[11px] text-[var(--color-text-tertiary)]">
            Reference: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-[17px] py-2.5 text-[13.5px] font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-[17px] py-2.5 text-[13.5px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
        >
          Back to the feed
        </Link>
      </div>
    </div>
  );
}
