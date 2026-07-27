"use client";

import { useFormStatus } from "react-dom";
import { markAllRead } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
    >
      {pending && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" />
      )}
      {pending ? "Marking…" : "Mark all read"}
    </button>
  );
}

/**
 * A real `<form>` posting to a Server Action, so it works before hydration and
 * without JS. `useFormStatus` only supplies the pending state, which is why
 * the button is split into its own child component — the hook reads the status
 * of the nearest parent form and would always report idle if it sat in the
 * component that renders the form.
 */
export function MarkAllReadButton() {
  return (
    <form action={markAllRead}>
      <Submit />
    </form>
  );
}
