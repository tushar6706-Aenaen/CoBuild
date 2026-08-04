import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProjectDetail,
  getProjectComments,
  getViewerProjectState,
  getViewerCommentVotes,
  collectCommentIds,
  isFollowing,
  publicStorageUrl,
  transformedStorageUrl,
} from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/session";
import { Markdown } from "@/components/markdown";
import { VoteButton } from "@/components/project/vote-button";
import { BookmarkButton } from "@/components/project/bookmark-button";
import { ShareProjectButton } from "@/components/project/share-button";
import { FollowButton } from "@/components/project/follow-button";
import { Gallery, type GalleryImage } from "./gallery";
import { Comments } from "./comments";
import { ViewTracker } from "./view-tracker";
import { DeleteProjectButton } from "./delete-button";

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  shipped: { label: "Shipped", color: "var(--color-status-shipped)" },
  in_progress: { label: "In progress", color: "var(--color-status-in-progress)" },
  archived: { label: "Archived", color: "var(--color-status-archived)" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "unpublished";
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const supabase = await createClient();
  const project = await getProjectDetail(supabase, username, slug);
  if (!project) return { title: "Project not found — CoBuild" };

  const cover = publicStorageUrl(supabase, "project-media", project.cover_image_path);
  return {
    title: `${project.title} — CoBuild`,
    description: project.tagline ?? undefined,
    openGraph: {
      title: project.title,
      description: project.tagline ?? undefined,
      images: cover ? [cover] : undefined,
    },
    // Unlisted projects are reachable by direct link on purpose, but must not
    // be indexed — that's the difference between "unlisted" and "public".
    robots: project.visibility === "public" ? undefined : { index: false, follow: false },
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const supabase = await createClient();

  const project = await getProjectDetail(supabase, username, slug);
  if (!project) notFound();

  const { user: viewer } = await getAuthState();
  const isAuthor = viewer?.id === project.author.id;

  const [comments, viewerState, viewerFollowsAuthor] = await Promise.all([
    getProjectComments(supabase, project.id),
    viewer
      ? getViewerProjectState(supabase, project.id, viewer.id)
      : Promise.resolve({ voted: false, bookmarked: false }),
    viewer && !isAuthor
      ? isFollowing(supabase, viewer.id, project.author.id)
      : Promise.resolve(false),
  ]);

  // Keyed off the comment tree, so this can't join the Promise.all above.
  const votedCommentIds = viewer
    ? await getViewerCommentVotes(supabase, viewer.id, collectCommentIds(comments))
    : new Set<string>();

  const viewerAvatar = viewer
    ? ((
        await supabase.from("profiles").select("avatar_url").eq("id", viewer.id).maybeSingle<{ avatar_url: string | null }>()
      ).data?.avatar_url ?? null)
    : null;

  const galleryImages: GalleryImage[] = project.images.map((img) => ({
    url: publicStorageUrl(supabase, "project-media", img.storage_path)!,
    alt: img.alt,
    caption: img.caption,
    width: img.width,
    height: img.height,
  }));

  const authorAvatar = publicStorageUrl(supabase, "avatars", project.author.avatar_url);
  const avatarBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;
  const status = STATUS_STYLE[project.status] ?? STATUS_STYLE.in_progress;

  return (
    <div className="flex flex-col gap-[22px]">
      <ViewTracker projectId={project.id} />

      <Link href="/" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to feed
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-[22px]">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
                style={{ background: `color-mix(in srgb, ${status.color} 12%, transparent)`, borderColor: `color-mix(in srgb, ${status.color} 30%, transparent)`, color: status.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                {status.label}
              </span>
              {project.visibility !== "public" && (
                <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
                  {project.visibility === "draft" ? "Draft" : "Unlisted"}
                </span>
              )}
              <span className="font-mono text-[11.5px] text-[var(--color-text-tertiary)]">
                {project.view_count.toLocaleString()} views · posted {timeAgo(project.published_at ?? project.created_at)}
              </span>
            </div>

            <h1 className="font-mono text-[29px] leading-tight font-medium tracking-tight">{project.title}</h1>
            {project.tagline && (
              <p className="max-w-[640px] text-base leading-relaxed text-[var(--color-text-secondary-alt)]">
                {project.tagline}
              </p>
            )}
          </div>

          <Gallery images={galleryImages} title={project.title} />

          <div className="flex flex-wrap items-center gap-2.5 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-3.5">
            <VoteButton
              projectId={project.id}
              viewerId={viewer?.id ?? null}
              initialVoted={viewerState.voted}
              initialCount={project.upvote_count}
              size="lg"
            />
            {project.live_url && (
              <a
                href={project.live_url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-text-primary)] px-4 py-3 text-[13.5px] font-bold text-[var(--color-bg-page)] hover:bg-white"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <path d="M14 4h6v6M20 4L10 14M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
                </svg>
                Live demo
              </a>
            )}
            {project.repo_url && (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-4 py-3 text-[13.5px] font-bold text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-raised)]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0012 2z" />
                </svg>
                GitHub repo
              </a>
            )}
            <div className="flex-1" />
            <BookmarkButton projectId={project.id} viewerId={viewer?.id ?? null} initialBookmarked={viewerState.bookmarked} />
            <ShareProjectButton href={`/p/${username}/${slug}`} />
          </div>

          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {project.tags.map((t) => (
                <Link
                  key={t.slug}
                  href={`/tag/${t.slug}`}
                  className="rounded-sm bg-[var(--color-bg-raised)] px-2.5 py-1.5 font-mono text-[11.5px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/[0.16] hover:text-[var(--color-accent-muted-strong)]"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}

          {project.description && (
            <div className="flex max-w-[680px] flex-col gap-3.5">
              <h2 className="text-[19px] font-bold tracking-tight">About this project</h2>
              <Markdown content={project.description} />
            </div>
          )}

          {project.collaborators.length > 0 && (
            <div className="flex flex-col gap-3.5">
              <h2 className="text-[19px] font-bold tracking-tight">Credited co-builders</h2>
              <div className="flex flex-wrap gap-2.5">
                {project.collaborators.map((c, i) => {
                  const avatar = publicStorageUrl(supabase, "avatars", c.profile?.avatar_url ?? null);
                  const label = c.profile?.username ? `@${c.profile.username}` : (c.invited_name ?? "Contributor");
                  const inner = (
                    <>
                      <span className="h-[34px] w-[34px] flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)]">
                        {avatar && (
                          <Image
                            src={transformedStorageUrl(avatar, { width: 34, height: 34, fit: "cover" })}
                            alt=""
                            width={34}
                            height={34}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        )}
                      </span>
                      <span className="flex flex-col">
                        <span className="font-mono text-xs text-[var(--color-text-primary)]">{label}</span>
                        {c.role_label && (
                          <span className="text-[11.5px] font-semibold text-[var(--color-accent)]">{c.role_label}</span>
                        )}
                      </span>
                    </>
                  );
                  const className =
                    "flex items-center gap-2.5 rounded-[7px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] py-2 pr-3.5 pl-2 text-left hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-raised)]";
                  return c.profile?.username ? (
                    <Link key={`${c.profile_id}-${i}`} href={`/u/${c.profile.username}`} className={className}>
                      {inner}
                    </Link>
                  ) : (
                    <span key={`invited-${i}`} className={className}>
                      {inner}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <Comments
            projectId={project.id}
            authorId={project.author.id}
            comments={comments}
            commentCount={project.comment_count}
            viewer={viewer ? { id: viewer.id, avatarUrl: viewerAvatar } : null}
            avatarBaseUrl={avatarBaseUrl}
            votedCommentIds={votedCommentIds}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-col gap-3.5 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-[18px]">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)]">
                {authorAvatar && (
                  <Image
                    src={transformedStorageUrl(authorAvatar, { width: 48, height: 48, fit: "cover" })}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{project.author.display_name ?? project.author.username}</span>
                <Link href={`/u/${project.author.username}`} className="text-left font-mono text-xs text-[var(--color-accent-muted)]">
                  @{project.author.username}
                </Link>
              </div>
            </div>
            {project.author.headline && (
              <p className="text-[12.5px] leading-snug text-[var(--color-text-secondary)]">{project.author.headline}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {project.author.roles
                .filter((r) => r !== "student")
                .map((r) => (
                  <span key={r} className="rounded border border-[var(--color-accent)]/22 bg-[var(--color-accent)]/12 px-2 py-1 text-[11px] font-semibold text-[var(--color-accent-muted)]">
                    {r[0].toUpperCase() + r.slice(1)}
                  </span>
                ))}
              {project.author.is_student && (
                <span className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                  Student{project.author.grad_year ? ` · '${String(project.author.grad_year).slice(-2)}` : ""}
                </span>
              )}
            </div>
            {!isAuthor && (
              <FollowButton
                profileId={project.author.id}
                viewerId={viewer?.id ?? null}
                initialFollowing={viewerFollowsAuthor}
                variant="light"
              />
            )}
          </div>

          <div className="flex flex-col gap-2.5 rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-[18px]">
            <span className="text-[13px] font-bold">Project stats</span>
            {[
              { k: "Upvotes", v: project.upvote_count },
              { k: "Comments", v: project.comment_count },
              { k: "Bookmarks", v: project.bookmark_count },
              { k: "Views", v: project.view_count },
            ].map((s) => (
              <div key={s.k} className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--color-text-secondary)]">{s.k}</span>
                <span className="font-mono text-[var(--color-text-primary)]">{s.v.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {isAuthor && (
            <div className="flex flex-col gap-2">
              <Link
                href={`/p/${username}/${slug}/edit`}
                className="rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-bg-panel-alt)] px-4 py-2.5 text-center text-[13px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
              >
                Edit project
              </Link>
              <DeleteProjectButton
                projectId={project.id}
                authorId={project.author.id}
                title={project.title}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
