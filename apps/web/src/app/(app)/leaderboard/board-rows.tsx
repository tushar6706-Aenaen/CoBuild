import Image from "next/image";
import Link from "next/link";
import { transformedStorageUrl } from "@cobuild/shared";
import type { LeaderboardBuilderRow, LeaderboardProjectRow } from "@cobuild/shared";
import { storageUrl } from "@/lib/storage-url";

/**
 * Medal colours for the top three. Gold reuses the "In progress" token
 * (identical hex, and the board is where a number, not a status, is being
 * coloured); silver reuses secondary text. Bronze has no equivalent anywhere
 * else in the product, so it is the one literal here.
 */
function rankColor(rank: number) {
  if (rank === 1) return "var(--color-status-in-progress)";
  if (rank === 2) return "var(--color-text-secondary)";
  if (rank === 3) return "#c08a5e";
  return "var(--color-text-tertiary)";
}

function Rank({ rank }: { rank: number }) {
  return (
    <span
      className="w-[30px] flex-none text-center font-mono font-medium"
      style={{ color: rankColor(rank), fontSize: rank <= 3 ? "17px" : "14px" }}
    >
      {rank}
    </span>
  );
}

/**
 * Rank movement since the previous refresh.
 *
 * `null` means "was not on the previous board" and reads as `new` — kept
 * distinct from `0` ("held position", an em dash), because collapsing the two
 * would tell a brand-new entrant it hadn't moved.
 */
function Delta({ delta }: { delta: number | null }) {
  const label = delta === null ? "new" : delta === 0 ? "—" : delta > 0 ? `+${delta}` : `${delta}`;
  const tone =
    delta === null || delta === 0
      ? { background: "rgba(255,255,255,0.05)", color: "var(--color-text-tertiary)" }
      : delta > 0
        ? { background: "rgba(111,210,232,0.12)", color: "var(--color-status-shipped)" }
        : { background: "rgba(255,122,122,0.10)", color: "var(--color-status-danger-strong)" };

  const title =
    delta === null
      ? "New on this board"
      : delta === 0
        ? "No change since the last refresh"
        : delta > 0
          ? `Up ${delta} since the last refresh`
          : `Down ${-delta} since the last refresh`;

  return (
    <span
      title={title}
      className="flex-none rounded-[4px] px-2 py-[3px] font-mono text-[11px]"
      style={tone}
    >
      {label}
    </span>
  );
}

function Votes({ count }: { count: number }) {
  return (
    <span className="flex min-w-[64px] flex-none flex-col items-end gap-px">
      <span className="font-mono text-sm font-medium text-[var(--color-accent-muted)]">
        {count.toLocaleString()}
      </span>
      <span className="text-[10.5px] text-[var(--color-text-tertiary)]">upvotes</span>
    </span>
  );
}

const row =
  "flex items-center gap-3.5 border-b border-[var(--color-border-subtle)] px-4 py-3.5 last:border-b-0 hover:bg-[var(--color-bg-panel-alt)]";

export function ProjectRows({ rows }: { rows: LeaderboardProjectRow[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)]">
      {rows.map((r) => {
        const base = storageUrl(r.cover_image_path, "project-media");
        const cover = base
          ? transformedStorageUrl(base, { width: 116, height: 76, fit: "cover" })
          : null;
        const author = r.author_username;
        const sub = [author ? `@${author}` : null, ...r.tags.slice(0, 3)]
          .filter(Boolean)
          .join(" · ");

        return (
          <Link
            key={r.id}
            href={author ? `/p/${author}/${r.slug}` : "#"}
            className={`${row} text-[var(--color-text-primary)]`}
          >
            <Rank rank={r.rank} />
            <span className="h-[38px] w-[58px] flex-none overflow-hidden rounded-[5px] border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_8px,var(--color-bg-panel-alt)_8px_16px)]">
              {cover && (
                <Image
                  src={cover}
                  alt=""
                  width={58}
                  height={38}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[14.5px] font-bold">{r.title}</span>
              <span className="truncate text-[12.5px] text-[var(--color-text-tertiary)]">
                {sub}
              </span>
            </span>
            <Delta delta={r.delta} />
            <Votes count={r.votes} />
          </Link>
        );
      })}
    </div>
  );
}

export function BuilderRows({ rows }: { rows: LeaderboardBuilderRow[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)]">
      {rows.map((r) => {
        const base = storageUrl(r.avatar_url, "avatars");
        const avatar = base
          ? transformedStorageUrl(base, { width: 76, height: 76, fit: "cover" })
          : null;
        const projects = `${r.projects_in_window} ${r.projects_in_window === 1 ? "project" : "projects"} in window`;

        return (
          <Link
            key={r.id}
            href={`/u/${r.username}`}
            className={`${row} text-[var(--color-text-primary)]`}
          >
            <Rank rank={r.rank} />
            <span className="h-[38px] w-[38px] flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)]">
              {avatar && (
                <Image
                  src={avatar}
                  alt=""
                  width={38}
                  height={38}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[14.5px] font-bold">
                {r.display_name ?? r.username}
              </span>
              <span className="truncate text-[12.5px] text-[var(--color-text-tertiary)]">
                @{r.username} · {projects}
              </span>
            </span>
            <Delta delta={r.delta} />
            <Votes count={r.votes} />
          </Link>
        );
      })}
    </div>
  );
}
