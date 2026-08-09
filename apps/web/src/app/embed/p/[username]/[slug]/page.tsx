import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectDetail, transformedStorageUrl } from "@cobuild/shared";
import { storageUrl } from "@/lib/storage-url";
import { createOgClient } from "@/lib/og/client";

/**
 * An iframe-able card for a single project — for personal sites, Notion, and
 * anywhere else that embeds by URL rather than by image.
 *
 * Deliberately outside the `(app)` route group so it inherits none of the app
 * chrome: no nav, no sidebar, no sticky header. It is a card, not a page.
 *
 * Reads through the anonymous client for the same reason the OG routes do —
 * an embed is rendered for whoever loads the host page, never for a session,
 * so it must not vary by viewer and must not be able to surface a draft. RLS
 * decides: public and unlisted resolve, drafts 404.
 */

export const revalidate = 300;

type Params = { username: string; slug: string };

export const metadata: Metadata = {
  // An embed appearing in search results would compete with the real page.
  robots: { index: false, follow: false },
};

export default async function EmbedProjectCard({ params }: { params: Promise<Params> }) {
  const { username, slug } = await params;
  const supabase = createOgClient();
  const project = await getProjectDetail(supabase, username, slug);
  if (!project) notFound();

  const cover = project.cover_image_path
    ? transformedStorageUrl(storageUrl(project.cover_image_path, "project-media")!, {
        width: 640,
        height: 360,
        fit: "cover",
      })
    : null;

  const avatar = project.author.avatar_url
    ? transformedStorageUrl(storageUrl(project.author.avatar_url, "avatars")!, {
        width: 64,
        height: 64,
        fit: "cover",
      })
    : null;

  const href = `/p/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;

  return (
    <div className="flex min-h-full flex-col overflow-hidden rounded-[var(--radius-card-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)]">
      <div className="h-1 w-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-status-shipped)]" />

      {cover && (
        // Plain <img>: next/image's loader is incompatible with Supabase's
        // transform params (see PROJECT_INFO.md), and an embed has no need for
        // a responsive srcset — the host controls the iframe's size.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="h-[168px] w-full flex-none border-b border-[var(--color-border-subtle)] object-cover"
        />
      )}

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[17px] leading-tight font-medium tracking-tight text-[var(--color-text-primary)] hover:text-[var(--color-accent-muted-strong)]"
        >
          {project.title}
        </a>

        {project.tagline && (
          <p className="line-clamp-2 text-[13px] leading-snug text-[var(--color-text-secondary)]">
            {project.tagline}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2.5 pt-1">
          <span className="h-7 w-7 flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-raised)]">
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--color-accent-muted)]">
            @{project.author.username}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-2.5 py-1 text-[12px] text-[var(--color-accent)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 4l8 12H4z" />
            </svg>
            {project.upvote_count.toLocaleString()}
          </span>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-[var(--radius-control)] bg-[var(--color-text-primary)] px-3 py-1.5 text-[12px] font-bold text-[var(--color-bg-page)] hover:bg-white"
          >
            View
          </a>
        </div>
      </div>
    </div>
  );
}
