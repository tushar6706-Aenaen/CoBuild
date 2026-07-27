"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MAX_COMMENT_DEPTH, transformedStorageUrl, type CommentNode } from "@cobuild/shared";
import { LOGIN_PATH } from "@/lib/auth/redirects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ViewerInfo = { id: string; avatarUrl: string | null } | null;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function CommentAvatar({ url, size }: { url: string | null; size: number }) {
  return (
    <span
      className="flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)]"
      style={{ width: size, height: size }}
    >
      {url && (
        <Image
          src={transformedStorageUrl(url, { width: size, height: size, fit: "cover" })}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="h-full w-full object-cover"
        />
      )}
    </span>
  );
}

function CommentItem({
  node,
  projectId,
  authorId,
  viewer,
  avatarUrlFor,
  depth,
}: {
  node: CommentNode;
  projectId: string;
  authorId: string;
  viewer: ViewerInfo;
  avatarUrlFor: (path: string | null) => string | null;
  depth: number;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  const [voted, setVoted] = useState(false);
  const [votes, setVotes] = useState(node.upvote_count);
  const [votePending, setVotePending] = useState(false);

  const isProjectAuthor = node.author?.id === authorId;
  const canNest = depth < MAX_COMMENT_DEPTH;

  async function toggleVote() {
    if (!viewer) {
      router.push(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (votePending) return;

    const next = !voted;
    setVoted(next);
    setVotes((v) => v + (next ? 1 : -1));
    setVotePending(true);

    const supabase = createClient();
    const { error } = next
      ? await supabase.from("comment_votes").insert({ comment_id: node.id, profile_id: viewer.id })
      : await supabase
          .from("comment_votes")
          .delete()
          .eq("comment_id", node.id)
          .eq("profile_id", viewer.id);

    setVotePending(false);
    if (error) {
      setVoted(!next);
      setVotes((v) => v + (next ? -1 : 1));
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!viewer || !replyBody.trim() || submitting) return;
    setSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.from("comments").insert({
      project_id: projectId,
      author_id: viewer.id,
      parent_id: node.id,
      // Clamp so a deep chain doesn't render past what the UI supports.
      depth: Math.min(depth + 1, MAX_COMMENT_DEPTH),
      body: replyBody.trim(),
    });

    setSubmitting(false);
    if (!error) {
      setReplyBody("");
      setReplying(false);
      startTransition(() => router.refresh());
    }
  }

  const avatarSize = depth === 0 ? 34 : 30;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-2.5">
        <CommentAvatar url={avatarUrlFor(node.author?.avatar_url ?? null)} size={avatarSize} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {node.author?.username ? (
              <Link href={`/u/${node.author.username}`} className="font-mono text-[12.5px] font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent-muted)]">
                @{node.author.username}
              </Link>
            ) : (
              <span className="font-mono text-[12.5px] text-[var(--color-text-tertiary)]">[deleted]</span>
            )}
            {isProjectAuthor && (
              <span className="rounded-[3px] bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--color-accent-muted)]">
                AUTHOR
              </span>
            )}
            <span className="text-xs text-[var(--color-text-tertiary)]">{timeAgo(node.created_at)}</span>
          </div>

          <div className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-text-secondary)]">{node.body}</div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleVote}
              aria-pressed={voted}
              className={
                voted
                  ? "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-[var(--color-accent-muted)]"
                  : "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill={voted ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.4} strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4l8 9h-5v7h-6v-7H4z" />
              </svg>
              <span className="tabular-nums">{votes}</span>
            </button>
            {canNest && (
              <button
                type="button"
                onClick={() => (viewer ? setReplying((r) => !r) : router.push(LOGIN_PATH))}
                className="rounded px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Reply
              </button>
            )}
          </div>

          {replying && (
            <form onSubmit={submitReply} className="flex flex-col gap-2 pt-1">
              <Textarea
                rows={2}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply…"
                className="resize-y rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] text-sm"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting || !replyBody.trim()} className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)]">
                  {submitting ? "Posting…" : "Reply"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setReplying(false)} className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {node.replies.length > 0 && (
        <div className="ml-5 flex flex-col gap-3.5 border-l border-[var(--color-border-default)] pl-5">
          {node.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              node={reply}
              projectId={projectId}
              authorId={authorId}
              viewer={viewer}
              avatarUrlFor={avatarUrlFor}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Comments({
  projectId,
  authorId,
  comments,
  commentCount,
  viewer,
  avatarBaseUrl,
}: {
  projectId: string;
  authorId: string;
  comments: CommentNode[];
  commentCount: number;
  viewer: ViewerInfo;
  /** `{supabaseUrl}/storage/v1/object/public/avatars/` — avoids threading a client through. */
  avatarBaseUrl: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  const avatarUrlFor = (path: string | null) => (path ? `${avatarBaseUrl}${path}` : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!viewer) {
      router.push(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!body.trim() || submitting) return;
    setSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.from("comments").insert({
      project_id: projectId,
      author_id: viewer.id,
      body: body.trim(),
      depth: 0,
    });

    setSubmitting(false);
    if (!error) {
      setBody("");
      startTransition(() => router.refresh());
    }
  }

  return (
    <section className="flex flex-col gap-[18px] border-t border-[var(--color-border-subtle)] pt-2.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-[19px] font-bold tracking-tight">Comments</h2>
        <span className="font-mono text-xs text-[var(--color-text-tertiary)]">{commentCount}</span>
      </div>

      <div className="flex gap-2.5 rounded-[8px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-3.5">
        <CommentAvatar url={avatarUrlFor(viewer?.avatarUrl ?? null)} size={34} />
        <form onSubmit={submit} className="flex flex-1 flex-col gap-2.5">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={viewer ? "Ask how they built it…" : "Sign in to comment"}
            className="resize-y rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] text-sm"
          />
          <div className="flex items-center gap-2.5">
            <span className="flex-1 text-[11.5px] text-[var(--color-text-tertiary)]">
              Be specific — the author reads these.
            </span>
            <Button
              type="submit"
              disabled={submitting || (!!viewer && !body.trim())}
              className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-[13px] font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)]"
            >
              {submitting ? "Posting…" : "Comment"}
            </Button>
          </div>
        </form>
      </div>

      {comments.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-[var(--color-text-secondary)]">
          No comments yet — be the first to ask how it was built.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {comments.map((node) => (
            <CommentItem
              key={node.id}
              node={node}
              projectId={projectId}
              authorId={authorId}
              viewer={viewer}
              avatarUrlFor={avatarUrlFor}
              depth={0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
