"use client";

/**
 * A real form POST to `/auth/signout`, not a fetch or a link.
 * The route is POST-only by design (PROJECT_INFO): a GET-triggerable
 * sign-out could be fired by a third-party page via `<img src>`.
 *
 * The design has no sign-out affordance in the persistent shell (sidebar/
 * header) — the profile mini-card just opens the profile — so this lives on
 * the settings page instead.
 */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-status-danger)]/25 bg-[var(--color-status-danger)]/[0.06] px-4 py-2.5 text-[13px] font-semibold text-[var(--color-status-danger-strong)] hover:bg-[var(--color-status-danger)]/[0.12]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
        Sign out
      </button>
    </form>
  );
}
