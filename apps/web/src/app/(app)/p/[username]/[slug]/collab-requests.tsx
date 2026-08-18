import Image from "next/image";
import Link from "next/link";
import type { CollabRequest } from "@cobuild/shared";
import { timeAgo } from "@/components/project/project-card";
import { CollabRequestActions } from "@/app/(app)/notifications/collab-request-actions";

/**
 * Pending requests to join, on the project page, for the author only.
 *
 * This is the durable surface for deciding on a request. `/notifications` also
 * carries Accept/Decline, but a notification is a feed: it pages, and once a
 * request scrolls past the page limit there is no way back to it — the request
 * stays pending forever while the requester's button reads "Request sent"
 * indefinitely. Anchoring the same decision to the project means it is always
 * reachable from the thing it is about.
 *
 * Renders nothing when there is nothing pending, so it costs an author with no
 * requests exactly one empty section that never appears.
 */
export function CollabRequests({
  requests,
  avatarUrl,
}: {
  /** Already filtered to `pending` by the caller. */
  requests: CollabRequest[];
  /** Resolves a requester's `avatar_url` storage path to a public URL. */
  avatarUrl: (path: string | null) => string | null;
}) {
  if (requests.length === 0) return null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-[19px] font-bold tracking-tight">Requests to join</h2>
        <span className="text-[12.5px] font-semibold text-[var(--color-text-tertiary)]">
          {requests.length} pending
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {requests.map((r) => {
          const name = r.requester?.display_name || r.requester?.username || "Someone";
          const avatar = avatarUrl(r.requester?.avatar_url ?? null);

          return (
            <li
              key={r.id}
              className="flex gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-3.5"
            >
              {avatar ? (
                <Image
                  src={avatar}
                  alt=""
                  width={34}
                  height={34}
                  className="h-[34px] w-[34px] flex-none rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-bg-raised)] text-[13px] font-bold text-[var(--color-text-secondary)]"
                  aria-hidden="true"
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="text-[13px] font-medium text-[var(--color-text-primary)]">
                  {r.requester?.username ? (
                    <Link href={`/u/${r.requester.username}`} className="hover:underline">
                      @{r.requester.username}
                    </Link>
                  ) : (
                    name
                  )}
                </div>
                {/* The pitch, in full — this panel exists to be read before
                    deciding, so it is not clamped the way the notification
                    row's preview is. `message` is NOT NULL with a 1-500 CHECK. */}
                <p className="whitespace-pre-wrap border-l-2 border-[var(--color-border-default)] pl-2.5 text-[13px] leading-normal text-[var(--color-text-secondary)]">
                  {r.message}
                </p>
                <span className="text-[11.5px] text-[var(--color-text-tertiary)]">
                  {timeAgo(r.created_at)}
                </span>
              </div>

              <div className="flex flex-none items-start pt-0.5">
                <CollabRequestActions
                  projectId={r.project_id}
                  requesterId={r.requester_id}
                  status={r.status}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
