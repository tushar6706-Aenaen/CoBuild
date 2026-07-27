"use client";

import { useTransition } from "react";
import { markOneRead } from "./actions";

/**
 * Marks a notification read when the user follows its link.
 *
 * A wrapper rather than an `onClick` on the `<Link>` itself so the row stays a
 * Server Component — only this thin shell ships JS, and a page of 50
 * notifications costs one component's worth rather than fifty.
 *
 * The navigation is never awaited on the write: `startTransition` fires the
 * action and the browser follows the link immediately. A user should not wait
 * on a bookkeeping UPDATE to open the thing they clicked, and if the write
 * loses the race the row simply stays unread — recoverable, unlike a
 * navigation that stalls.
 */
export function MarkReadOnClick({
  id,
  read,
  children,
}: {
  id: string;
  read: boolean;
  children: React.ReactNode;
}) {
  const [, startTransition] = useTransition();

  if (read) return <>{children}</>;

  return (
    <span
      className="contents"
      onClick={() => {
        startTransition(() => {
          void markOneRead(id);
        });
      }}
    >
      {children}
    </span>
  );
}
