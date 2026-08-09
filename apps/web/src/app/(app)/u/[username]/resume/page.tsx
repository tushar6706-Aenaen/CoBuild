import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfileByUsername, getProfileProjects } from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { PrintButton } from "./print-button";

/**
 * The résumé view — `PROJECT_INFO.md` pitches profiles as "a public portfolio
 * you can link on a résumé", and this is the surface that makes that literal.
 *
 * Two deliberate departures from the rest of the app:
 *
 * 1. **It is a light document, not a dark screen.** Every other route is the
 *    green-black palette; a résumé is printed, and a dark sheet is unusable on
 *    paper (and burns a cartridge). The colours here are local literals rather
 *    than tokens on purpose — they are paper, not product chrome, so they must
 *    NOT follow a palette change. This is the one place in the app where not
 *    using `@cobuild/tokens` is correct.
 * 2. **Public projects only, always** — including for the owner. Everywhere
 *    else the owner sees their own drafts and unlisted work; a résumé is a
 *    document made to be handed to strangers, and a draft title leaking into a
 *    PDF someone emails to a recruiter is not a recoverable mistake.
 */

const LINK_LABELS: Record<string, string> = {
  github: "GitHub",
  website: "Website",
  x: "X",
  linkedin: "LinkedIn",
  behance: "Behance",
  dribbble: "Dribbble",
  figma: "Figma",
};

/** How many projects fit a one-page document before it stops being a résumé. */
const RESUME_PROJECT_LIMIT = 8;

type Params = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const profile = await getProfileByUsername(supabase, username);
  if (!profile) return { title: "Profile not found — CoBuild" };
  return {
    title: `${profile.display_name ?? profile.username} — résumé — CoBuild`,
    // The canonical profile is what should rank; this is a printable view of it.
    robots: { index: false, follow: true },
  };
}

export default async function ResumePage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const supabase = await createClient();

  const profile = await getProfileByUsername(supabase, username);
  if (!profile) notFound();

  const projects = (await getProfileProjects(supabase, profile.id, false)).slice(
    0,
    RESUME_PROJECT_LIMIT,
  );

  const links = Object.entries((profile.links ?? {}) as Record<string, string>).filter(
    ([, url]) => typeof url === "string" && url.trim().length > 0,
  );

  const profileUrl = new URL(`/u/${profile.username}`, siteUrl()).toString();
  const name = profile.display_name ?? profile.username ?? "Builder";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[820px] items-center justify-between print:hidden">
        <Link
          href={`/u/${profile.username}`}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to profile
        </Link>
        <PrintButton />
      </div>

      {/* Two things carry this element:
          - `print-color-adjust: exact` stops the browser dropping the white
            sheet and the rules when printing — without it this comes out as
            unstyled text on whatever the printer defaults to.
          - `[&_a]:text-inherit` because globals.css colours every anchor with
            the app's accent green: correct on the dark product, wrong on a
            white sheet and nearly invisible printed. On paper the underline is
            the affordance, not the hue. */}
      <article
        className="w-full max-w-[820px] rounded-[var(--radius-card)] bg-white px-12 py-11 text-[#14171A] shadow-[0_20px_60px_rgba(0,0,0,0.45)] [&_a]:text-inherit print:max-w-none print:rounded-none print:px-0 print:py-0 print:shadow-none"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <header className="flex flex-col gap-1.5 border-b-2 border-[#14171A] pb-4">
          <h1 className="text-[30px] leading-tight font-bold tracking-tight">{name}</h1>
          {profile.headline && (
            <p className="text-[15px] text-[#3D444B]">{profile.headline}</p>
          )}

          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-[#5A6169]">
            <a href={profileUrl} className="underline">
              {profileUrl.replace(/^https?:\/\//, "")}
            </a>
            {profile.location && <span>· {profile.location}</span>}
            {profile.is_student && (
              <span>
                · Student{profile.college ? `, ${profile.college}` : ""}
                {profile.grad_year ? ` (${profile.grad_year})` : ""}
              </span>
            )}
          </p>

          {links.length > 0 && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-[#5A6169]">
              {links.map(([key, url]) => (
                <a key={key} href={url} className="underline">
                  {LINK_LABELS[key] ?? key}
                </a>
              ))}
            </p>
          )}
        </header>

        {profile.bio && (
          <section className="mt-5">
            <h2 className="mb-1.5 text-[12px] font-bold tracking-[0.08em] text-[#5A6169] uppercase">
              About
            </h2>
            <p className="text-[13.5px] leading-relaxed whitespace-pre-line">{profile.bio}</p>
          </section>
        )}

        <section className="mt-5 flex gap-8 border-y border-[#D8DDE2] py-3">
          {[
            { k: "Projects", v: profile.project_count },
            { k: "Upvotes earned", v: profile.total_upvotes_received },
            { k: "Followers", v: profile.follower_count },
          ].map((s) => (
            <div key={s.k} className="flex flex-col">
              <span className="text-[18px] font-bold">{s.v.toLocaleString()}</span>
              <span className="text-[11.5px] text-[#5A6169]">{s.k}</span>
            </div>
          ))}
        </section>

        <section className="mt-5">
          <h2 className="mb-3 text-[12px] font-bold tracking-[0.08em] text-[#5A6169] uppercase">
            Selected projects
          </h2>

          {projects.length === 0 ? (
            <p className="text-[13.5px] text-[#5A6169]">
              No public projects yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {projects.map((p) => (
                // `break-inside-avoid` keeps an entry from being split across a
                // page boundary, which is the difference between a document and
                // a web page that happened to be printed.
                <li key={p.id} className="flex flex-col gap-1 break-inside-avoid">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-[15px] font-bold">
                      <a
                        href={new URL(`/p/${profile.username}/${p.slug}`, siteUrl()).toString()}
                        className="underline"
                      >
                        {p.title}
                      </a>
                    </h3>
                    <span className="flex-none text-[12px] text-[#5A6169]">
                      {p.upvote_count.toLocaleString()} upvotes
                      {p.published_at
                        ? ` · ${new Date(p.published_at).getFullYear()}`
                        : ""}
                    </span>
                  </div>
                  {p.tagline && (
                    <p className="text-[13px] leading-snug text-[#3D444B]">{p.tagline}</p>
                  )}
                  {p.tags.length > 0 && (
                    <p className="text-[12px] text-[#5A6169]">
                      {p.tags.map((t) => t.name).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="mt-7 border-t border-[#D8DDE2] pt-3 text-[11px] text-[#767D85]">
          Generated from {profileUrl.replace(/^https?:\/\//, "")}
        </footer>
      </article>
    </div>
  );
}
