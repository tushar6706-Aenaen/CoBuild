import Image from "next/image";
import Link from "next/link";
import { transformedStorageUrl, IMAGE_SIZES } from "@cobuild/shared";
import type { ProjectTile } from "@cobuild/shared";

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  shipped: { label: "Shipped", color: "var(--color-status-shipped)" },
  in_progress: { label: "In progress", color: "var(--color-status-in-progress)" },
  archived: { label: "Archived", color: "var(--color-status-archived)" },
};

// A lightweight stand-in for the full ProjectCard (Phase 3) — cover, title,
// tagline, status, tags. No vote/bookmark/comment affordances yet.
//
// `cover` is resolved by the caller rather than here: doing it inline meant
// `await createClient()` (which reads cookies and builds a whole Supabase
// client) once per tile, i.e. N clients per page render, for what is really
// just string concatenation. Passing the resolved URL down keeps this a plain
// synchronous component.
export function ProjectTileCard({ project, cover }: { project: ProjectTile; cover: string | null }) {
  const status = STATUS_STYLE[project.status] ?? STATUS_STYLE.in_progress;
  const authorUsername = project.author?.username;
  // `fill` + `unoptimized` renders a single src (no responsive srcset), so
  // pick the mid-tier feed-card width. `fit: "contain"` avoids the
  // width-only squash bug; the CSS `object-cover` below does the visual crop.
  const transformedCover = cover
    ? transformedStorageUrl(cover, { width: IMAGE_SIZES.feedCard[1], fit: "contain" })
    : null;

  const href = authorUsername ? `/p/${authorUsername}/${project.slug}` : "#";

  return (
    <Link
      href={href}
      className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] hover:border-[var(--color-border-strong)]"
    >
      <div className="relative aspect-[16/10] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_10px,var(--color-bg-panel-alt)_10px_20px)]">
        {transformedCover && (
          <Image src={transformedCover} alt={project.title} fill unoptimized sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
        )}
        <span
          className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm"
          style={{
            background: "rgb(var(--color-bg-page-rgb)/0.72)",
            borderColor: `${status.color}59`,
            color: status.color,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
          {status.label}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[15px] font-medium text-[var(--color-text-primary)]">
            {project.title}
          </span>
          {project.tagline && (
            <span className="text-[13px] leading-snug text-[var(--color-text-secondary)]">
              {project.tagline}
            </span>
          )}
        </div>
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.slice(0, 4).map((t) => (
              <span
                key={t.slug}
                className="rounded-sm bg-[var(--color-bg-raised)] px-2 py-1 font-mono text-[10.5px] font-medium text-[var(--color-text-secondary)]"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 border-t border-[var(--color-border-subtle)] pt-2.5 font-mono text-[11.5px] text-[var(--color-text-tertiary)]">
          <span>{project.upvote_count} upvotes</span>
          <span>·</span>
          <span>{project.view_count} views</span>
        </div>
      </div>
    </Link>
  );
}
