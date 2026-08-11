# CoBuild — New Features Plan (Phase 7+)

Companion files: [PROJECT_INFO.md](PROJECT_INFO.md) · [WEB_APP_PLAN.md](WEB_APP_PLAN.md) · [CHECKLIST.md](CHECKLIST.md) · [MOBILE_APP_PLAN.md](MOBILE_APP_PLAN.md)

**Working tracker: [NEW_FEATURES_TODO.md](NEW_FEATURES_TODO.md)** — this file is the *why*; that
one is *where we are*. Update it as work lands.

Everything in `WEB_APP_PLAN.md` Phases 0–6 is the *product*. This file is what makes it
**outstanding** — the features that separate CoBuild from "a Reddit clone for projects".
Same agent-assignment rules as the web plan: Sonnet owns broken-button bugs, Opus owns
data-leak / bad-ranking / slow-query bugs.

---

## Prerequisites (do these before starting Phase 7)

Not new features, but nothing below can be evaluated without them:

- [x] ~~**Run the seed**~~ — **done.** 35 profiles / 83 projects / 207 images / 21 tags / 1069 votes / 365 comments. The feed, leaderboard, search and OG covers are all judgeable on real data now.
- [ ] **Phase 6's final Opus review** — full RLS adversarial pass, `get_advisors`, perf audit, simplification pass. This is the gate before new schema lands on top.
- [x] ~~**The open toast bug**~~ — **closed.** It was never a revalidation/remount problem: live verification had been running in a hidden automation tab, where `requestAnimationFrame` never fires, so React never revealed the Suspense boundary, the page never hydrated, and the form fell back to a native POST. The toast layer everything below depends on is verified working on a production build. See `PROJECT_INFO.md`'s gotchas before doing browser verification of any feature here.

---

## Ordering principle

Three groups, in this order, for a reason:

1. **Distribution first.** Nothing else matters if nobody arrives. Phase 7 is the only group whose payoff is *new visitors*, and it's also the cheapest.
2. **Differentiation second.** Phases 8–10 are what make CoBuild not-a-clone. They cost schema.
3. **Retention third.** Phase 11 only pays off once 1 and 2 have produced something worth coming back to.

---

## One thing that already exists and is unused

`profiles.open_to_collab` (boolean) and `profiles.weekly_hours_available` (int) are in the
live schema and populated by `packages/db/src/seed/seed.ts`, but **nothing reads or writes
them**: they're absent from `PROFILE_COLUMNS` in `packages/shared/src/profiles.ts:34`, from
the profile page, and from `/settings/profile`. The data model for collaboration is half-built
already. Phase 8 finishes it rather than inventing it.

---

## Phase 7 — Distribution & cold start — **COMPLETE**

All four items are built and verified; [CHECKLIST.md](CHECKLIST.md) holds the evidence and
`PROJECT_INFO.md` the gotchas each one produced. The plan below is kept because the reasoning
still explains *why* each piece exists — with corrections marked where building it proved the
plan wrong.

Still open on this phase: an Opus review pass over it, and re-checking the OG cards against
real covers once `pnpm seed` has run.

The whole phase is app-layer. **No new tables except `tag_follows`.** Highest payoff per unit
of work in this document.

| Task | Agent | Why |
|---|---|---|
| Dynamic OG images for `/p/[username]/[slug]` and `/u/[username]` | Sonnet | Mechanical `ImageResponse` work, high visual payoff |
| README badge `/badge/[username].svg` + embeddable project card | Sonnet | Static-ish route, cacheable |
| Résumé/print view of a profile | Sonnet | Mostly CSS |
| `tag_follows` table + Following-tab union | **Opus** | Touches `feed_page`'s keyset pagination — see gotcha |

### 7.1 Dynamic OG images — **built**

Shipped: `opengraph-image.tsx` in the `/p/[username]/[slug]` and `/u/[username]` segments,
shared chrome in `apps/web/src/lib/og/`, fonts vendored to `apps/web/assets/fonts`. Both
cards were rendered and inspected, the draft-privacy case was verified against a real draft,
and the two gotchas below turned out to be real — they're now in `PROJECT_INFO.md`. See
[CHECKLIST.md](CHECKLIST.md) for the item-by-item state.

**What:** Every project and profile URL unfurls into a real card on X / LinkedIn / Discord /
Slack — cover image, title, author, stack chips, upvote count. Built with Next 16's
`ImageResponse` at `apps/web/src/app/p/[username]/[slug]/opengraph-image.tsx` and the
profile equivalent.

**Why:** This is the single best effort-to-growth ratio available. A showcase product's
growth loop *is* people sharing links to their own work; right now every one of those shares
renders as a grey nothing. It also costs no schema and no migration.

**Gotchas — as resolved in the build:**
- **Visibility** turned out to be the opposite of what this file originally said. The route does *not* filter `visibility = 'public'`; it runs as `anon`, and RLS is what decides. `unlisted` renders on purpose — a preview shown to someone who already holds the direct link exposes nothing the page wouldn't — while drafts fall back to the generic card, verified live. The public-only rule stays what `PROJECT_INFO.md` says it is: a rule about *listing* surfaces, not direct-link ones.
- **satori refuses WebP**, which is the format this app prefers to store. Solved by negotiating the format on Supabase's transform endpoint via the `Accept` header, not by adding `sharp`.
- **Supabase's `resize=contain` bounds only the width**, so a portrait cover overflowed the card. Solved by computing the fitted box from the cover's real dimensions.
- Fonts must be raw `ttf`/`otf`/`woff` bytes — `next/font/google` emits `woff2`, which satori cannot parse, so the three weights actually used are vendored into the repo.
- `metadataBase` is required or every preview URL points at `localhost`; production must set `NEXT_PUBLIC_SITE_URL`.

### 7.2 README badge + embed

**What:** `<img src="cobuild.dev/badge/tushar.svg">` renders a live badge (project count,
total upvotes, rank). Plus `/embed/p/[username]/[slug]` — a minimal iframe-able card.

**Why:** This audience's actual homepage is a GitHub README. A badge that updates itself is a
permanent inbound link from every contributor's profile, at roughly a day of work.

**Gotchas:**
- SVG must be generated server-side and served with a sane `Cache-Control` (e.g. `s-maxage=300, stale-while-revalidate`) — GitHub proxies images through Camo, so it's cached anyway; don't fight it.
- Public-only, again. Counts come from the trigger-maintained columns (`project_count`, `total_upvotes_received`) — read them, never write them.
- No user-controlled text interpolated into the SVG without escaping (`display_name` is free text; an unescaped `<` breaks or injects).

### 7.3 Résumé / portfolio export

**What:** A print-optimised rendering of `/u/[username]` — top N projects, stack summary,
links, student badge — that prints to a clean one-page PDF via the browser.

**Why:** `PROJECT_INFO.md`'s pitch is literally "profiles that double as a public portfolio
you can link on a résumé." This makes that sentence true instead of aspirational, and it's
mostly a print stylesheet plus a route variant.

**Gotchas:** avatar/cover images need `print-color-adjust: exact`; the dark palette must
invert for print (a green-black résumé is unprintable).

### 7.4 Tag follows

**What:** The `tag_follows` table that `CHECKLIST.md:94` records as deliberately skipped —
plus wiring the Follow-tag button on `/tag/[slug]` and folding followed tags into the
Following feed.

**Why:** A new user's Following tab is empty, which is the worst possible first impression on
a feed-shaped product. Following *stacks* is a much lower-commitment first action than
following people, and it gives a real personalization signal.

**Schema:** `tag_follows(profile_id, tag_id, created_at)`, PK `(profile_id, tag_id)`, RLS
mirroring `follows`, plus a `follower_count` on `tags` maintained by trigger (never
client-writable, same guard pattern as the other counters).

**Gotchas — as resolved in the build:**
- The Following branch became one `select … from projects` with an `OR`, **not** a `UNION` — that is what gives dedup for free and keeps the `(published_at, id)` cursor meaning one thing. No float is involved in this tab, so the `extra_float_digits` trap doesn't apply.
- The counter trigger function shipped callable over PostgREST and had to be revoked from `public` **and** from `anon, authenticated`; `get_advisors` caught it straight after the migration.

---

## Phase 8 — Collaboration ("Looking for")

The product is named CoBuild and is currently one-way. This is the defensible difference:
Devpost, Dribbble, and Product Hunt are all pure showcases.

| Task | Agent | Why |
|---|---|---|
| `looking_for` on projects + composer UI + feed/search facet | Sonnet | Form + filter work |
| Surface `open_to_collab` / `weekly_hours_available` in settings + profile | Sonnet | Fields already exist, just unwired |
| Request-to-join flow (`collab_requests`) + notifications | **Opus** | New write path from a stranger to your project — RLS matters |

### 8.1 "Looking for" on a project

**What:** A project declares what it wants: `co-builder`, `feedback`, `beta-testers`,
`designer`, `nothing` (default). Rendered as a chip on the card and detail page, filterable
on the feed and in search facets.

**Schema:** `projects.looking_for text[]` (or a small enum-constrained table if it should be
searchable as a facet — decide with the search work, since `/search` already has facet chips).

**Why:** It converts a passive gallery into an actionable one, and it's the intent signal that
makes the whole collaboration layer possible. Also gives the feed a genuinely new axis to
browse by, which no competitor offers.

### 8.2 Request to join

**What:** An authenticated user sends a short pitch to a project owner; the owner accepts or
declines from notifications; accepting creates a `project_collaborators` row in `pending` →
`accepted`, which already auto-adds to the collaborator's portfolio.

**Schema:** `collab_requests(id, project_id, requester_id, message, status, created_at)` —
status `pending | accepted | declined | withdrawn`. Unique partial index on
`(project_id, requester_id) where status = 'pending'` so one person can't spam N requests.

**Why:** `project_collaborators` and `notify_on_credit` already exist — this is the missing
front door to them. It's also the feature that gives students a reason to open the app when
they *don't* have something to post.

**Gotchas (Opus):**
- This is the first path where a stranger writes a row that a project owner reads. RLS: requester can insert and read/withdraw their own; owner can read and update status on requests to *their* projects; nobody else can read either side. Test adversarially with real JWTs, the way Phase 2's bookmarks tab was tested.
- Rate-limit at the DB level, not the UI — an unauthenticated-adjacent write path with a free-text field is a spam vector. `reports` exists but has no moderation queue behind it yet (see Backlog).
- Accepting must not let the requester write to `projects`; collaborator ≠ editor unless you decide it is. **Open decision below.**

---

## Phase 9 — Devlogs / build updates

**What:** Append timestamped updates to an existing project — text plus optional images.
Updates appear on the project detail page as a timeline, in followers' feeds as a distinct
item type, and trigger a notification to followers of the author.

**Schema:** `project_updates(id, project_id, author_id, body, created_at, updated_at)` plus
reuse of `project_images` (add a nullable `update_id`, or a parallel `project_update_images`
— prefer the latter so `project_images`' existing storage/cleanup invariants stay untouched).

**Why:** Two problems, one feature. (1) A showcase feed goes stale when posting volume is low
— early on, nobody has a *new* project every week, but everyone has progress. (2) It converts
a one-shot post into an ongoing story, which is the `#buildinpublic` behaviour that already
drives this audience on X.

**Gotchas:**
- The orphan-cleanup Edge Function (`orphaned_project_media()`) checks `project_images.storage_path` **and** `projects.cover_image_path`. Any new image-bearing table must be added to that function's reference set, or its images get reported as orphans and deleted. Its circuit breaker will likely catch this first — don't ignore it if it trips.
- Feed items become polymorphic (project | update). `feed_page` returns projects; either add a second RPC or a discriminator. **Do not** widen the existing keyset cursor to carry a type tag without re-verifying pagination at scale — Phase 4's bug was found by testing, not reading.
- An update should not re-rank the parent project's `hot_score`. Decide explicitly; silently bumping old projects up the feed on every edit is a well-known way to ruin a ranked feed.

---

## Phase 10 — Verified builds (GitHub proof-of-work)

**What:** Prove a project's `repo_url` actually belongs to the author, then display verified
facts: primary language, stars, first/last commit date, commit count. A "verified" chip on the
card; an unverified repo link stays a plain link.

**Schema:** `projects.repo_verified_at timestamptz`, `projects.repo_facts jsonb`
(+ a refresh timestamp). Never client-writable — written only by the verifying Edge Function,
same guard pattern as the trigger-maintained counters.

**Why:** Today anyone can post screenshots of someone else's work, and `repo_url` /
`github_username` are stored but unverified. Verification is the credibility gap
`PROJECT_INFO.md` opens with ("GitHub shows the code but not the story"), and it's a signal no
competitor has. It also gives the hot-score a quality input that isn't votes — worth
considering only *after* it's live and measurable.

**Gotchas / the hard part:**
- Supabase Auth does **not** persist `provider_token` beyond sign-in, so you can't lazily call the GitHub API as the user later. Two options — see Open decisions.
- Verification runs server-side in an Edge Function; the GitHub token must never reach the client.
- GitHub's unauthenticated rate limit (60/hr/IP) will not survive a refresh job. Any periodic re-fetch needs an authenticated token and a `pg_cron` cadence measured in days, not minutes.
- `profiles.github_username` is currently self-asserted free text. Verifying a *repo* implies verifying the *account*; do the account link first, then repos become a cheap ownership check.

---

## Phase 11 — Retention

| Task | Agent | Why |
|---|---|---|
| Weekly digest email | Sonnet | Templating + an Edge Function |
| "Ship of the Week" badge | **Opus** | Reads the leaderboard MV; snapshot semantics matter |
| Notification email preferences | Sonnet | Settings form |

**What:** A weekly email — top projects in stacks you follow, your own project's stats, the
week's winner — plus a permanent "Ship of the Week #N" badge on the winning project and
builder profile.

**Why:** `pg_cron` is already running and `leaderboard_daily` already computes windowed
winners; this is mostly plumbing on top of finished infrastructure. It gives a recurring
reason to return and a badge worth competing for — which in turn drives posting.

**Gotchas:**
- `leaderboard_daily` is a materialized view with **no RLS**, reachable only through the SECURITY DEFINER `leaderboard_projects()` / `leaderboard_builders()`. The digest job must go through those functions, not the MV — and any new maintenance function needs `revoke all on function ... from public`, since revoking from `anon, authenticated` by name does nothing (this was a real live hole in Phase 5).
- The badge must be a **snapshot**, not a live query — "won week 12" is a historical fact and must not change when the MV refreshes. Store the award row.
- Email needs unsubscribe handling and a per-user preference column before the first send, not after.

---

## Backlog (not scheduled)

- **"More like this" via pgvector** — embed title + tagline + description + tags; a related-projects rail on detail, and a semantic fallback when FTS returns nothing. Keep it a bounded top-N like `search_projects` (capped server-side); **never** a keyset cursor — same `extra_float_digits` trap as `hot_score` and search rank.
- **Moderation queue** — `reports` exists with nothing behind it. Needed before the leaderboard is worth gaming: vote-ring detection, per-account rate limits, an admin view. Every admin function: `revoke all ... from public`, verified with `has_function_privilege`.
- **Recruiter / "open to work" surface** — stack-filtered people search, built on the facets `/search` already has. The honest monetization path for a product whose pitch is "get discovered."
- **Remix / lineage** — "built on top of" edges between projects.
- **Import GitHub avatar** — noted as possible in `PROJECT_INFO.md`: fetch server-side, re-upload to the `avatars` bucket, store the resulting **path** (never an external URL — `profiles.avatar_url` is a storage path).

---

## Open decisions (need your call before the relevant phase starts)

1. **GitHub verification mechanism (Phase 10)** — a GitHub App installation (durable, higher trust, more setup) vs. capturing `provider_token` at OAuth sign-in and verifying immediately in that window (simpler, one-shot, can't refresh later). This decides the whole shape of Phase 10.
2. **Does an accepted collaborator get edit rights (Phase 8)?** Currently `project_collaborators` is credit-only. Editing means new RLS on `projects` and on the storage prefix, which is currently `{userId}/{projectId}/…` — a co-editor's uploads would land under a different user prefix. Non-trivial; credit-only is the safe default.
3. **Email provider (Phase 11)** — Resend is the obvious fit with Supabase Edge Functions. Confirm before the digest work starts.
4. **Do devlog updates affect ranking (Phase 9)?** Recommendation: no.
5. **Mobile parity** — none of Phase 7–11 is in `MOBILE_APP_PLAN.md`. Decide whether mobile ships Phases 0–6 parity first (recommended) or tracks these as they land.

---

## Checklist stub

Mirror into [CHECKLIST.md](CHECKLIST.md) once a phase starts.

### Phase 7 — Distribution & cold start
- [ ] OG image route for project detail
- [ ] OG image route for profile
- [ ] `/badge/[username].svg` + embed card
- [ ] Résumé/print profile view
- [ ] `tag_follows` table + RLS + trigger-maintained count
- [ ] Follow-tag button on `/tag/[slug]`
- [ ] Following feed unions people + tags, dedup verified, pagination re-verified at scale
- [ ] Opus review: public-read paths filter `visibility='public'`, SVG escaping, cursor correctness

### Phase 8 — Collaboration
- [ ] `looking_for` on projects + composer + card chip
- [ ] Feed + search facet
- [ ] `open_to_collab` / `weekly_hours_available` surfaced in settings + profile
- [ ] `collab_requests` table + RLS + rate limit
- [ ] Request → notification → accept/decline → `project_collaborators`
- [ ] Opus review: adversarial RLS with real JWTs on both sides of the request

### Phase 9 — Devlogs
- [ ] `project_updates` (+ images table) + RLS
- [ ] Timeline on project detail
- [ ] Update items in the feed
- [ ] Orphan-cleanup function updated to reference the new image table
- [ ] Opus review: pagination with polymorphic items, ranking side-effects

### Phase 10 — Verified builds
- [ ] Account link (GitHub) — mechanism per decision #1
- [ ] Repo ownership verification Edge Function
- [ ] `repo_verified_at` + `repo_facts`, non-client-writable
- [ ] Verified chip on card + detail
- [ ] Opus review: token never client-side, rate limits, guard columns

### Phase 11 — Retention
- [ ] Email preferences + unsubscribe
- [ ] Weekly digest Edge Function + `pg_cron`
- [ ] "Ship of the Week" award snapshot table + badge
- [ ] Opus review: MV access path, `revoke ... from public`, snapshot immutability
