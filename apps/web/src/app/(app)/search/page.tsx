import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getViewerVoteState,
  parseStatusFilters,
  searchPeople,
  searchProjects,
  searchTagDirectory,
  transformedStorageUrl,
  type PersonHit,
} from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/session";
import { storageUrl } from "@/lib/storage-url";
import { ProjectCard } from "@/components/project/project-card";
import { SearchField } from "./search-field";
import { SearchFilters } from "./search-filters";

export const metadata: Metadata = { title: "Search — CoBuild" };

/** Repeated params arrive as `string[]`; a single one as `string`. */
function asArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function SectionHeading({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="text-base font-bold">{title}</h2>
      <span className="font-mono text-[11.5px] text-[var(--color-text-tertiary)]">{count}</span>
    </div>
  );
}

function PersonRow({ person }: { person: PersonHit }) {
  const base = storageUrl(person.avatar_url, "avatars");
  const avatar = base ? transformedStorageUrl(base, { width: 80, height: 80, fit: "cover" }) : null;

  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-[15px] py-[13px]">
      <span className="h-10 w-10 flex-none overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_4px,var(--color-bg-panel-alt)_4px_8px)]">
        {avatar && (
          <Image
            src={avatar}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="h-full w-full object-cover"
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[var(--color-text-primary)]">
            {person.display_name ?? person.username}
          </span>
          <span className="font-mono text-[11.5px] text-[var(--color-accent)]">
            @{person.username}
          </span>
        </span>
        <span className="truncate text-[12.5px] text-[var(--color-text-secondary)]">
          {person.headline ?? "Builder on CoBuild"}
        </span>
      </span>
      <Link
        href={`/u/${person.username}`}
        className="flex-none rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-[15px] py-2 text-[12.5px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
      >
        View
      </Link>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; status?: string | string[]; tag?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const statuses = parseStatusFilters(asArray(params.status));
  // Tag slugs are not validated against a list here — an unknown slug simply
  // matches nothing in `search_projects`, and the value is passed as a bound
  // array parameter, never interpolated.
  const tags = [...new Set(asArray(params.tag))].slice(0, 8);

  const supabase = await createClient();
  const { user: viewer } = await getAuthState();

  const [projects, people, tagResults, directory] = await Promise.all([
    searchProjects(supabase, { q, statuses, tags }),
    searchPeople(supabase, { q }),
    searchTagDirectory(supabase, { q }),
    // The unfiltered directory: it feeds the filter row's chips (which must not
    // reshuffle as the query changes) and doubles as the fallback tag list
    // under a no-results state.
    searchTagDirectory(supabase),
  ]);

  const voteState =
    viewer && projects.items.length > 0
      ? await getViewerVoteState(
          supabase,
          viewer.id,
          projects.items.map((i) => i.id),
        )
      : { voted: new Set<string>(), bookmarked: new Set<string>() };

  const searched = q.length > 0;
  const nothingFound =
    searched && projects.total === 0 && people.total === 0 && tagResults.total === 0;

  // The empty state tells the reader to "browse the tag directory below", so
  // when the query matched no tags there has to actually be one down there —
  // fall back to the unfiltered directory rather than leaving the copy
  // pointing at nothing.
  const tagSection = nothingFound ? directory : tagResults;
  const tagsAreDirectory = nothingFound || !searched;

  return (
    <div className="flex max-w-[860px] flex-col gap-5">
      <SearchField initialQuery={q} />

      <SearchFilters
        q={q}
        statuses={statuses}
        tags={tags}
        tagOptions={directory.items.slice(0, 8)}
      />

      {nothingFound ? (
        <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card-lg)] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-7 py-14 text-center">
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[8px] bg-[var(--color-bg-panel-alt)] text-[var(--color-accent)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-lg font-bold">No matches for “{q}”</div>
            <div className="max-w-[340px] text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              Try a shorter query, drop a filter, or browse the tag directory below.
            </div>
          </div>
          <Link
            href="/search"
            className="rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] px-[17px] py-2.5 text-[13.5px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
          >
            Clear search
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-[26px]">
        {projects.items.length > 0 && (
          <section className="flex flex-col gap-[13px]">
            <SectionHeading title="Projects" count={String(projects.total)} />
            <div className="flex flex-col gap-4 xl:grid xl:grid-cols-2 xl:gap-[18px]">
              {projects.items.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  viewerId={viewer?.id ?? null}
                  voted={voteState.voted.has(p.id)}
                  bookmarked={voteState.bookmarked.has(p.id)}
                />
              ))}
            </div>
          </section>
        )}

        {people.items.length > 0 && (
          <section className="flex flex-col gap-[13px]">
            <SectionHeading title="People" count={String(people.total)} />
            <div className="flex flex-col gap-2.5">
              {people.items.map((u) => (
                <PersonRow key={u.id} person={u} />
              ))}
            </div>
          </section>
        )}

        {tagSection.items.length > 0 && (
          <section className="flex flex-col gap-[13px]">
            <SectionHeading
              title={tagsAreDirectory ? "Popular tags" : "Tags"}
              count={tagsAreDirectory ? "directory" : String(tagSection.total)}
            />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5">
              {tagSection.items.map((t) => (
                <Link
                  key={t.slug}
                  href={`/tag/${t.slug}`}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] px-3.5 py-3 hover:border-[var(--color-accent)]/50"
                >
                  <span className="rounded-sm bg-[var(--color-bg-raised)] px-2 py-1 font-mono text-xs font-medium text-[var(--color-text-secondary)]">
                    {t.name}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]">
                    {t.usage_count.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
