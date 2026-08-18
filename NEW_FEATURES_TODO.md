# CoBuild — New Features TODO (Phases 8–11)

Working tracker for [NEW_FEATURES.md](NEW_FEATURES.md). That file holds the **why**; this one
holds the **where we are**. [CHECKLIST.md](CHECKLIST.md) stays the permanent record of evidence —
when a task here is finished *and verified*, mirror it there and mark it `[x]` in both.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done + verified · `[!]` blocked ·
`[?]` needs a decision from Tushar · `[c]` **code-complete: written, typechecked and built,
but not exercised by a human in a browser** — a real state this tracker previously had no way
to express, which is how ticked-but-unverified items ended up looking finished

Last updated: 2026-08-18 · Current position: **Phase 7 shipped. Phase 8 code-complete and its
final whole-branch review closed — 0 Critical, 3 Important, all three fixed (see §3.3). 8.1 has
full live browser evidence; 8.0's settings-form write path, 8.2's two-account round-trip, and the
new §3.3 surfaces are unverified in a browser. Not a regression: all are genuinely open,
human-blocked items, not skipped work. The branch is not yet pushed and has no PR.**

---

## 0. Where we are right now

| Phase | State | Notes |
|---|---|---|
| 0–6 (product) | done | Web app is feature-complete per `WEB_APP_PLAN.md` |
| 7 — Distribution | **done, 2 loose ends** | see §1 |
| 8 — Collaboration | **code-complete, reviewed, 3 items browser-unverified** | final review closed (3 Important, all fixed). 8.1 fully verified live; 8.0 write-path, 8.2's round-trip and §3.3's new surfaces need a human browser session — see §3 |
| 9 — Devlogs | not started | |
| 10 — Verified builds | not started | **blocked on decision D1** — shapes the whole phase |
| 11 — Retention | not started | blocked on decision D3 (email provider) |
| Mobile | not started | blocked on decision D5 |

**This gate was consciously overrun, and that is a decision, not an oversight.** The rule was:
do not start Phase 8 schema work until §1 is closed, because `NEW_FEATURES.md` names the Phase 6
Opus review as the gate before new schema lands and new tables are exactly what Phase 8 adds.
The Phase 6 review *did* close; what stayed open in §1 is Phase 7's OG-render loose end and a set
of end-to-end browser checks — neither of which gates schema. Phase 8's tables shipped. The
remaining §1 items are still open and still listed below.

---

## 1. Gate before any new schema lands

- [x] Seed run — 35 profiles / 83 projects / 207 images / 21 tags / 1069 votes / 365 comments
- [x] Toast bug closed (was the hidden-automation-tab rAF trap, not a revalidation bug)
- [x] Phase 6 final Opus review — RLS adversarial pass, `get_advisors`, perf audit, simplification
  - **Discrepancy to fix:** `NEW_FEATURES.md:17` still lists this as open, but
    `CHECKLIST.md:103` records it complete with evidence. Correct `NEW_FEATURES.md`.
- [ ] Phase 7 Opus review — **finish the remaining piece**
  - [x] `get_advisors` back at the intentional baseline
  - [x] `turbo run typecheck` 4/4
  - [x] Public-surface privacy probed against a real draft
  - [x] Simplification pass over Phase 7's 1,401 lines
  - [x] Perf audit (`align_feed_indexes_with_keyset_order` shipped)
  - [x] OG cards re-verified against real seeded covers
  - [ ] **The transient coverless OG render** (`CHECKLIST.md:168`) — one first-render came back
        without its cover (55kB vs 119kB), not reproducible in 8 subsequent cold renders.
        Matters because `fetchOgImage` returns `null` on *any* failure and social platforms
        cache the first response forever. Decide: add a single retry, or close it as won't-fix
        with the reasoning written down. Do not leave it silently open.
- [ ] Web verification items still unticked in `CHECKLIST.md`'s "Web verification" section — these are end-to-end
      checks that were never run, not regressions:
  - [ ] All three sign-in methods end-to-end (needs auth providers configured — see below)
  - [ ] Post → gallery → reorder → cover change → co-builder credit lands on their profile
  - [ ] Upvote/comment/bookmark persist from both card and detail page
  - [ ] Hot/New/Top/Following stable under concurrent inserts (was verified at 20k scale in
        Phase 4; re-confirm now that the Following tab unions tags)
  - [ ] Logged-out browsing works; interaction prompts sign-in
- [!] **Supabase Auth providers configured + redirect URLs** (`CHECKLIST.md:23`) — needs
      Tushar's GitHub/Google accounts. Blocks the sign-in verification above **and** Phase 10
      entirely (GitHub account linking has nothing to link without the GitHub provider live).

---

## 2. Decisions needed from Tushar

Each one blocks real work. Answer before the phase it gates starts.

| # | Decision | Gates | Default if unanswered |
|---|---|---|---|
| D1 | **GitHub verification mechanism** — GitHub App install (durable, higher trust, more setup) vs. capture `provider_token` at OAuth sign-in and verify in that window (simple, one-shot, no refresh) | Phase 10 — decides its whole shape | none; genuinely blocking |
| D2 | **Does an accepted collaborator get edit rights?** | Phase 8.2 | **ANSWERED: credit-only.** Shipped that way — `project_collaborators` rows are credit-only, zero changes to any existing RLS policy. The storage re-keying and orphan-cleanup costs this row originally warned about were checked against the live database during design and are **false** — see the spec's "Corrections to NEW_FEATURES.md's stated gotchas" and `NEW_FEATURES.md`'s open decision #2 for the real cost, recorded for a future edit-rights phase |
| D3 | **Email provider** — Resend is the obvious fit with Supabase Edge Functions | Phase 11 | Resend |
| D4 | **Do devlog updates affect ranking?** | Phase 9 | **no** (plan's own recommendation; bumping old projects on every edit ruins a ranked feed) |
| D5 | **Mobile parity** — ship Phases 0–6 parity first, or track 7–11 as they land | mobile plan | Phases 0–6 parity first |

- [ ] D1 answered
- [x] D2 answered — credit-only, shipped in Phase 8.2
- [ ] D3 answered
- [ ] D4 answered
- [ ] D5 answered

---

## 3. Phase 8 — Collaboration ("Looking for") — CODE-COMPLETE, 2 items browser-unverified

The defensible difference: the product is named CoBuild and is currently one-way.
Evidence mirrored into `CHECKLIST.md`'s Phase 8 section (Task 10) — that is now the fuller
record; this section stays ticked to match but read `CHECKLIST.md` for what is and is not
actually browser-verified.

### 8.0 Groundwork — surface the fields that already exist
`profiles.open_to_collab` and `profiles.weekly_hours_available` are live in the schema.
**Correction:** the "populated by the seed" claim in the original note above was wrong — as of
this task's start, neither column appeared anywhere in `packages/db/src/seed/seed.ts` and all 35
seeded profiles sat at defaults (`false` / `null`). Fixed as part of Task 6's seed work (see 8.1
below); the seed now assigns both. **No migration needed.** — *Sonnet*

- [x] Add both columns to `PROFILE_COLUMNS` (`packages/shared/src/profiles.ts:35`)
- [x] `/settings/profile`: toggle for `open_to_collab`, number input for `weekly_hours_available`
- [x] Server-side validation (hours: bounds `WEEKLY_HOURS_MIN`–`WEEKLY_HOURS_MAX`, nullable) —
      manual `Number.isFinite` + range check in `settings/profile/actions.ts`, not a Zod schema
      as originally envisioned; functionally equivalent (out-of-range/blank/unparseable all
      collapse to `null` rather than erroring)
- [x] Render on `/u/[username]` — "Open to collaborate · ~N hrs/week" chip
- [x] Confirmed `profiles_guard_client_columns()` does **not** pin these two — read the live
      function definition via `execute_sql`; it only re-pins `id`/counters/`created_at`
- [ ] Verify live: set both, reload, values persist; toast fires (production build, visible tab)
      — **still not verified as of Task 10.** Commit `bd01639` ("stop native min/max on hours
      input from blocking whole-form submit") implies a prior live pass found and fixed a real
      bug here, and the profile chip's *render* path was verified live in the 8.1 browser pass —
      but the settings form's own toggle/input/save/toast write path has never been re-confirmed
      in a browser. Genuinely open, not a regression

### 8.1 "Looking for" on a project — *Sonnet*
Values: `co-builder` · `feedback` · `beta-testers` · `designer` · `nothing` (default).

- [x] **Shape decided:** `projects.looking_for text[]` with a CHECK constraint + a partial GIN
      index (`add_projects_looking_for` migration), not a join table.
- [x] Migration + RLS review — `feed_page_looking_for`, `search_projects_looking_for`.
      `looking_for` is a plain column on `projects`; Postgres RLS is row-level, so the table's
      existing owner-writable/public-readable policies already cover it, nothing new to leak.
- [x] Composer UI in `/new` and `/p/[username]/[slug]/edit` (both routes render `Composer`)
- [x] Chip on `ProjectCard` (server part — no client-island change) + project detail page
- [x] Feed filter axis (`?looking_for=`) — goes through `feed_page`'s existing `p_looking_for`,
      not a forked RPC, matching the `p_tag` precedent. Filter chips are links (`FeedTabs`),
      built fresh per request so no stray param (a `?cursor=`, if this app had one in the URL —
      it doesn't; pagination is client state) can leak onto a filtered link.
- [x] Search facet chips on `/search` (`SearchFilters`, generalized `toggleHref` to a 3rd facet)
- [x] **Pagination re-verified** — `feed_page`/`search_projects` themselves were not touched in
      this task (already extended and verified per this task's brief); re-confirmed the `looking_for`
      filter live via `execute_sql`: unfiltered Hot page returns the full 50-row limit, a
      `co-builder` filter returns 8 rows all carrying it, a `beta-testers`/`designer` filter
      returns 17 rows each carrying at least one — OR semantics, no dup/skip observed
- [x] Regenerate DB types — already current (`looking_for` present in `database.types.ts`)
- [x] `turbo run typecheck` (4/4) + `next build` clean (20 routes)

### 8.2 Request to join — *Opus* — code-complete, browser round-trip unverified
**The first path where a stranger writes a row a project owner reads.** Treat accordingly.

Schema: `collab_requests(id, project_id, requester_id, message, status, created_at)`,
status `pending | accepted | declined | withdrawn`, unique partial index on
`(project_id, requester_id) where status = 'pending'`.

- [x] Migration: table, PK, unique partial index, `updated_at` trigger (`collab_requests_guard`
      sets it on every update)
- [x] RLS, written before any UI:
  - [x] requester: insert own, read own, withdraw own
  - [x] owner: read requests to *their* projects, update `status` only
  - [x] nobody else reads either side; `anon` reads nothing
  - [x] status transitions constrained (no `declined` → `accepted` reopen)
- [x] **DB-level rate limit**, not UI-level — 10 requests per requester per 24h, in
      `collab_requests_rate_limit()`
- [x] Trigger functions revoked from `public` **and** `anon, authenticated` — but see the bug
      below: both trigger functions shipped `SECURITY DEFINER`, which made the revokes moot for a
      different reason (the guards never ran for any caller). Fixed by dropping the SECURITY
      clause, not by the revokes, which were correct all along
- [x] Request composer UI (short pitch, 500-char dialog) on project detail, auth-gated
- [x] Notification to owner on request (`notify_on_collab_request`, extending the existing
      trigger family)
- [x] Accept/decline from `/notifications`
- [x] Accept → `project_collaborators` row (`pending` → `accepted`) via the SECURITY INVOKER
      `accept_collab_request` RPC, which already auto-adds to the collaborator's portfolio
- [x] **Accepting does not grant `projects` write access** — D2 shipped credit-only, zero RLS
      changes on `projects`
- [x] Notification to requester on decline (`collab_declined`); acceptance reuses the existing
      `credit` notification rather than a new `collab_accepted` type — see the spec correction
- [x] **Adversarial RLS with real JWTs on both sides — attacked, not asserted.** Found and fixed
      a real security hole (both trigger functions were `SECURITY DEFINER` and completely inert);
      full re-run after the fix: 23 attacks, 22 blocked, 1 expected/accepted success, 9 positive
      controls, GATE PASS. Full record: `docs/superpowers/evidence/2026-08-11-phase-8-collab-rls.md`
- [x] `get_advisors` clean — security at the documented baseline; one new performance INFO
      (`collab_requests_project_idx` unused, expected at 0 live rows)
- [x] Mirrored into `CHECKLIST.md` with evidence (Task 10)
- [x] **Message now rendered, and resolved requests no longer offer live controls** — see §3.3
- [x] **Author-facing "Requests to join" panel** on the project page — see §3.3
- [ ] **Still open: the live two-account browser round-trip** (request → notification → accept /
      decline / withdraw) has never been run. Blocked on a human foregrounding the browser tab and
      running `auth.admin.generateLink` to sign in as a second account. Everything above is
      verified by adversarial RLS, typecheck, and the production build — which, for the UI items
      specifically, proves only that they COMPILE — none of that substitutes
      for actually clicking through the flow as two real users

### 3.3 Final whole-branch review fixes — *Opus* — code-complete, browser-unverified
Review verdict: **0 Critical, 3 Important**, all three fixed in commit `ae7300b`. Full detail and
evidence in `CHECKLIST.md`'s "8.3" section. Summary:

- [x] **I1** — the request message was collected (required, 1–500 CHECK) and rendered nowhere.
      `notifications.excerpt` is derived from an embedded `comments.body`, so it was structurally
      null for every `collab_request`. Fixed on two surfaces: a scoped second query for
      `/notifications` (message + live status, so resolved requests stop offering live controls),
      and an author-only "Requests to join" panel on the project page — the durable surface, since
      a notification feed pages and a scrolled-past request was stranded pending forever
- [x] **I2** — `FeedLoadMore` had no `key`; client `items`/`cursor` survived a soft nav between
      filters, so "Load more" could run a filtered query from an unfiltered keyset. `feed-key.ts`
      keys every axis, including `tab`/`window`, which had the bug before `looking_for` existed
- [x] **I3** — `revalidatePath()` took a client-supplied path on a write with no rate limit that
      cannot fail. Now validated against the known shape
- [x] **A17 enforced**, not just commented — `pnpm check:invariants`, negative-controlled
- [x] **P24–P26 positive controls** for all three notification links, against the live DB
- [x] `turbo run typecheck` 4/4 · `pnpm --filter web build` clean (20 routes) · `check:invariants` OK
- [ ] **Browser-unverified.** `collab_requests` has 0 live rows; neither new surface has rendered
      with real data. Same human-blocked prerequisites as 8.2

---

## 4. Phase 9 — Devlogs / build updates

Schema: `project_updates(id, project_id, author_id, body, created_at, updated_at)` + a
**parallel** `project_update_images` table (not a nullable `update_id` on `project_images`, so
that table's storage/cleanup invariants stay untouched).

- [ ] D4 answered (ranking side-effects) before writing the trigger
- [ ] Migration: `project_updates` + `project_update_images` + RLS (author writes, project
      visibility governs reads)
- [ ] **Add the new image table to `orphaned_project_media()`'s reference set** — it currently
      checks `project_images.storage_path` and `projects.cover_image_path` only. Miss this and
      every devlog image is reported as an orphan and deleted. Its circuit breaker will likely
      trip first; **do not ignore the trip.**
- [ ] Timeline UI on project detail
- [ ] Composer for an update (text + images, reusing the compression/upload pipeline)
- [ ] Feed items become polymorphic (project | update). **Second RPC or a discriminator — do
      not widen the existing keyset cursor to carry a type tag without re-verifying pagination
      at scale.** Phase 4's bug was found by testing, not reading.
- [ ] Notification to followers of the author
- [ ] Ranking: updates do **not** re-rank the parent's `hot_score` (assuming D4 = no)
- [ ] Opus review: polymorphic pagination, ranking side-effects, orphan-cleanup coverage
- [ ] `get_advisors` clean

---

## 5. Phase 10 — Verified builds (GitHub proof-of-work)

**Blocked on D1.** Also blocked on the GitHub auth provider being configured (§1).

Schema: `projects.repo_verified_at timestamptz`, `projects.repo_facts jsonb` + a refresh
timestamp. **Never client-writable** — same guard-trigger pattern as the counters.

- [ ] D1 answered
- [ ] GitHub auth provider live in Supabase
- [ ] **Account link first** — `profiles.github_username` is self-asserted free text today.
      Verifying a *repo* implies verifying the *account*; once the account is linked, repo
      ownership is a cheap check.
- [ ] Verification Edge Function — token never reaches the client
- [ ] `repo_verified_at` + `repo_facts` columns + guard trigger pinning them against
      `anon`/`authenticated` writes
- [ ] Verified chip on card + detail; unverified `repo_url` stays a plain link
- [ ] Refresh cadence: `pg_cron` in **days, not minutes** — GitHub's unauthenticated limit is
      60/hr/IP and will not survive a refresh job; needs an authenticated token
- [ ] Opus review: token server-side only, rate limits, guard columns
- [ ] *(Later, separately)* consider `repo_facts` as a hot-score input — only once it's live and
      measurable, never as part of this phase

---

## 6. Phase 11 — Retention

**Blocked on D3.** Mostly plumbing on infrastructure that already runs (`pg_cron`,
`leaderboard_daily`).

- [ ] D3 answered
- [ ] **Email preferences column + unsubscribe handling — before the first send, not after**
- [ ] Weekly digest Edge Function + `pg_cron` schedule
  - [ ] Reads through `leaderboard_projects()` / `leaderboard_builders()`, **never the MV
        directly** — `leaderboard_daily` has no RLS and is reachable only via those
        SECURITY DEFINER functions
  - [ ] Any new maintenance function: `revoke all on function … from public` (revoking from
        `anon, authenticated` by name does nothing — this was a real live hole in Phase 5)
- [ ] "Ship of the Week" award **snapshot table** — a stored row, not a live query. "Won week 12"
      is a historical fact and must not change when the MV refreshes.
- [ ] Badge on winning project + builder profile
- [ ] Notification email preferences in `/settings`
- [ ] Opus review: MV access path, `revoke … from public`, snapshot immutability

---

## 7. Backlog (not scheduled, don't start without asking)

- [ ] "More like this" via pgvector — bounded top-N, **never** a keyset cursor
      (same `extra_float_digits` trap as `hot_score` and search rank)
- [ ] Moderation queue behind `reports` — needed before the leaderboard is worth gaming
- [ ] Recruiter / "open to work" surface, built on `/search`'s existing facets
- [ ] Remix / lineage edges between projects
- [ ] Import GitHub avatar — fetch server-side, re-upload to `avatars`, store the **path**
      (`profiles.avatar_url` is a storage path, never an external URL)

---

## 8. Standing rules for every task in this file

Learned the hard way in Phases 0–7. Violating one of these is how the known bugs happened.

1. **Verify in a visible browser tab on a production build.** A hidden automation tab never
   fires `requestAnimationFrame`, so React never reveals the Suspense boundary, the page never
   hydrates, and forms fall back to native POST. This looks exactly like a real app bug.
2. **Run `get_advisors` immediately after every migration.** Two separate phases shipped a
   trigger function callable over PostgREST; advisors caught both, review caught neither.
   `revoke … from public` **and** `revoke … from anon, authenticated` — you need both.
3. **Never widen or fork the keyset cursor without re-running the dup/skip scan at scale.**
4. **Touching `feed_page`? Extend it, don't fork it.** Phase 5 set the precedent with `p_tag`.
5. **Trigger-maintained counters are read-only to the app.** Read them, never write them.
6. **New image-bearing table ⇒ update `orphaned_project_media()` in the same commit.**
7. **`visibility = 'public'` is a rule about *listing* surfaces**, not direct-link ones. Drafts
   fall back to generic; unlisted renders on a direct link on purpose.
8. **Stale `apps/web/.next` 404s every dynamic route** while static ones serve 200. The tell is
   the dev server reporting `application-code: 12ms` for a page whose first act is a DB
   round-trip. Clear `.next` before debugging further.
9. **Stopping `next dev` can leave an orphaned server** that floods "Jest worker" errors looking
   like app bugs. Check for a surviving process before chasing them.
10. End every task with `turbo run typecheck` + `next build` clean, then mirror the evidence
    into `CHECKLIST.md`.

---

## 9. Session log

Newest first. One line per working session — what moved, what broke, what's next.

- **2026-08-18 (later)** — Final whole-branch review triage. Verified all three Important
  findings against the code before touching anything, and all three held. **I1**: the request
  message was collected and rendered nowhere — `notifications.excerpt` turned out not to be a
  column at all but a value derived from an embedded `comments.body`, so for a `collab_request`
  it was structurally null and the author decided on a username alone. Fixed with a scoped second
  query (`getCollabRequestSummaries`, message + live status) plus an author-only "Requests to
  join" panel on the project page — the durable surface, and the first consumer
  `getProjectCollabRequests` has ever had. Resolved requests no longer render live controls.
  **I2**: `FeedLoadMore` had no `key`, so client `items`/`cursor` survived a soft nav between
  filters. Wider than reported — `tab`/`window` had it too, so it predates the `looking_for`
  filter; `feed-key.ts` now covers every axis in one place. **I3**: `revalidatePath()` took a
  client-supplied path on a write that has no rate limit and cannot fail; now validated.
  Also: `pnpm check:invariants` makes A17's mitigation enforceable rather than a comment
  (negative-controlled against two deliberate violations first); rate-limit copy now admits that
  withdrawing doesn't free a slot; the RLS evidence file's dangling pre-rename migration
  filenames fixed. **Closed the review's other real gap**: the suite had no positive control that
  the author-side notification fires at all — added P24–P26 against the live DB (insert ⇒ author's
  `collab_request`; decline ⇒ requester's `collab_declined`; accept RPC ⇒ status + credit row with
  role_label + credit notification, one call), each in a rolled-back transaction, residue verified
  zero. typecheck 4/4, build clean at 20 routes. Commit `ae7300b`. **Nothing here is
  browser-verified** — `collab_requests` still has 0 live rows, so the two new surfaces have never
  rendered with real data.
- **2026-08-18** — Task 10 (Phase 8 close): full advisors pass (security back at the documented
  baseline; performance shows one new expected INFO, `collab_requests_project_idx` unused at 0
  live rows, and confirms `projects_looking_for_idx` is **no longer** unused now that the seed and
  filter exercise it). Policy-drift query re-run against `projects`/`project_images`/
  `project_tags`/`project_collaborators` — identical to the pre-phase state, no drift.
  `turbo run typecheck` 4/4, `pnpm --filter web build` clean, 20 routes. Spec corrected at the one
  narrowing (no `collab_accepted` type — acceptance reuses the `credit` notification). Renamed all
  six Phase 8 migration files with `git mv` from their on-disk `YYYYMMDDTHHMM_` names to the
  versions Supabase actually registered — `add_projects_looking_for` would have failed on a future
  `supabase db push` otherwise. `CHECKLIST.md`'s Phase 8 section rewritten to be honest about scope:
  8.1 has full live browser evidence; 8.0's settings-form write path and 8.2's two-account
  request/accept/decline/withdraw round-trip are still unverified in a browser, both blocked on
  human action (foregrounding the automation tab, and running `auth.admin.generateLink` with the
  service-role key). D2 marked answered (credit-only, as shipped). Corrected two stale doc claims:
  `NEW_FEATURES.md`'s "populated by the seed" line for `open_to_collab`/`weekly_hours_available`
  (was false when written; true as of Task 6), and `PROJECT_INFO.md`'s stale claim that
  `tags_name_trgm_idx` would always show up in `get_advisors` as unused — it no longer does
  (`idx_scan = 1`), though that is one manual verification query, not proven organic traffic; the
  underlying "small table, seq scan is cheap" reasoning still holds. No RLS policy touched; no new
  migration added.
- **2026-08-11** — Task 6 (slice 8.1 finish): `looking_for` chips on `ProjectCard` (server part)
  and project detail; `?looking_for=` feed filter (`FeedTabs`, `FeedLoadMore`) and `/search` facet
  (`SearchFilters`, generalized `toggleHref` to a 3rd facet); seed now assigns `looking_for` to
  ~1/3 of projects via a new seeded `mulberry32` PRNG (the file had no deterministic RNG despite
  the plan assuming one — added the minimal one needed rather than refactoring the whole file).
  Also closed the 8.0 gap flagged by Tushar: `open_to_collab`/`weekly_hours_available` were never
  actually seeded despite the tracker claiming otherwise — now ~1/3 of profiles get
  `open_to_collab = true`, most with an hours value, some deliberately left `null`. `turbo run
  typecheck` 4/4, `next build` clean (20 routes), seed re-run, distributions verified by SQL, and
  `feed_page`/`search_projects` re-confirmed live against the new data via `execute_sql`. **No
  browser access this session** — Step 7's live-browser pass (chip rendering, click-to-filter,
  load-more within a filtered set, clear filter, search facet) is still open.
- **2026-08-11** — Read `NEW_FEATURES.md`, created this tracker. Nothing implemented yet.
  Phase 8 is next; §1 and the D1–D5 decisions are the open gates. Flagged one doc discrepancy
  (`NEW_FEATURES.md:17` vs `CHECKLIST.md:103` on the Phase 6 Opus review) and one genuinely
  open bug (the transient coverless OG render).
