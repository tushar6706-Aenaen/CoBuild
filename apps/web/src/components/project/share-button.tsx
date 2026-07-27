"use client";

import { useState } from "react";

export function ShareProjectButton({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    // Cards wrap this in a <Link>; don't navigate when sharing.
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked by permissions — the URL bar is the fallback.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? "Link copied" : "Share"}
      aria-label="Share project"
      className={
        copied
          ? "flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/12 text-[var(--color-accent-muted)]"
          : "flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
      }
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" />
          <path d="M12 16V3" />
          <path d="M7 8l5-5 5 5" />
        </svg>
      )}
    </button>
  );
}
