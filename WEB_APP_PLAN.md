# CoBuild — Web App Build Plan

Companion files: [MOBILE_APP_PLAN.md](MOBILE_APP_PLAN.md) · [CHECKLIST.md](CHECKLIST.md)

## Context

Design is done — `CoBuild design system/CoBuild.dc.html` and `ProjectCard.dc.html` are interactive component specs (props, local state, click handlers) covering all 10 screens: sign-in, username onboarding, home feed, project detail, create/edit, profile, leaderboard, search, tag page, notifications. `ProjectCard.dc.html` in particular is a literal behavior spec — optimistic vote/save state, a sign-in gate for logged-out actions, a hover mini-card, a toast — that should be translated faithfully, not reinterpreted.

**Design tokens extracted from the file** (feed into `packages/tokens`, don't re-derive):

| Role | Value |
|---|---|
| Page background | `#090A09` |
| Card/panel background | `#0F110F` (secondary panel `#121412`) |
| Input background | `#0E100E` |
| Border (default) | `rgba(255,255,255,0.07–0.1)` |
| Primary text | `#E8EDE8` |
| Secondary text | `#8B8F8B` / `#949994` |
| Tertiary text / meta | `#6E736E` |
| Placeholder | `#5A605A` |
| Accent (primary action, upvote) | `#3BE38F`, hover `#55EAA1`, on-accent text `#04180E` |
| Accent muted (mint, tags/links) | `#8DEEBB` |
| Link hover | `#D3C6FF` |
| Info / "Shipped" badge | `#6FD2E8` |
| Warning / "In progress" badge | `#F5B950` |
| Danger / delete | `#FF7A7A` / `#FF9B9B` |
| Font — UI | Plus Jakarta Sans (400/500/600/700/800) |
| Font — mono (numbers, handles, tags, code) | JetBrains Mono (400/500) |
| Radius | 6–10px controls, 8–11px cards |

These are the values as extracted, kept as a historical record. Two have since
been changed on purpose and `packages/tokens/src/colors.ts` is authoritative:
**Link hover** is now `#A5F2C9`, not the lavender `#D3C6FF`, and
**status-archived** is `#6E736E`, not a Slate grey — the product wants no
blue-tinted chrome. The one cool hue that remains is the `#6FD2E8` "Shipped"
badge, kept because it is a semantic status and does not collide with the
accent green. The neutrals briefly ran on the Tailwind Slate scale; they were
restored to the green-tinted originals above from `colotheme/colortheme.png`.

Web ships first per the approved plan: it's the SEO-indexable, shareable-URL half of the product, and the shared package + Supabase schema it produces is what makes the mobile build fast afterward.

**Supabase:** reuse the existing project `mwxokedrwjlyrqcwvdur` (ap-southeast-1, Postgres 17.6, already `ACTIVE_HEALTHY`) — do not provision a new one.

## Agent assignment strategy

Two agents, used deliberately by task shape, not by phase:

- **Sonnet 5 — grunt work.** Scaffolding, CRUD screens, forms, translating a `.dc.html` spec into a real React/shadcn component, wiring routine queries, the seed script, repetitive multi-file work. High volume, low ambiguity, cheap to iterate.
- **Opus 5 — heavy work.** Anything wrong-and-you-won't-notice-for-weeks: RLS policy design + adversarial testing, the ranking/hot-score SQL, storage security paths, OAuth flows, and an **end-of-phase review pass** on everything Sonnet produced that phase — correctness, N+1 queries, missing indexes, RLS gaps, dead code.

Rule of thumb: if a bug would show up as a broken button, Sonnet owns it. If a bug would show up as a data leak, a bad ranking, or a slow query at scale, Opus designs and reviews it. If Sonnet loops on something twice without converging, hand it to Opus.

## Phases

### Phase 0 — Foundation (Sonnet scaffolds, Opus designs schema + reviews)

| Task | Agent | Why |
|---|---|---|
| Turborepo/pnpm workspace scaffold, `apps/web`, `packages/{db,shared,tokens}` | Sonnet | Boilerplate |
| `packages/tokens` from the palette above; Tailwind 4 `@theme inline` mapping | Sonnet | Mechanical translation |
| Full DB schema + migrations (profiles, projects, project_images, tags, project_tags, project_collaborators, votes, comments, bookmarks, follows, project_views, notifications, reports) | **Opus** | Wrong FKs/constraints here are expensive later; this is the one file every future feature depends on |
| RLS policies for every table + Storage buckets | **Opus** | A wrong policy silently leaks or blocks data — must be designed adversarially, not by pattern-matching |
| Hot-score trigger + counter-maintenance triggers | **Opus** | Correctness bug is invisible until the feed just "feels wrong" |
| Storage buckets (`avatars`, `project-media`), image-transform config | Sonnet, reviewed by Opus | Config is mechanical; the security boundary (path-prefix policy) needs Opus sign-off |
| Seed script (TS, uploads real images, ~30 users/~80 projects) | Sonnet | Data generation, no design judgment needed |
| `supabase gen types typescript` → `packages/db` | Sonnet | Mechanical |
| **Phase-end review**: `get_advisors`, RLS adversarial test pass, query plan check on feed queries | **Opus** | Gate before any app code is written on top of this schema |

### Phase 1 — Auth + onboarding

| Task | Agent | Why |
|---|---|---|
| Sign-in screen from `CoBuild.dc.html` (GitHub/Google/magic link) | Sonnet | Direct translation of an existing spec |
| Supabase Auth config: GitHub + Google providers, redirect URLs | **Opus** | OAuth misconfiguration is a common, hard-to-debug security gap |
| `/auth/callback` route, session handling via `@supabase/ssr` | **Opus** | Session/cookie handling is a frequent source of subtle auth bugs |
| Username-claim onboarding screen (live availability check, avatar upload, roles, student toggle) | Sonnet | Form + spec translation |
| Reserved-slug blocklist, username uniqueness edge cases | Sonnet, reviewed by Opus | Straightforward to build, worth a second look before it's load-bearing |

### Phase 2 — Profile

| Task | Agent | Why |
|---|---|---|
| Public profile page (`/u/username`) — stats, links, role chips, student badge, tabs (Projects/Contributions/Bookmarks) | Sonnet | Direct spec translation |
| Settings/edit-profile screen | Sonnet | Standard form |
| Follow/unfollow with optimistic count updates | Sonnet | Pattern established by ProjectCard's vote logic |
| **Review**: N+1 checks on profile stats queries, RLS check on private bookmarks tab | **Opus** | Profile page is read on every project card hover — must be cheap |

### Phase 3 — Project composer + detail

| Task | Agent | Why |
|---|---|---|
| Create/edit form: multi-image upload, drag-reorder, cover selection, tags, links, status, visibility | Sonnet | Spec exists (`scCreate`), mechanical build |
| Client-side image compression + direct-to-Storage upload | **Opus** | This is the app's main cost/perf risk (unbounded image sizes) — must be gotten right once |
| Project detail page (`scDetail`): gallery + lightbox, credited co-builders, comments (2-level nesting), stats sidebar | Sonnet | Full spec available line-for-line in the design file |
| `ProjectCard` component | Sonnet | `ProjectCard.dc.html` is a near-complete implementation spec including state and gating logic |
| Orphaned-upload cleanup job | Sonnet | Scheduled job, mechanical |
| **Review**: verify uploads can't write outside the user's path prefix; verify image transform sizes match each surface | **Opus** | Security + perf gate before this ships |

### Phase 4 — Feed + engagement

| Task | Agent | Why |
|---|---|---|
| Feed tabs (Hot/New/Top/Following) + Top's time-window selector | Sonnet | UI matches `scFeed` spec exactly |
| Keyset pagination wiring | **Opus** | Easy to get subtly wrong (duplicate/skipped rows); must be tested under concurrent writes |
| Vote/comment/bookmark mutations with optimistic UI | Sonnet | Pattern is fully specified in `ProjectCard.dc.html` |
| View-count RPC (`record_project_view`) | **Opus** | Must be abuse-resistant by construction, not by convention |
| Feed skeleton/empty states | Sonnet | Already fully specified in the design file |
| **Review**: full-scroll pagination test, ranking correctness test (old-high-score vs new-low-score ordering) | **Opus** | The feed's core value proposition — must be verified, not assumed |

### Phase 5 — Discovery

| Task | Agent | Why |
|---|---|---|
| Leaderboard (`scBoard`) — projects/builders tabs, Today/Week windows, rank-change indicator | Sonnet | Spec-driven UI |
| `leaderboard_daily` materialized view + refresh cron | **Opus** | Windowing logic (last-24h vs lifetime) is where leaderboards usually go subtly wrong |
| Search (`scSearch`) — projects/people/tags, filters | Sonnet | Standard search UI |
| Postgres FTS query + `search_tsv` trigger | **Opus** | Query correctness/perf under real data volume |
| Tag pages (`scTag`) | Sonnet | Reuses the feed component |

### Phase 6 — Notifications + polish

| Task | Agent | Why |
|---|---|---|
| Notifications screen (`scNotifs`), mark-read | Sonnet | Spec-driven UI |
| Notification-writing triggers (vote/comment/follow/credit) | Sonnet, reviewed by Opus | Mechanical fan-out, but must not double-fire |
| Global nav, empty states, loading states, delete-confirmation dialog | Sonnet | Fully specified already |
| **Final review before mobile starts**: full RLS adversarial pass, `get_advisors` check, query performance audit across the whole schema, dead-code/simplification pass | **Opus** | Last checkpoint before this schema and API layer become the foundation mobile also depends on |

## Verification (end of web build)

- Sign in with all three methods; complete onboarding; confirm reserved slugs are rejected.
- Post a project with a multi-image gallery, reorder images, change cover, credit a co-builder — confirm it appears on the co-builder's Contributions tab.
- Upvote/comment/bookmark from a card and from the detail page; confirm counts match and persist on refresh.
- Confirm Hot/New/Top/Following all return correct, stable order while new votes are inserted concurrently (no duplicate/skipped rows across pages).
- As user A, attempt via direct API/SQL to vote as user B, edit B's project, read B's draft, insert a fake view, or upload to B's storage path — all must fail.
- Confirm a logged-out browser can read feed, project, and profile pages, and gets prompted to sign in on any interaction.
- `turbo run typecheck` and `supabase db lint` / `get_advisors` clean.
