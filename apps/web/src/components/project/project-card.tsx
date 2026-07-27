import Image from "next/image";
import Link from "next/link";
import { transformedStorageUrl, IMAGE_SIZES } from "@cobuild/shared";
import { storageUrl } from "@/lib/storage-url";
import { VoteButton } from "./vote-button";
import { BookmarkButton } from "./bookmark-button";
import { ShareProjectButton } from "./share-button";
import { AuthorHoverCard } from "./author-hover-card";

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  shipped: { label: "Shipped", color: "var(--color-status-shipped)" },
  in_progress: { label: "In progress", color: "var(--color-status-in-progress)" },
  archived: { label: "Archived", color: "var(--color-status-archived)" },
};

export type ProjectCardData = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_image_path: string | null;
  status: string;
  upvote_count: number;
  comment_count: number;
  view_count: number;
  published_at: string | null;
  author: { username: string | null; display_name: string | null; avatar_url: string | null };
  tags: { slug: string; name: string }[];
};

export function timeAgo(iso: string | null): string {
  if (!iso) return "unpublished";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The feed card, translated from `ProjectCard.dc.html`.
 *
 * Deliberately a Server Component — only the interactive bits (vote, bookmark,
 * share, author hover) are client islands, so a feed page ships one card's
 * worth of JS rather than one per card.
 */
export function ProjectCard({
  project,
  viewerId,
  voted,
  bookmarked,
}: {
  project: ProjectCardData;
  viewerId: string | null;
  voted: boolean;
  bookmarked: boolean;
}) {
  const status = STATUS_STYLE[project.status] ?? STATUS_STYLE.in_progress;
  const username = project.author.username;
  const href = username ? `/p/${username}/${project.slug}` : "#";

  const coverBase = storageUrl(project.cover_image_path, "project-media");
  const cover = coverBase
    ? transformedStorageUrl(coverBase, { width: IMAGE_SIZES.feedCard[1], fit: "contain" })
    : null;

  const avatarBase = storageUrl(project.author.avatar_url, "avatars");
  const avatar = avatarBase
    ? transformedStorageUrl(avatarBase, { width: 52, height: 52, fit: "cover" })
    : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)]">
      <Link href={href} className="relative block aspect-[16/10] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_10px,var(--color-bg-panel-alt)_10px_20px)]">
        {cover && (
          <Image
            src={cover}
            alt={project.title}
            fill
            unoptimized
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover"
          />
        )}
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(var(--color-bg-page-rgb)/0.78)_0%,rgb(var(--color-bg-page-rgb)/0)_46%)]" />
        <span
          className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm"
          style={{
            background: "rgb(var(--color-bg-page-rgb)/0.72)",
            borderColor: `color-mix(in srgb, ${status.color} 35%, transparent)`,
            color: status.color,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
          {status.label}
        </span>
        <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-bg-page-rgb)/0.72)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-text-secondary)] backdrop-blur-sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {project.view_count.toLocaleString()}
        </span>
      </Link>

      <div className="flex flex-col gap-3.5 px-4 pt-4 pb-4">
        <Link href={href} className="flex flex-col gap-1.5">
          <span className="font-mono text-base leading-tight font-medium text-[var(--color-text-primary)]">
            {project.title}
          </span>
          {project.tagline && (
            <span className="text-[13.5px] leading-snug text-[var(--color-text-secondary)]">
              {project.tagline}
            </span>
          )}
        </Link>

        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.slice(0, 5).map((t) => (
              <Link
                key={t.slug}
                href={`/tag/${t.slug}`}
                className="rounded-sm bg-[var(--color-bg-raised)] px-2 py-1 font-mono text-[10.5px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/[0.16] hover:text-[var(--color-accent-muted-strong)]"
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}

        <AuthorHoverCard username={username} avatarUrl={avatar} timeAgo={timeAgo(project.published_at)} />

        <div className="flex items-center gap-2 border-t border-[var(--color-border-subtle)] pt-3.5">
          <VoteButton
            projectId={project.id}
            viewerId={viewerId}
            initialVoted={voted}
            initialCount={project.upvote_count}
          />
          <Link
            href={href}
            className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-raised)] px-3 py-2.5 text-[13px] font-semibold text-[var(--color-text-secondary-alt)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z" />
            </svg>
            <span className="tabular-nums">{project.comment_count}</span>
          </Link>

          <div className="flex-1" />

          <BookmarkButton projectId={project.id} viewerId={viewerId} initialBookmarked={bookmarked} />
          <ShareProjectButton href={href} />
        </div>
      </div>
    </article>
  );
}
