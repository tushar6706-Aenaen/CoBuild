"use client";

/**
 * Kept trivially small on purpose: `window.print()` is the whole feature.
 * Producing a real PDF server-side would mean shipping a headless browser to
 * render a document the user's own browser already renders correctly — the
 * print stylesheet is what does the actual work.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-[13px] font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)] print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
