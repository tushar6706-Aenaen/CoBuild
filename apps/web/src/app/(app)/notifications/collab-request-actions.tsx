"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CollabRequestStatus } from "@cobuild/shared";
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
 * Tracks its own resolved state locally so the buttons swap for a
 * confirmation immediately, without waiting on the page's revalidation.
 *
 * `status` is the live status of the underlying request, resolved by the page.
 * The notification row itself has no "resolved" flag, so without it these
 * controls stayed live forever — a request already handled from the project
 * page, or withdrawn by the requester, still rendered Accept/Decline, and
 * clicking one only then surfaced an "already handled" error. Passing the
 * status in settles that on render instead.
 */
const RESOLVED_LABEL: Record<Exclude<CollabRequestStatus, "pending">, string> = {
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export function CollabRequestActions({
  projectId,
  requesterId,
  status = null,
}: {
  projectId: string;
  requesterId: string;
  /** Null when the request row could not be read — controls stay live and the
   *  server action remains the authority, which is the pre-existing behaviour. */
  status?: CollabRequestStatus | null;
}) {
  const [acceptState, acceptAction] = useActionState(acceptRequest, idle);
  const [declineState, declineAction] = useActionState(declineRequest, idle);
  const [justResolved, setJustResolved] = useState<
    Exclude<CollabRequestStatus, "pending"> | null
  >(null);

  useEffect(() => {
    if (acceptState.ok) setJustResolved("accepted");
  }, [acceptState]);

  useEffect(() => {
    if (declineState.ok) setJustResolved("declined");
  }, [declineState]);

  // Derived, not seeded into state: a `useState` initialiser only runs at
  // mount, so a status arriving from a later server render would be shadowed
  // by the stale initial value for as long as the component stays mounted.
  const resolved = justResolved ?? (status && status !== "pending" ? status : null);

  if (resolved) {
    return (
      <span className="text-[12px] font-semibold text-[var(--color-text-tertiary)]">
        {RESOLVED_LABEL[resolved]}
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
