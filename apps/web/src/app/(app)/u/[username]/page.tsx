import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProfileByUsername,
  isFollowing,
  publicStorageUrl,
  transformedStorageUrl,
  IMAGE_SIZES,
  getProfileProjects,
  getProfileContributions,
  getProfileBookmarks,
  type ProjectTile,
} from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/session";
import { FollowButton } from "@/components/project/follow-button";
import { ShareButton } from "./share-button";
import { ProjectTileCard } from "./project-tile";

type Tab = "projects" | "contributions" | "bookmarks";

const LINK_LABELS: Record<string, string> = {
  github: "GitHub",
  website: "Website",
  x: "X",
  linkedin: "LinkedIn",
  behance: "Behance",
  dribbble: "Dribbble",
  figma: "Figma",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const profile = await getProfileByUsername(supabase, username);
  if (!profile) return { title: "Profile not found — CoBuild" };
  return {
    title: `${profile.display_name ?? profile.username} (@${profile.username}) — CoBuild`,
    description: profile.headline ?? profile.bio ?? undefined,
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { username } = await params;
  const { tab: rawTab } = await searchParams;

  const supabase = await createClient();
  const profile = await getProfileByUsername(supabase, username);
  if (!profile) notFound();

  const { user: viewer } = await getAuthState();
  const isOwnProfile = viewer?.id === profile.id;

  // `rawTab` is fully attacker-controlled (and can be `string[]` for a repeated
  // `?tab=`), so resolve it against a fixed allowlist rather than casting —
  // an unrecognised value fell through as a `Tab` before, leaving no tab
  // highlighted. `bookmarks` additionally collapses to `projects` for anyone
  // but the owner; that gate plus `bookmarks_select_own` RLS is what keeps the
  // private tab private.
  const requestedTab = (Array.isArray(rawTab) ? rawTab[0] : rawTab) ?? "projects";
  const tab: Tab =
    requestedTab === "contributions"
      ? "contributions"
      : requestedTab === "bookmarks" && isOwnProfile
        ? "bookmarks"
        : "projects";

  const [following, tiles] = await Promise.all([
    viewer && !isOwnProfile ? isFollowing(supabase, viewer.id, profile.id) : Promise.resolve(false),
    (async (): Promise<ProjectTile[]> => {
      if (tab === "contributions") return getProfileContributions(supabase, profile.id, isOwnProfile);
      if (tab === "bookmarks") return getProfileBookmarks(supabase, profile.id);
      return getProfileProjects(supabase, profile.id, isOwnProfile);
    })(),
  ]);

  const avatarBase = publicStorageUrl(supabase, "avatars", profile.avatar_url);
  const avatarUrl = avatarBase
    ? transformedStorageUrl(avatarBase, { width: 92, height: 92, fit: "cover" })
    : null;
  const links = (profile.links ?? {}) as Record<string, string>;
  const linkEntries = Object.entries(links).filter(([, v]) => !!v);

  const stats = [
    { k: "PROJECTS", v: profile.project_count },
    { k: "UPVOTES", v: profile.total_upvotes_received },
    { k: "FOLLOWERS", v: profile.follower_count },
    { k: "FOLLOWING", v: profile.following_count },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: "projects", label: "Projects" },
    { key: "contributions", label: "Contributions" },
    ...(isOwnProfile ? [{ key: "bookmarks" as const, label: "Bookmarks" }] : []),
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      <div
        className="flex flex-col gap-[18px] rounded-[11px] border border-[var(--color-border-default)] p-[22px]"
        style={{ background: "linear-gradient(160deg, var(--color-bg-panel-alt), var(--color-bg-panel))" }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="h-[92px] w-[92px] flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_5px,var(--color-bg-panel-alt)_5px_10px)]">
            {avatarUrl && (
              <Image src={avatarUrl} alt={profile.display_name ?? profile.username ?? ""} width={92} height={92} unoptimized className="h-full w-full object-cover" />
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-2xl font-extrabold tracking-tight">
                  {profile.display_name ?? profile.username}
                </span>
                {profile.is_student && (
                  <span className="rounded border border-[var(--color-status-shipped)]/28 bg-[var(--color-status-shipped)]/12 px-2 py-0.5 text-[11px] font-bold text-[var(--color-status-shipped)]">
                    STUDENT
                  </span>
                )}
              </div>
              <span className="font-mono text-[13px] text-[var(--color-accent-muted)]">@{profile.username}</span>
            </div>
            {profile.headline && (
              <div className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">{profile.headline}</div>
            )}
            {profile.bio && (
              <div className="max-w-[560px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
                {profile.bio}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {profile.roles
                .filter((r) => r !== "student")
                .map((r) => (
                  <span
                    key={r}
                    className="rounded bg-[var(--color-accent)]/12 px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-accent-muted)]"
                    style={{ border: "1px solid rgba(59,227,143,0.24)" }}
                  >
                    {r[0].toUpperCase() + r.slice(1)}
                  </span>
                ))}
              {profile.is_student && (profile.college || profile.grad_year) && (
                <span className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-raised)] px-2.5 py-1 text-[11.5px] text-[var(--color-text-secondary)]">
                  {profile.college}
                  {profile.college && profile.grad_year ? " · '" : ""}
                  {profile.grad_year ? String(profile.grad_year).slice(-2) : ""}
                </span>
              )}
              {profile.location && (
                <span className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-raised)] px-2.5 py-1 text-[11.5px] text-[var(--color-text-secondary)]">
                  {profile.location}
                  {profile.timezone ? ` · ${profile.timezone}` : ""}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-none flex-row gap-2 sm:flex-col">
            {isOwnProfile ? (
              <Link
                href="/settings/profile"
                className="rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-bg-panel-alt)] px-5 py-2.5 text-center text-[13.5px] font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
              >
                Edit profile
              </Link>
            ) : (
              <FollowButton profileId={profile.id} viewerId={viewer?.id ?? null} initialFollowing={following} />
            )}
            <ShareButton />
          </div>
        </div>

        {linkEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {linkEntries.map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1.5 rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-raised)] px-3 py-1.5 text-[12.5px] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
              >
                {LINK_LABELS[key] ?? key}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </a>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--color-border-subtle)] pt-1 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.k} className="flex flex-col gap-0.5 rounded-[7px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-3.5 py-3">
              <span className="text-[21px] font-extrabold tracking-tight tabular-nums">{s.v}</span>
              <span className="font-mono text-[11.5px] tracking-wide text-[var(--color-text-tertiary)]">{s.k}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-fit gap-1.5 rounded-[7px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-1.5">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "projects" ? `/u/${username}` : `/u/${username}?tab=${t.key}`}
            className={
              t.key === tab
                ? "rounded-[5px] bg-[var(--color-accent)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-accent-on)]"
                : "rounded-[5px] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tiles.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[11px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-7 py-[60px] text-center">
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[8px] bg-[var(--color-bg-panel-alt)] text-[var(--color-accent)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M3 15l4-4 5 5" />
              <circle cx="15" cy="9" r="1.4" />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-lg font-bold">
              {tab === "bookmarks" ? "No bookmarks yet" : tab === "contributions" ? "No contributions yet" : "No projects yet"}
            </div>
            <div className="max-w-[330px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              {tab === "bookmarks"
                ? "Projects you bookmark show up here."
                : tab === "contributions"
                  ? `When ${profile.display_name ?? profile.username} is credited as a co-builder, it shows up here.`
                  : `When ${profile.display_name ?? profile.username} posts a project it shows up here — screenshots, stack, and all.`}
            </div>
          </div>
          {isOwnProfile && tab === "projects" && (
            <Link
              href="/new"
              className="rounded-[6px] bg-[var(--color-accent)] px-[17px] py-[11px] text-[13.5px] font-bold text-[var(--color-accent-on)]"
            >
              Post the first one
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
          {tiles.map((p) => (
            <ProjectTileCard
              key={p.id}
              project={p}
              cover={publicStorageUrl(supabase, "project-media", p.cover_image_path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
