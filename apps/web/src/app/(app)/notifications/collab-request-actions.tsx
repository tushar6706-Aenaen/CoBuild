"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  acceptRequest,
  declineRequest,
  type CollabActionState,
} from "@/app/(app)/p/[username]/[slug]/collab-actions";

const idle: CollabActionState = {};

function AcceptSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-3 py-1.5 text-[12px] font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
    >
      {pending ? "Accepting…" : "Accept"}
    </button>
  );
}

function DeclineSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)] disabled:opacity-60"
    >
      {pending ? "Declining…" : "Decline"}
    </button>
  );
}

/**
 * Accept/Decline for a `collab_request` notification row.
 *
 * The notification row doesn't carry the request id (see `NotificationItem`),
 * so both actions resolve the live pending `collab_requests` row from
 * `(projectId, requesterId)` server-side before acting on it — that's why
 * only those two ids are passed in, not a request id.
 *
 * Tracks its own resolved/pending state locally so the buttons swap for a
 * confirmation immediately, without waiting on the page's revalidation.
 * There's no way to hide these controls on a *later* visit once the request
 * has already been handled elsewhere (the notification row has no "resolved"
 * flag) — clicking a stale button then just surfaces the "already handled"
 * error the server action returns, which is the accepted tradeoff here.
 */
export function CollabRequestActions({
  projectId,
  requesterId,
}: {
  projectId: string;
  requesterId: string;
}) {
  const [acceptState, acceptAction] = useActionState(acceptRequest, idle);
  const [declineState, declineAction] = useActionState(declineRequest, idle);
  const [resolved, setResolved] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    if (acceptState.ok) setResolved("accepted");
  }, [acceptState]);

  useEffect(() => {
    if (declineState.ok) setResolved("declined");
  }, [declineState]);

  if (resolved) {
    return (
      <span className="text-[12px] font-semibold text-[var(--color-text-tertiary)]">
        {resolved === "accepted" ? "Accepted" : "Declined"}
      </span>
    );
  }

  const error = acceptState.error || declineState.error;

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-1.5">
        <form action={acceptAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="requesterId" value={requesterId} />
          <AcceptSubmit />
        </form>
        <form action={declineAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="requesterId" value={requesterId} />
          <DeclineSubmit />
        </form>
      </span>
      {error && (
        <span className="text-[11px] text-[var(--color-status-danger-strong)]">{error}</span>
      )}
    </span>
  );
}
