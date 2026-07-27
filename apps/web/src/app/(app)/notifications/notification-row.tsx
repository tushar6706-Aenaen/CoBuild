import Link from "next/link";
import { notificationHref, type NotificationItem, type NotificationType } from "@cobuild/shared";
import { timeAgo } from "@/components/project/project-card";
import { MarkReadOnClick } from "./mark-read-on-click";

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<NotificationType, React.ReactNode> = {
  upvote: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 4l8 9h-5v7h-6v-7H4z" />
    </svg>
  ),
  credit: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M12 3l2.6 5.5 6 .8-4.3 4.2 1 6-5.3-2.9L6.7 19.5l1-6L3.4 9.3l6-.8z" />
    </svg>
  ),
  follow: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...s} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0115 0" />
    </svg>
  ),
  comment: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1121 11.5z" />
    </svg>
  ),
  reply: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1121 11.5z" />
    </svg>
  ),
};

/** Icon tint per type, from `scNotifs`: upvote reads as accent, credit as a star/award. */
function iconTone(type: NotificationType) {
  if (type === "upvote") {
    return { background: "rgba(59,227,143,0.16)", color: "var(--color-accent-muted)" };
  }
  if (type === "credit") {
    return { background: "rgba(245,185,80,0.13)", color: "var(--color-status-in-progress)" };
  }
  return { background: "var(--color-bg-raised)", color: "var(--color-text-secondary-alt)" };
}

/**
 * The sentence after the actor's handle. `project` is null when the referenced
 * project was deleted or is no longer visible, so every branch has a wording
 * that still reads correctly without a title.
 */
function describe(n: NotificationItem): string {
  const title = n.project?.title;
  switch (n.type) {
    case "upvote":
      return title ? `upvoted ${title}` : "upvoted your project";
    case "comment":
      return title ? `commented on ${title}` : "commented on your project";
    case "reply":
      return "replied to your comment";
    case "follow":
      return "started following you";
    case "credit":
      return title ? `credited you as a co-builder on ${title}` : "credited you as a co-builder";
  }
}

export function NotificationRow({ notification }: { notification: NotificationItem }) {
  const { type, read, actor, excerpt } = notification;
  const href = notificationHref(notification);
  const tone = iconTone(type);
  const who = actor?.username ? `@${actor.username}` : (actor?.display_name ?? "Someone");

  const body = (
    <>
      <span
        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[6px]"
        style={tone}
        aria-hidden="true"
      >
        {ICONS[type]}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13.5px] leading-normal text-[var(--color-text-secondary-alt)]">
          <b className="font-mono text-[12.5px] font-medium text-[var(--color-text-primary)]">
            {who}
          </b>{" "}
          {describe(notification)}
        </span>

        {excerpt && (
          <span className="line-clamp-2 border-l-2 border-[var(--color-border-default)] pl-2.5 text-[12.5px] leading-normal text-[var(--color-text-secondary)]">
            {excerpt}
          </span>
        )}

        <span className="text-[11.5px] text-[var(--color-text-tertiary)]">
          {timeAgo(notification.created_at)}
        </span>
      </span>

      {!read && (
        <span
          className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[var(--color-accent)]"
          aria-label="Unread"
        />
      )}
    </>
  );

  const className = [
    "flex gap-3 rounded-[8px] border p-3.5 text-left",
    read
      ? "border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]"
      : "border-[var(--color-accent)]/[0.22] bg-[var(--color-accent)]/[0.06]",
    href ? "hover:border-[var(--color-border-strong)]" : "",
  ].join(" ");

  // Rendered as a plain div when the target is gone, so the row still shows
  // what happened instead of vanishing or offering a dead link.
  if (!href) return <div className={className}>{body}</div>;

  return (
    <MarkReadOnClick id={notification.id} read={read}>
      <Link href={href} className={className}>
        {body}
      </Link>
    </MarkReadOnClick>
  );
}
