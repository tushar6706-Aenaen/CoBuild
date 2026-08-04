"use client";

import { useSyncExternalStore } from "react";

export type ToastVariant = "neutral" | "danger";

type ToastRecord = { id: number; message: string; variant: ToastVariant };

/** How long a toast stays up before dismissing itself. */
const DISMISS_MS = 5000;

/*
 * The queue lives at module scope, deliberately outside React state.
 *
 * It started as `useState` inside a provider and did not survive contact with
 * Server Actions: submitting a form revalidates the `(app)` layout, the layout
 * re-renders, and the provider holding the queue remounts — so a toast queued
 * by the submit handler was wiped by its own provider a few milliseconds
 * later. It looked exactly like the toast never fired, and it defeated three
 * different attempts to route the message through a navigation.
 *
 * Module scope survives remounts: a fresh viewport subscribes and immediately
 * reads whatever is already queued. This is the same reason toast libraries
 * keep their store outside the component tree.
 *
 * It also means no context and no provider wrapper — `showToast` is callable
 * from anywhere, including outside React.
 */
let toasts: ToastRecord[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

/** Stable empty reference for SSR; useSyncExternalStore requires identity stability. */
const EMPTY: ToastRecord[] = [];

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Queue a message. Safe to call from anywhere, including outside React. */
export function showToast(message: string, variant: ToastVariant = "neutral") {
  const id = nextId++;
  toasts = [...toasts, { id, message, variant }];
  emit();
  setTimeout(() => dismiss(id), DISMISS_MS);
}

/**
 * Returns the queue function. A hook only so call sites read like other hooks;
 * there is no context to consume and no provider required.
 */
export function useToast() {
  return showToast;
}

/**
 * Renders the queue. Mount once, in the app shell.
 *
 * One `polite` region for both variants: politeness is fixed per element, so
 * assertive errors would need a second region. Every message here follows an
 * action the user just took while looking at the screen, so interrupting them
 * buys nothing.
 */
export function ToastViewport() {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-[88px] z-50 flex flex-col gap-2 lg:right-6 lg:bottom-6"
    >
      {items.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastRow({ toast }: { toast: ToastRecord }) {
  const danger = toast.variant === "danger";

  return (
    <div
      className={`pointer-events-auto flex max-w-[min(92vw,380px)] items-start gap-2.5 rounded-[var(--radius-control-lg)] border bg-[var(--color-bg-raised)] py-3 pr-2.5 pl-3.5 shadow-[0_20px_44px_rgba(0,0,0,0.6)] duration-200 animate-in fade-in slide-in-from-bottom-2 ${
        danger ? "border-[var(--color-status-danger)]/40" : "border-[var(--color-border-strong)]"
      }`}
    >
      <span
        className={
          danger
            ? "mt-px flex-none text-[var(--color-status-danger-strong)]"
            : "mt-px flex-none text-[var(--color-accent)]"
        }
      >
        {danger ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <path d="M12 8v5M12 16.5v.5" />
            <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>

      <span className="flex-1 pt-px text-[13px] leading-snug text-[var(--color-text-primary)]">
        {toast.message}
      </span>

      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        className="-mt-0.5 flex-none rounded-[var(--radius-control)] p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-panel-alt)] hover:text-[var(--color-text-primary)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
