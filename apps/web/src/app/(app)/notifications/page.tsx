import type { Metadata } from "next";
import Link from "next/link";
import { getNotifications, getCollabRequestSummaries, collabRequestKey } from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/lib/auth/session";
import { NotificationRow } from "./notification-row";
import { MarkAllReadButton } from "./mark-all-read-button";

export const metadata: Metadata = { title: "Notifications — CoBuild" };

export default async function NotificationsPage() {
  const { user } = await requireOnboardedUser("/notifications");

  const supabase = await createClient();
  const notifications = await getNotifications(supabase, user.id);
  const hasUnread = notifications.some((n) => !n.read);

  // `collab_request` is the only row type whose payload — the requester's
  // pitch — isn't reachable from `getNotifications`' embeds, and the only one
  // carrying controls that must not stay live after the request is resolved.
  // One extra query covers both, and only runs when such a row is on the page.
  const collabSummaries = await getCollabRequestSummaries(
    supabase,
    notifications
      .filter((n) => n.type === "collab_request" && n.actor_id && n.project_id)
      .map((n) => ({ projectId: n.project_id!, requesterId: n.actor_id! })),
  );

  return (
    <div className="flex max-w-[720px] flex-col gap-[18px]">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-[26px] font-extrabold tracking-[-0.03em]">Notifications</h1>
        {hasUnread && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card-lg)] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-7 py-14 text-center">
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-bg-panel-alt)] text-[var(--color-accent)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-lg font-bold">You&apos;re all caught up</div>
            <div className="max-w-[320px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              Upvotes, comments, follows, and co-builder credits will land here.
            </div>
          </div>
          <Link
            href="/"
            className="rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-[17px] py-2.5 text-[13.5px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
          >
            Browse the feed
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              collab={
                n.actor_id && n.project_id
                  ? collabSummaries.get(collabRequestKey(n.project_id, n.actor_id))
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
