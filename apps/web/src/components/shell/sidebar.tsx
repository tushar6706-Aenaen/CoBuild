import Image from "next/image";
import Link from "next/link";
import { sidebarNav } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";

/**
 * Desktop-only left rail (246px), per `CoBuild.dc.html`. Hidden below `lg`,
 * where the mobile bottom bar takes over.
 */
export function Sidebar({
  username,
  displayName,
  avatarUrl,
  unreadCount,
}: {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  unreadCount: number;
}) {
  const profileHref = username ? `/u/${username}` : null;

  return (
    <aside className="sticky top-0 hidden h-screen w-[246px] flex-none flex-col gap-[22px] self-start border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] px-4 py-[22px] lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[5px] bg-[var(--color-accent)] text-[15px] font-extrabold text-[var(--color-accent-on)]">
          C
        </span>
        <span className="font-mono text-base font-medium tracking-tight text-[var(--color-text-primary)]">
          CoBuild
        </span>
      </Link>

      <SidebarNav items={sidebarNav(profileHref, !!username)} unreadCount={unreadCount} />

      <Link
        href="/new"
        className="flex items-center justify-center gap-2 rounded-[6px] bg-[var(--color-accent)] px-3 py-3 text-sm font-bold text-[var(--color-accent-on)] shadow-[0_8px_22px_rgba(59,227,143,0.3)] hover:bg-[var(--color-accent-hover)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Post a project
      </Link>

      <div className="flex-1" />

      {username ? (
        <Link
          href={`/u/${username}`}
          className="flex items-center gap-2.5 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] p-2.5 text-left hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-raised)]"
        >
          <span className="h-8 w-8 flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)]">
            {avatarUrl && (
              <Image src={avatarUrl} alt="" width={32} height={32} unoptimized className="h-full w-full object-cover" />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-bold text-[var(--color-text-primary)]">
              {displayName ?? username}
            </span>
            <span className="truncate font-mono text-[11px] text-[var(--color-text-tertiary)]">@{username}</span>
          </span>
        </Link>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] p-[15px]">
          <span className="text-[13px] font-bold">Join CoBuild</span>
          <span className="text-xs leading-snug text-[var(--color-text-secondary)]">
            Upvote projects, follow builders, and build a portfolio.
          </span>
          <Link
            href="/login"
            className="rounded-[6px] bg-[var(--color-text-primary)] py-2.5 text-center text-[13px] font-bold text-[var(--color-bg-page)] hover:bg-white"
          >
            Sign in
          </Link>
        </div>
      )}
    </aside>
  );
}
