"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { COLLAB_MESSAGE_MAX, type CollabRequestStatus } from "@cobuild/shared";
import { LOGIN_PATH } from "@/lib/auth/redirects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldCounter } from "@/components/ui/field-counter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  requestToJoin,
  withdrawRequest,
  type CollabActionState,
} from "@/app/(app)/p/[username]/[slug]/collab-actions";

const idle: CollabActionState = {};

function SendSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Sending…" : "Send request"}
    </Button>
  );
}

function WithdrawSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-4 py-2.5 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)]"
    >
      {pending ? "Withdrawing…" : "Withdraw"}
    </Button>
  );
}

/**
 * "Request to join" control for the project detail page — mounted only for a
 * signed-in, non-author viewer on a project that's actually looking for
 * something (see the mount-site check in `page.tsx`).
 *
 * Tracks its own status locally, seeded from the viewer's most recent
 * request, and moves through it as the two actions below resolve — no
 * `router.refresh()` needed for "the button becomes 'Request sent' without a
 * reload", since the Server Action's return value is enough to drive it.
 */
export function RequestToJoinButton({
  projectId,
  projectPath,
  viewerId,
  initialRequestId,
  initialStatus,
}: {
  projectId: string;
  /** e.g. `/p/username/slug` — revalidated by the actions after a write. */
  projectPath: string;
  viewerId: string | null;
  initialRequestId: string | null;
  initialStatus: CollabRequestStatus | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<CollabRequestStatus | null>(initialStatus);
  const [requestId, setRequestId] = useState<string | null>(initialRequestId);

  const [sendState, sendAction] = useActionState(requestToJoin, idle);
  const [withdrawState, withdrawAction] = useActionState(withdrawRequest, idle);

  useEffect(() => {
    if (!sendState.ok) return;
    setStatus("pending");
    setRequestId(sendState.requestId ?? null);
    setOpen(false);
    setMessage("");
  }, [sendState]);

  useEffect(() => {
    if (!withdrawState.ok) return;
    setStatus("withdrawn");
    setRequestId(null);
  }, [withdrawState]);

  function openDialog() {
    if (!viewerId) {
      router.push(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setOpen(true);
  }

  if (status === "accepted") {
    return (
      <span className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-4 py-2.5 text-[13px] font-semibold text-[var(--color-text-secondary)]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        You&rsquo;re a collaborator
      </span>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center gap-2.5">
        <span className="rounded-[var(--radius-control)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-2.5 text-[13px] font-semibold text-[var(--color-accent-muted)]">
          Request sent
        </span>
        {requestId && (
          <form action={withdrawAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="projectPath" value={projectPath} />
            <WithdrawSubmit />
          </form>
        )}
        {withdrawState.error && (
          <span className="text-[12px] text-[var(--color-status-danger-strong)]">{withdrawState.error}</span>
        )}
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        onClick={openDialog}
        className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)]"
      >
        Request to join
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] sm:max-w-[440px]">
          <form
            action={(formData) => {
              // A fresh id per open, so `useActionState`'s stale-closure result
              // from a previous submission can't be mistaken for this one.
              setRequestId(null);
              sendAction(formData);
            }}
            className="flex flex-col gap-3.5"
          >
            <DialogHeader>
              <DialogTitle>Request to join</DialogTitle>
              <DialogDescription className="text-[var(--color-text-secondary)]">
                Tell the author what you&rsquo;d bring to this project.
              </DialogDescription>
            </DialogHeader>

            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="projectPath" value={projectPath} />

            <div className="flex flex-col gap-1.5">
              <Textarea
                name="message"
                rows={4}
                maxLength={COLLAB_MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="I've shipped a couple of React Native apps and would love to help with the mobile client…"
                className="resize-y rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] text-sm"
              />
              <FieldCounter value={message} max={COLLAB_MESSAGE_MAX} />
            </div>

            {sendState.error && (
              <p className="text-[13px] text-[var(--color-status-danger-strong)]">{sendState.error}</p>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SendSubmit disabled={!message.trim()} />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
