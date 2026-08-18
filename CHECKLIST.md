# CoBuild — Build Checklist

Tick items as they're completed: `- [ ]` → `- [x]`. Mirrors [WEB_APP_PLAN.md](WEB_APP_PLAN.md) and [MOBILE_APP_PLAN.md](MOBILE_APP_PLAN.md) — see those files for the "why" behind each item and agent assignment.

---

## WEB APP

### Phase 0 — Foundation
- [x] Turborepo/pnpm workspace scaffold (`apps/web`, `packages/db`, `packages/shared`, `packages/tokens`)
- [x] `packages/tokens` built from design-system palette
- [x] Full DB schema + migrations applied to Supabase (14 tables live, incl. `comment_votes`)
- [x] RLS policies on every table (confirmed enabled on all 14; unlisted-visibility bug found + fixed)
- [x] Storage buckets (`avatars`, `project-media`) + path-prefix policies
- [x] Hot-score trigger + counter-maintenance triggers (incl. comment-vote counters)
- [x] Seed script (TS) written — `packages/db/src/seed/seed.ts`, ~30 users/~80 projects, uploads real sample images, idempotent re-run via cleanup
- [x] Seed script **run** — 35 profiles / 83 projects / 207 images / 21 tags / 1069 votes / 365 comments / 175 follows. See the Phase 7 review section for the two blockers that had to be cleared first (missing sample images; `NULL` auth token columns breaking GoTrue's admin API)
- [x] `supabase gen types typescript` → `packages/db/src/database.types.ts`
- [x] Phase-0 Opus review: `get_advisors` (25→3 intentional), 30+ live RLS attacks blocked, 31 trigger assertions passed, `turbo run typecheck` clean workspace-wide

### Phase 1 — Auth + onboarding
- [x] Sign-in screen (GitHub / Google / magic link) — `/login`, verified rendering + no console errors
- [ ] Supabase Auth providers configured, redirect URLs set — **you need to do this** (see below, needs your GitHub/Google accounts)
- [x] `/auth/callback` route + SSR session handling — handles both `?code=` and `?token_hash=` link shapes, PKCE-verified, open-redirect–hardened `next` param
- [x] `/auth/signout` route (POST-only)
- [x] Username-claim onboarding screen (`/onboarding`) — live availability check, avatar upload, roles, student toggle + college/grad year
- [x] Reserved-slug blocklist in place (DB-enforced + mirrored client-side in `packages/shared`)
- [x] Auth gating: proxy + independent per-page checks (`getAuthState`/`requireOnboardedUser`), verified signed-out access to `/onboarding` redirects to `/login`
- [x] `turbo run typecheck` and `next build` clean across the whole workspace

### Phase 2 — Profile
- [x] Public profile page `/u/username` (stats, links, badges, role chips, student badge, tabs) — verified rendering against real account data
- [x] Settings / edit-profile screen (`/settings/profile`) — display name, headline, bio, avatar, roles, student fields, location, timezone, 7 external links
- [x] Follow / unfollow with optimistic counts + sign-in gate
- [x] Profile data layer in `packages/shared` (`getProfileByUsername`, `isFollowing`, three tab queries, `publicStorageUrl`)
- [x] Opus review: **found and fixed 5 real issues** — see below
  - [x] No `LIMIT` on any tab query (15k rows → disk-spilling external merge sort, 349ms); added `PROFILE_TAB_LIMIT = 48` → **349ms → 0.20ms**
  - [x] Missing composite indexes for profile access patterns (Phase 0's were feed-shaped); migration `profile_tab_indexes`
  - [x] `ProjectTileCard` built a full cookie-reading Supabase client **per tile**; cover URL now resolved once and passed as a prop
  - [x] `getProfileContributions` had **no `ORDER BY`** — non-deterministic, and actively wrong once a LIMIT exists
  - [x] Tab param used a lying `as Tab` cast; `?tab=garbage` left no tab highlighted, and Next can pass `string[]`. Replaced with an explicit allowlist
- [x] Bookmarks-tab RLS verified by **live attack with real JWTs** — cross-user reads return `[]`, anon returns `[]`, crafted `?tab=bookmarks` on another profile falls back to Projects
- [x] `!inner` embedded-join visibility filter verified live: an `unlisted` project is hidden from others' view of a contributions tab, visible on your own
- [x] Fixed Next 16 image SSRF guard false-positive breaking **all** images locally (see PROJECT_INFO.md gotchas)
- [x] `turbo run typecheck` + `next build` clean

### Phase 3 — Project composer + detail
- [x] Project data layer in `packages/shared` (Zod schemas, slug collision handling, tag search/create with race retry, co-builder search, save/delete, detail + comment-tree fetch)
- [x] Create/edit form `/new` + `/p/[username]/[slug]/edit` (multi-image upload w/ progress, drag reorder, cover selection, per-image alt/caption, tags, links, status, co-builders, visibility, sticky action bar)
- [x] Client-side image compression (`lib/images/compress.ts`) — EXIF parsed from file bytes, `imageOrientation: "none"` so engines don't double-rotate, animated-GIF passthrough, runtime WebP probe
- [x] Direct-to-Storage upload (`lib/images/upload.ts`) — `{userId}/{projectId}/{uuid}.{ext}`, never derived from `file.name`, abort-signal cancellation
- [x] Project detail page (gallery + thumbnails + lightbox, credits, threaded comments w/ per-comment voting, stats sidebar, delete dialog)
- [x] Vote / bookmark buttons with optimistic UI + sign-in gating
- [x] View tracking via `record_project_view` RPC (sessionStorage viewer key)
- [x] `turbo run typecheck` + `next build` clean (11 routes)
- [x] Auth gating verified live: `/new` → `/login?next=%2Fnew`
- [x] Orphaned-upload cleanup job — `orphaned_project_media()` SQL function + `cleanup-orphan-media` Edge Function, hourly `pg_cron`, verified against 6 real objects across all edge cases (only the true orphan deleted; live images, avatars, and wrong-shaped paths all survived), circuit breaker tested against simulated path-format drift
- [x] Storage RLS verified by live attack with a real authenticated JWT: cross-user prefix write, bucket-root write, path traversal, prefix-extension trick, signed-upload-URL forgery — all blocked (403)
- [x] Image-transform sizing fixed across every render site (profile avatar, project tiles, gallery hero/thumbnails/lightbox, comment avatars, collaborator avatars, detail-page author avatar) — all now use `transformedStorageUrl()` + `unoptimized`, verified live: correct `width/height/resize/quality` params reaching Supabase, avatar renders undistorted
- [x] Real bug found and fixed in image compression: `imageOrientation: "none"` does not mean raw pixels in Chrome — verified empirically with real EXIF fixtures, fixed with a runtime probe rather than a documented-behavior assumption
- [x] `turbo run typecheck` + `next build` clean after all fixes (11 routes)
- [x] DB types regenerated (`media_cleanup_runs`, `orphaned_project_media`)

### Phase 4 — Feed + engagement
- [x] Feed tabs: Hot / New / Top / Following (`/`, URL-driven via `?tab=`)
- [x] Top tab time-window selector (Today/Week/Month/All, `?window=`)
- [x] Keyset pagination via `feed_page` SQL RPC — see below, this needed a server-side row-value comparison, not a client-side cursor
- [x] Vote / comment / bookmark mutations, optimistic UI (reused Phase 3's `VoteButton`/`BookmarkButton`)
- [x] `record_project_view` RPC wired in — verified live (view count incremented on a real page load)
- [x] Feed skeleton + per-tab empty states (Following/Top/default all have distinct, actionable copy)
- [x] `ProjectCard` — full-fidelity translation of `ProjectCard.dc.html`, Server Component with client islands (vote/bookmark/share/author-hover) so a feed page ships one card's worth of JS, not one per card
- [x] Trending-stacks + post-CTA sidebar
- [x] Opus review: pagination correctness under concurrent writes, ranking order test — **found and fixed a real production-blocking bug**, see below
- [x] `turbo run typecheck` + `next build` clean (11 routes)
- [x] End-to-end verified live: tab/window navigation, auth-gated composer, draft save → detail page render, publish-validation correctly blocking a screenshot-less project, delete flow with confirmation dialog, view-count increment — all confirmed in-browser, not just typechecked

**The keyset-pagination bug, worth understanding if you touch `packages/shared/src/feed.ts`:** this Supabase instance runs `extra_float_digits = 0`, so `hot_score` (a `float8`) does not survive a text round-trip through PostgREST's `.or()` filter syntax — a cursor built from the printed value would `eq`-compare false against itself, causing pagination to loop forever on one row (caught by testing, not by reading the code — it looked correct). Fixed with a `feed_page` SQL function doing a real Postgres row-value comparison `(hot_score, published_at, id) < (...)` server-side, with the cursor encoding lossless columns (`upvote_count`, `published_at`, `id`) and reconstructing the exact float via `compute_hot_score` itself. Verified against a 20k-row scale test (zero duplicates, zero skips across 365 pages) and a real concurrent-write test (re-ranking a project mid-scroll while paginating).

### Phase 5 — Discovery
- [x] Leaderboard (`/leaderboard`) — projects/builders tabs, Today/Week windows, medal-coloured ranks, rank-change chip (`+n` / `-n` / `—` / `new`), "updated Nm ago" staleness line
- [x] `leaderboard_daily` materialized view + `leaderboard_previous` snapshot + `refresh_leaderboard()` + 10-minute `pg_cron` job
- [x] Search (`/search`) — projects/people/tags sections, status + tag facet chips, debounced URL-driven query, no-results state falling back to the tag directory
- [x] Postgres FTS wired to `search_tsv` — `search_projects` RPC via `websearch_to_tsquery`, `ts_rank_cd` ordering (title A / tagline B / description C)
- [x] People + tag search on trigram indexes (`pg_trgm`), user input escaped server-side by `like_escape`
- [x] Tag pages (`/tag/[slug]`) — Hot/New/Top, related-stacks rail, 404 on unknown slug
- [x] `feed_page` extended with `p_tag` rather than forking a second feed RPC — tag pages reuse the same keyset pagination and hydration
- [x] Feed sidebar's "Top builders this week" swapped off the lifetime `total_upvotes_received` stand-in onto the real windowed board
- [x] Opus review: **found and fixed a real security hole** — `revoke ... from anon, authenticated` on `refresh_leaderboard()` left the default `PUBLIC` EXECUTE grant intact, so any anonymous visitor could trigger a `DELETE` + full materialized-view rebuild over PostgREST. Fixed by revoking from `PUBLIC`
- [x] Verified live against a temporary 14-project / 8-profile fixture: windowing excludes lifetime-high-but-stale projects, rank deltas move correctly (+1/+1/−2 after a simulated vote change), unlisted projects vanish from tag feed + search + both boards, `%` and `_` in a people query stay literal, malformed FTS input returns empty instead of raising, trigram index confirmed used via `EXPLAIN`
- [x] `get_advisors` clean — only the pre-existing intentional categories (RLS-enabled-no-policy on the snapshot table, SECURITY DEFINER RPCs as the sole read path to the ungranted MV)
- [x] `turbo run typecheck` + `next build` clean (16 routes)
- [x] Fixture data removed afterwards — the DB went back to 2 profiles / 0 projects at the time (the seed has since run; see Phase 7)

**Not built (deliberate):** the design's "Follow tag" button on `/tag/[slug]` — there is no `tag_follows` table and tag following isn't in any phase of the plan, so shipping a dead button was the worse option. Add the table first if you want it.

### Phase 6 — Notifications + polish
- [x] Notifications screen + mark-read — verified live (`/notifications`, empty state + mark-all-read wired)
- [x] Notification-writing triggers (vote/comment/follow/credit) — confirmed live on the Supabase project: `notify_on_vote`, `notify_on_comment`, `notify_on_follow`, `notify_on_credit`
- [x] Global nav (signed-in / signed-out variants) — `nav-items.tsx` branches on `signedIn`, verified signed-in live
- [x] All empty states — consistent dashed-border/icon-badge pattern verified across feed, bookmarks, notifications, profile tabs
- [x] Loading states — added tailored `loading.tsx` for the 5 routes that were silently inheriting the feed's skeleton shape: bookmarks, project detail, profile, tag pages, settings (new `SkeletonTileGrid` primitive added to `components/shell/skeleton.tsx`, reused by bookmarks + profile)
- [x] Delete-confirmation dialog — confirmed a real shadcn `Dialog` (not `window.confirm`) on project delete, with cancel/pending/error states
- [x] **Final Opus review before mobile starts** — all four parts done, though the simplification pass was scoped to Phase 7's 1,401 new lines rather than the whole app (it found the stale `remote-image.ts` sizing comment). Advisors and the perf audit are recorded under Phase 7. The **RLS adversarial pass ran against real seeded data** (35 profiles / 83 projects / 61,592 notifications) with simulated JWT roles, one user attacking another:
  - [x] Reads blocked: another user's draft (0 rows, and 0 drafts visible at all), another user's bookmarks (0)
  - [x] Writes blocked at RLS (`42501 new row violates row-level security policy`): voting as another user, commenting as another user — including as `anon`
  - [x] Writes blocked at the **GRANT** level, which is stronger than RLS: fabricating a `notifications` row, inserting `project_views` directly. View counts can therefore only move through the deduping `record_project_view` RPC
  - [x] Mutations on someone else's rows affect **0 rows**: edit project, delete project, edit profile, delete their follows
  - [x] Counter forgery discarded by the guard trigger — `update … set upvote_count=9999, view_count=9999, comment_count=9999` on the attacker's **own** project returned the original `9 / 0 / 4`
  - [x] Notification scoping proven at scale rather than asserted: 61,592 rows across 34 recipients, attacker sees exactly their own 82
  - [x] `anon` sees 0 drafts / 0 bookmarks / 0 notifications but **78 public projects**, so public browsing still works
  - [x] The documented unlisted rule re-confirmed: an unlisted project **is** readable by direct id (RLS deliberately does not hide it) but appears in **none** of hot / new / top / search / leaderboard — the app-layer `visibility='public'` filter is holding
  - [x] Not re-run: the storage-path attack, verified in Phase 3 with a real JWT against unchanged policies

**In-flight UI/UX pass — see [REMEMBER.md](REMEMBER.md) for the full checkpoint.** A three-part audit (interaction, a11y, visual system) found ~40 issues; tranche A (real bugs + a feedback layer) is implemented and **fully verified — A4 and A6, the last two open items, are now closed**. A6 (composer `beforeunload` guard) was verified across all three states — clean, dirty, and reverted-to-original — via a synthetic cancelable event, since a real unload prompt would freeze automation; the reverted case proves the signature comparison works rather than latching. A4 (onboarding dead-end) was verified against a temporary un-onboarded fixture (`username` nulled, then restored — DB confirmed back to 5/5 with usernames) with `fetch` patched to fail: the error message and "Check again" retry appear and **the submit button stays enabled**, which is the bug — that screen used to grey out its only button permanently with no message and no recovery short of a reload.

**Tranche B is also complete** — all six items, one commit each, every one with typecheck 4/4 and a clean `next build`. B1 reduced-motion, B2 one colour transition for every interactive element (plus `pill`/`chip` lifted to `components/ui/control-classes.ts`), B3 focus indicators for the 7 hand-rolled `outline-none` inputs, B4 three shadow tokens composed from a new `--color-accent-rgb`, B5 35 radius literals onto existing tokens, B6 the contrast fix. **B6 is the one to know about: the plan's suggested `#7c817c` still failed AA** (4.37:1 on `--color-bg-raised`), and its stated baseline was optimistic — measured, the old `#6e736e` was 4.10:1 on the page and 3.59:1 on raised, not 4.42/3.87. Shipped `#7f847f` (min 4.56:1). `--color-status-archived` moved with it since it renders as the chip's small label text, and all 8 non-pseudo uses of the sub-AA `--color-text-placeholder` turned out to be carrying real content and moved to the tertiary tier. Landed and verified: the comment-vote bug (comments always rendered un-voted, so un-voting was impossible), and try/catch hardening on all 6 mutation sites after finding that a transport-level failure *rejects* rather than returning `{ error }` — leaving buttons stuck disabled showing votes the server never recorded. **The profile-save toast bug is closed** — it was never a revalidation/remount problem: verification had been running in a hidden automation tab, where `requestAnimationFrame` never fires, so React never revealed the Suspense boundary, the page never hydrated, and the form fell back to a native POST that destroyed the document. Toast verified live on a production build; the field counter (A5) verified with real typing at the same time. See PROJECT_INFO.md's gotchas before doing any browser verification. `pnpm --filter web build` re-run clean (21 routes).

**Investigated and ruled out:** a one-off wrong-viewer-state render on `/u/[username]` (Follow button instead of Edit profile) seen once during Phase 6 verification turned out to be a Turbopack dev-server artifact — it occurred exactly once, on the first client-side navigation to that route right after `loading.tsx` was added to the same segment while the dev server was running. Three subsequent reproductions (a hard reload + three ref-precise `<Link>` clicks from different pages) all rendered correctly with a real per-request RSC fetch each time, and the app has no caching path that could plausibly serve one viewer's data to another (`cacheComponents` isn't enabled, and the Supabase server client reads `cookies()`, which forces dynamic rendering on every request). Not a real bug — no code change made.

A second dev-server artifact from the same family surfaced while verifying A4: **every dynamic route** (`/u/*`, `/p/*`, `/badge/*`, `/embed/*`) 404'd while `/`, `/leaderboard` and `/search` served 200, which read like a Phase 7 regression. It was a stale `apps/web/.next`. Ruled out as a data problem first — the row was present, visible to `anon` under RLS, and returned by the app's own publishable key over `curl`; the giveaway was the dev server reporting `application-code: 12ms` for a page whose first act is a Supabase round-trip. Clearing `.next` and restarting returned all four route classes to 200. No code change made; documented in PROJECT_INFO.md's gotchas.

### Phase 7 — Distribution & cold start
See [NEW_FEATURES.md](NEW_FEATURES.md) for the "why" behind each item.
- [x] Dynamic OG image for project detail (`/p/[username]/[slug]/opengraph-image`) — status chip, title, tagline, tags, author, upvote/comment counts, cover panel
- [x] Dynamic OG image for profile (`/u/[username]/opengraph-image`) — avatar, name, handle, headline, role chips, student badge, projects/upvotes/followers
- [x] Vendored OG fonts (`apps/web/assets/fonts`, Jakarta 500/700 + Mono 500) — `next/font` emits woff2, which satori cannot parse
- [x] `metadataBase` + `twitter: summary_large_image` on the root layout; `NEXT_PUBLIC_SITE_URL` added to `.env.example`
- [x] Manual `openGraph.images` removed from the project page so the generated card is not overridden
- [x] Verified live in-browser, not just typechecked: all four cards rendered as valid 1200×630 PNGs and inspected — project card, profile with avatar, profile without avatar (initial placeholder), and the draft fallback
- [x] **Draft privacy verified live**: an anonymous request for a draft project's OG image returns the generic CoBuild card — the title "Alice Secret Draft" does not appear. OG routes run as `anon` (`lib/og/client.ts`) precisely so a signed-in author can't have a draft card cached for everyone
- [x] Two real bugs found by rendering rather than reading — both now in PROJECT_INFO.md's gotchas:
  - [x] satori refuses WebP (`Unsupported image type`) and this app stores WebP by preference; fixed by negotiating format via the `Accept` header on Supabase's transform endpoint, with a magic-byte check that degrades instead of throwing
  - [x] Supabase's `resize=contain` ignores the `height` bound, so a portrait cover overflowed and was clipped; fixed by computing the fitted box from the cover's real dimensions (always available — the cover is one of the project's own images) and setting both axes explicitly
- [x] `turbo run typecheck` + `next build` clean (18 routes)
- [x] README badge `/badge/[username]` (accepts `.svg`) — avatar inlined as a data URI, stats, `s-maxage=300, stale-while-revalidate=86400`, excluded from the proxy so it stays cacheable
- [x] Embeddable project card `/embed/p/[username]/[slug]` — outside the `(app)` group so it carries no app chrome, `noindex`, anon-read
- [x] Résumé/print profile view `/u/[username]/resume` + "Résumé" link on the profile; nav chrome now `print:hidden` app-wide
- [x] `tag_follows` table + RLS + `tags.follower_count` trigger + guard extended
- [x] `feed_page` Following branch unions followed people and followed stacks (one `OR`, not a `UNION`)
- [x] Follow-tag button on `/tag/[slug]`; Following empty-state copy updated
- [x] DB types patched for `tag_follows` + `tags.follower_count`
- [x] Verified live against a temporary fixture (removed afterwards — DB back to 0 tags / 0 tag_follows / 0 project_tags):
  - [x] tag follow surfaces a project by an author the viewer does **not** follow
  - [x] following both the author and the tag yields 1 row / 1 distinct project (no dupes)
  - [x] a **draft** carrying a followed tag never appears
  - [x] `tags.follower_count` increments and decrements with the trigger
  - [x] adversarial RLS with simulated JWT roles: anon insert blocked, inserting a row owned by another user blocked, own insert allowed, deleting someone else's follow affects 0 rows, forged `usage_count`/`follower_count` on a tag insert discarded, `update tags set follower_count` blocked
  - [x] end-to-end in a real browser as a real signed-in user: clicking Follow wrote the row, fired the trigger, and the project appeared in that user's Following feed
  - [x] badge XSS: display name set to `</text><script>alert(1)</script>&"` renders as escaped literal text, zero raw `<script>`, SVG still parses as valid XML
  - [x] embed of a **draft** returns 404
- [x] **Security bug found and fixed by `get_advisors`**: `tag_follows_after_change()` shipped callable over PostgREST (`anon`/`authenticated` EXECUTE). Both `revoke … from public` *and* `revoke … from anon, authenticated` were needed — see the amended note in PROJECT_INFO.md. Advisors now back to the pre-existing intentional baseline
- [x] `turbo run typecheck` (4/4) + `next build` clean (21 routes)
- [ ] Opus review of Phase 7 as a whole — **partially done; the rest is seed-blocked.** Complete so far:
  - [x] `get_advisors` security + performance back at the documented intentional baseline, and **`tag_follows_after_change()` no longer appears** — the Phase 7 double-revoke held. Only additions are one INFO for the unused `tags_name_trgm_idx` (expected at 0 tags; do **not** drop it, Phase 5 proved it used via `EXPLAIN`) and a WARN for Auth's leaked-password protection, which is moot while sign-in is OAuth + magic-link only
  - [x] `turbo run typecheck` 4/4
  - [x] Public-surface privacy probed against a real draft ("Alice Secret Draft"): `/badge`, `/u/[username]`, `/u/[username]/resume` and the public `/embed` all contain **zero** occurrences of the draft title, and `/embed` of the draft 404s. The badge reports 1 project, not 2
  - [x] That privacy proven at the source rather than observed: `projects_after_change()` moves `project_count` only `if visibility = 'public'` (so drafts *and* unlisted are excluded, and a public→draft flip decrements), and `profiles_guard_client_columns()` pins the counters against any `anon`/`authenticated` write
  - [x] Simplification/doc pass over the 1,401 lines of Phase 7 code — **found one real defect**: `remote-image.ts`'s header told call sites to set no explicit width/height and let `fit: "contain"` size the box, which is precisely the clipped-portrait-cover bug this phase already fixed; the project card must and does set both axes from `fitContain()`. Corrected in `2a0f071`
  - [x] **Seed run** — 35 profiles / 83 projects (78 public, 80 with covers) / 207 images / 21 tags / 264 project_tags / 1069 votes / 365 comments / 175 follows. Pre-existing accounts and the `p6_*` fixtures survived (cleanup is scoped to `@seed.cobuild.dev`). Two blockers had to be cleared first: the sample `.webp`s the seed reads from `CoBuild design system/uploads/` don't exist in the repo (that folder is gitignored) so they were generated with `sharp`, incl. two portraits; and `auth.users` had `NULL` in `confirmation_token`/`recovery_token`/`email_change`/`email_change_token_new` on the three `p6_*` rows, which makes GoTrue's admin `listUsers` fail with a bare `"Database error finding users"` 500 — see the gotcha
  - [x] **Perf audit — found and fixed a real one.** `projects_hot_feed_idx` was `(hot_score DESC, created_at DESC) WHERE visibility='public'`, which does not match Hot's `ORDER BY hot_score DESC, published_at DESC, id DESC` + `published_at IS NOT NULL`; `created_at` predates the feed's move to `published_at`, and Hot is the default landing feed. Measured: 36 buffers with an `Incremental Sort` (presorted on `hot_score` only) against the 3 buffers and `Heap Fetches: 0` that the correctly-shaped `projects_top_feed_idx` achieves. `projects_new_feed_idx` had the same defect (no `id` tiebreak, no not-null predicate). Migration `align_feed_indexes_with_keyset_order` fixes both → **`Index Only Scan`, `Heap Fetches: 0`, 2 buffers each, chosen without `enable_seqscan=off`**. Everything else came back healthy: FTS via `Bitmap Index Scan on projects_search_tsv_idx`; people search on `profiles_search_trgm_idx` with the function's expression matching the index character-for-character; the Following tab's `OR` indexed on both legs (`follows_pkey`, `tag_follows_profile_idx`); the leaderboard MV correctly indexed with `Memoize` on the project join. **Honest caveat:** end-to-end `feed_page` only moved 20.2ms → 15.5ms at this size, because fixed function-planning overhead dominates 83 rows — the win is in the ranking query (45 → 2 buffers, seq scan → index-only) and it is the part that grows with the table
  - [x] **Adversarial RLS re-run on real seeded data** — see the Phase 6 final-review entry; it covers Phase 7's surfaces too
- [x] **Re-verified against real seeded covers** (80 projects now carry a `cover_image_path`), through the project card itself rather than a throwaway route. Images fetched and *looked at*, not just size-checked:
  - [x] **Portrait 900×1400 — the case the clipping bug came from — sits fully inside the cover panel**, rounded border visible on all four sides, nothing cut off. `fitContain` confirmed correct against real data for the first time
  - [x] Ultra-wide 1920×820 letterboxes correctly in the same panel; 8 further cold renders across square/landscape/portrait all rendered their covers
  - [x] Profile card: avatar, name, handle, headline, role chips, student badge, and stats matching the DB
  - [x] Draft still falls back to the generic CoBuild card — no title, author, or cover
  - [x] `og:image` meta resolves to the generated route at 1200×630 `image/png`, so the manual-`openGraph.images` override gotcha still holds. Note the real URL carries a per-route hash (`opengraph-image-y3nwlq`); the bare `/opengraph-image` path 404s
  - [ ] **One transient miss worth knowing about:** the very first render of one card came back coverless (55kB vs 119kB for the identical URL moments later) with no error surfaced. Not reproducible — 8/8 subsequent cold renders were fine, and cold transforms measure ~0.7s against `fetchOgImage`'s 3s timeout, so the timeout is not demonstrably the cause and was left alone. It matters anyway because `fetchOgImage` returns `null` on *any* failure by design, and social platforms cache the first response they get — so one blip on a project's first share caches a coverless card indefinitely. A single retry is the cheap mitigation; not added without evidence of the cause

### Phase 8 — Collaboration ("Looking for")
Migrations (filenames corrected in Task 10 — see the note at the end of this section; contents
byte-unchanged): `20260811082728_add_projects_looking_for`, `20260811085500_feed_page_looking_for`,
`20260811085656_search_projects_looking_for`, `20260811100818_add_collab_requests`,
`20260811102131_project_collaborators_unique_credit`, `20260811104338_collab_requests_guard_invoker`.

**Honest top line: 8.0 and 8.2 are code-complete but not end-to-end browser-verified. 8.1 is the
only slice with full live browser evidence.** Details and exactly what *is* confirmed for each
are below — do not read any `[x]` in this section as "verified in a browser" unless it says so.

#### 8.0 — Availability signals (`open_to_collab`, `weekly_hours_available`)
- [x] Both columns added to `PROFILE_COLUMNS` (`packages/shared/src/profiles.ts:35`)
- [x] `/settings/profile`: toggle for `open_to_collab`, number input for `weekly_hours_available`,
      server-side clamp (`WEEKLY_HOURS_MIN`–`WEEKLY_HOURS_MAX`; blank/out-of-range/unparseable all
      collapse to `null` rather than erroring)
- [x] `/u/[username]` chip — "Open to collaborate · ~N hrs/week", hours clause omitted when null
- [x] Confirmed live via `execute_sql` that `profiles_guard_client_columns()` does **not** pin
      either column — it only re-pins `id`/counters/`created_at`
- [x] **Bug found by testing, not reading**: native `min`/`max` on the hours input triggered
      whole-form HTML5 validation, blocking submission of unrelated edits too — contradicted the
      "soft signal, not a gate" requirement. Fixed by removing `min`/`max` and keeping the
      server-side clamp (commit `bd01639`)
- [x] Profile chip **render path** verified live, in a visible browser tab on a production build,
      both variants — `open_to_collab=true, hours=15` → "Open to collaborate · ~15 hrs/week";
      `hours=null` → bare "Open to collaborate" — see the 8.1 evidence file below
- [ ] **Not verified live**: the settings form *write* path itself (toggle, hours input, save,
      toast). Deferred when this slice first landed and never re-confirmed in a later browser
      session — still open

#### 8.1 — "Looking for" on projects
- [x] `projects.looking_for text[]` + CHECK constraint + partial GIN index
- [x] `feed_page` extended with `p_looking_for` (OR-matches; pure filter, doesn't enter the sort
      tuple or the keyset cursor) — precedent from Phase 5's `p_tag`, not a forked RPC
- [x] `search_projects` extended with `p_looking_for` the same way
- [x] Composer UI (`/new`, `/p/[username]/[slug]/edit`) — toggleable chip row, 0–4 values
- [x] `ProjectCard` chip — stayed in the Server Component part (the card's client islands exist
      so a feed page ships one card's worth of JS, not one per card; a static "Looking for …"
      string doesn't belong in one)
- [x] Project detail page chip, next to the status/visibility badges
- [x] Feed filter (`/`, `?looking_for=`) — `FeedTabs` renders toggle links built fresh from
      `{tab, window, lookingFor}` per request (no patched `location.search`), so tab/window
      switches now preserve the filter and there is no way for a stray param to ride along
- [x] `FeedLoadMore` threads the same `lookingFor` through client-side pagination
- [x] Search facet row on `/search` (`SearchFilters`) — generalized the existing 2-facet
      `toggleHref` (status/tag) to a 3rd facet rather than forking it
- [x] Seed: `packages/db/src/seed/seed.ts` assigns `looking_for` to ~1/3 of projects (1–2 values,
      drawn from `co-builder`/`feedback`/`beta-testers`/`designer`), and — closing the 8.0 gap —
      now also assigns `open_to_collab`/`weekly_hours_available` to ~1/3 of profiles. Both draws
      go through a small seeded `mulberry32` PRNG added for this purpose; the rest of the file is
      unchanged and still runs on `Math.random()`/unseeded `faker`
- [x] **Seed run** — 30 profiles / 80 projects. `looking_for`: 57 `(none)`, 6 `co-builder`, 4
      `feedback`, 7 `beta-testers`, 6 `designer`, 5 with two values — all four values represented,
      `(none)` the majority as intended. `open_to_collab`: 10/30 true (7 with an hours value, 3
      null — both states of the "available, hours unspecified" chip present)
- [x] **Full live browser verification — PASS**
      (`docs/superpowers/evidence/2026-08-11-phase-8-slice-8.1-browser.md`, commits
      `c627595..5e9ec02`, run in a visible tab against a production build):
  - [x] Feed filter `/?looking_for=designer` — DOM extraction over every card: 9 rendered = 9 in
        SQL, all 9 carry "Designer" including the two multi-value cards, confirming `&&` overlap
        rather than equality
  - [x] Composer round-trip (the path with **no** automated guard, since `saveProjectAction` takes
        `payload: unknown`): real mouse clicks selected Co-builder + Designer, wrote
        `looking_for = ["co-builder","designer"]` to the DB, and reopening the edit page read both
        chips back `aria-pressed="true"`. Test draft deleted afterwards, 0 leftover rows
  - [x] Search facet: `q=app&looking_for=designer` → 0 cards, confirmed correct (not broken) by
        matching the RPC's own 0; `q=track&looking_for=designer` → 2 cards, matching the RPC's 2
  - [x] Profile availability chip — both variants (see 8.0 above)
- [x] `turbo run typecheck` (4/4 packages) + `pnpm --filter web build` clean (20 routes)
- [x] Found (pre-existing, **not** a Phase 8 regression, logged for triage — see the end of this
      section): `composer.tsx:379` captures the `beforeunload` dirty-check baseline once and never
      refreshes it after a save, so the form is permanently dirty and prompts spuriously on every
      navigation after any edit. Phase 6 tranche A's guard; line 383 disarms it during the save
      itself, so saves themselves are never blocked — only the post-save prompt is spurious

#### 8.2 — Request to join
- [x] `collab_requests(id, project_id, requester_id, message, status, created_at, updated_at)` +
      RLS: requester can insert/read/withdraw own; author can read/update status on requests to
      their own projects; nobody else reads either side; no DELETE policy (withdrawal is a status
      change, not a delete) — DELETE withheld at the GRANT level, stronger than RLS
- [x] Partial unique index `collab_requests_one_pending` — one pending request per
      (project, requester); partial on purpose so a decline doesn't permanently block a
      better-argued retry
- [x] Status-transition guard trigger (BEFORE UPDATE) + 10-per-24h rate-limit trigger
      (BEFORE INSERT) + `notify_on_collab_request` (types `collab_request`, `collab_declined` —
      **no** `collab_accepted`; see the spec correction below)
- [x] `accept_collab_request(p_request_id, p_role_label)` — SECURITY INVOKER, atomic status flip +
      `project_collaborators` insert with `on conflict do nothing` against Task 7's partial unique
      index (`project_collaborators_project_profile_uniq`)
- [x] Data layer `packages/shared/src/collab.ts` (7 functions) + UI: `request-to-join.tsx`,
      `collab-actions.ts`, accept/decline inline on the `/notifications` collab_request row
- [x] **Security bug found by adversarial RLS testing, not by reading.** Both
      `collab_requests_guard()` and `collab_requests_rate_limit()` shipped as `SECURITY DEFINER`,
      which made **both triggers completely inert for every real caller since creation** — inside
      a DEFINER function `current_user` is the function owner (`postgres`), so the guards' own
      `current_user not in ('anon','authenticated')` early-return always fired. Live attacks
      confirmed all five holes this opened: requester self-accept/self-decline of their own
      request, an author rewriting the requester's message and backdating `created_at` (and even
      the primary key), a `declined → accepted` reopen, the 10-per-24h rate limit never firing,
      and a requester repointing a request onto a project they cannot see. Fixed in
      `20260811104338_collab_requests_guard_invoker.sql` (commit `3729db4`) by dropping the
      SECURITY clause only — the two function bodies were proven byte-identical to the originals
      by md5 across file, migration, and live `prosrc`. **This passed two rounds of code review
      before the live-attack suite caught it.** Full record:
      `docs/superpowers/evidence/2026-08-11-phase-8-collab-rls.md`
- [x] **Adversarial RLS suite re-run against the fix — GATE PASS.** 23 attacks: 22 blocked as
      expected, 1 expected/accepted success (an author can bypass the RPC via a direct PATCH and
      end up with `status='accepted'` and no credit row — by design, since the guard must permit
      the author's `pending → accepted` for the SECURITY INVOKER RPC to work at all; the
      mitigation is that the server action must call the RPC exclusively and never write `status`
      directly, and Task 9's reviewer independently confirmed this is true by tracing every write
      to `status` in the diff), 0 surprises. Plus 9 positive controls proving no over-blocking
      (rate limit allows exactly 10 requests, not 9) and 2 independent confirmations: the
      rate-limit count stays complete under RLS even when 3 of 9 requested-against projects are
      flipped to draft mid-transaction (9 counted, only 6 still visible), and
      `private.is_project_author` resolves correctly from the now-INVOKER trigger in all three
      directions (non-author/author/third-party)
- [x] **Bug found by testing, not reading (Task 9)**: the inherited `requestToJoin` action never
      returned the new request's id, so the `status === "pending" && requestId` render gate fell
      through to the "Request to join" branch immediately after a successful send. Fixed by
      reading back via `getViewerCollabRequest` and gating on status alone (commit `1aed241`)
- [x] `turbo run typecheck` (4/4) + `pnpm --filter web build` clean (20 routes)
- [ ] **NOT verified end-to-end in a live browser — this is genuinely outstanding.** The
      two-account request → accept/decline/withdraw round-trip has not been run. It is blocked on
      two things only a human can do: foregrounding the automation tab (a hidden tab never fires
      `requestAnimationFrame`, so the page never hydrates and forms native-POST instead) and
      running `auth.admin.generateLink` with the service-role key to sign in as a second account.
      **What IS confirmed for 8.2**: the adversarial RLS suite above (23 attacks, 22 blocked, 1
      expected success, 9 positive controls), `typecheck`, the production build, and a static
      check that `/p/leviwunsch426/sprout` renders the "Request to join" control for a signed-in
      non-author and the "Looking for Co-builder, Feedback" chip. **Do not read any of the above
      as end-to-end verification of the request/accept/decline/withdraw flow — it is not.**
- [~] Ten Minor findings from Task 9's review — full list in
      `.superpowers/sdd/2026-08-11-phase-8-collaboration/progress.md`. One of the two named here is
      now **fixed**: `revalidatePath()` with a client-supplied path was promoted to Important by
      the final review and closed in the 8.3 pass below. Still open: the Postgres `23505` "you
      already have a request pending" error is a UI dead end — the copy says a request is pending
      but the button still offers "Request to join" with no way to withdraw, recoverable only by
      a page reload
- [x] `get_advisors` security — back at the documented intentional baseline (3 pre-existing
      `rls_enabled_no_policy` INFOs, 3 pre-existing `SECURITY DEFINER`-callable-by-anon WARN pairs
      for the leaderboard/view-count RPCs, 1 pre-existing leaked-password-protection WARN, moot
      while sign-in is OAuth + magic-link only). No new findings attributable to Phase 8
- [x] `get_advisors` performance — one new INFO: `collab_requests_project_idx` unused. Expected
      and not a regression — `collab_requests` genuinely has 0 live rows (the browser round-trip
      that would populate it hasn't been run yet), so there is nothing for the index to serve.
      `projects_looking_for_idx` (8.1) **no longer reports as unused** — Task 6's seed and the
      feed/search `looking_for` filter now exercise it

#### 8.3 — Final whole-branch review fixes (2026-08-18, commit `ae7300b`)
The final review (Opus, 5 passes over `ddc29e0..6e0bd15`) returned **0 Critical, 3 Important**.
All three are closed here. Each was independently re-verified against the code before being
fixed, not taken on the report's word.

- [x] **I1 — the requester's message was collected and rendered nowhere.** `notifications.excerpt`
      is not a column: it is derived in `getNotifications` from the embedded `comments.body`, and
      a `collab_request` notification has no comment. The pitch — required, 1–500 chars,
      CHECK-constrained — was therefore *structurally* invisible, and the author accepted or
      declined a stranger on a username alone. Confirmed live: the notification row produced by a
      real insert carries `comment_id = null` (P24 in the RLS evidence file). Two surfaces now
      carry it, chosen so the hot `/notifications` SELECT (already three embeds serving seven row
      types) did not have to grow a fourth:
  - [x] `getCollabRequestSummaries` — one extra query, run **only** when a `collab_request` row is
        on the page. Returns the message *and* the live status
  - [x] `CollabRequests` on the project detail page, author-only — the first consumer
        `getProjectCollabRequests` has ever had, and the durable surface: a notification feed
        pages, so a request scrolled past the limit was previously stranded pending forever while
        the requester's button read "Request sent" indefinitely
  - [x] Accept/Decline controls no longer stay live on an already-resolved request. Previously
        there was no resolved flag at all, so clicking a stale control only *then* surfaced the
        "already handled" error
- [x] **I2 — `FeedLoadMore` carried no `key`.** Its `items`/`cursor` are `useState` seeded at
      mount, and every feed filter is a search param on the *same* route — so changing one is a
      soft navigation that preserves them: stale cards under a filtered first page, and the next
      "Load more" running a **filtered query from an unfiltered keyset**. Note this was wider than
      the review stated: the `tab` and `window` axes had it too, so it **predates** the
      `looking_for` filter, which only added a third way in. `feed-key.ts` covers every axis in
      one place so a new filter cannot silently reintroduce it. Task 6's plan step aimed its
      check at `?cursor=` in the URL, which this app does not have — the check as written could
      not have detected this
- [x] **I3 — `revalidatePath()` took a client-supplied path** from a hidden form field.
      Under-graded as a Minor in Task 9 and promoted by the final review, correctly:
      `withdrawRequest` carries no rate limit and *cannot fail* (a 0-row PATCH returns 204 with
      `error` null), so any authenticated user could drive it at unlimited rate. The path shape is
      fully known, so it is now validated rather than trusted
- [x] **A17's mitigation is enforced, not just documented.** It was a code comment; the reviewer
      noted a comment decays. `pnpm check:invariants` now fails on a direct `status: "accepted"`
      write to `collab_requests`, or any `accept_collab_request` call outside its single wrapper.
      **Negative-controlled** — deliberately introduced both violations and confirmed the check
      exits 1 naming each, before wiring it up. (A guard nobody has watched fail is exactly what
      shipped the inert SECURITY DEFINER triggers.)
- [x] **Rate-limit copy corrected.** `collab_requests_rate_limit()` counts every row created in
      the 24h window *whatever its status*, so withdrawing does not free a slot. The old copy
      implied it might
- [x] **The RLS evidence file's dangling migration filenames fixed** — it still named
      `20260811T1430_`/`T1450_`, which stopped existing at Task 10's rename, while `CHECKLIST.md`
      points readers at that file as the authoritative record of this phase's only real security
      hole. The rename is recorded in-file so the historical commit references still resolve
- [x] **The three notification links, positively controlled** (P24–P26, appended to the RLS
      evidence file). The review found the suite proved only what *cannot* happen and never that
      the author-side notification fires at all. Run against the live DB, each in its own
      rolled-back transaction: insert ⇒ author's `collab_request`; decline ⇒ requester's
      `collab_declined` (direction inverted, which is the point); `accept_collab_request` ⇒ status
      **and** credit row **with** `role_label` **and** credit notification, from one call.
      Residue verified zero afterwards
- [x] `turbo run typecheck` 4/4, `pnpm --filter web build` clean (20 routes), `check:invariants` OK
- [ ] **Still not browser-verified.** These fixes are typechecked and built, not clicked through.
      `collab_requests` has 0 live rows, so the two new surfaces have never rendered with real
      data. Same blockers as 8.2 below

#### Policy-drift check (Task 10, read-only — this phase must not touch existing RLS)
- [x] `projects`/`project_images`/`project_tags`/`project_collaborators` policies queried directly
      against the live DB and confirmed **identical to the pre-phase state**: `projects` still
      gated on `author_id = auth.uid()` (`projects_update_own`, `projects_delete_own`); the three
      child tables still on `private.is_project_author`/`private.can_see_project`. Phase 8 is
      credit-only as designed (decision D-B) — no drift, no fix needed

#### Migration filenames (Task 10)
- [x] The six migration files above were renamed with `git mv` (contents byte-unchanged) from
      their original `YYYYMMDDTHHMM_` on-disk names to the versions Supabase actually registered
      in `supabase_migrations.schema_migrations` (`20260811082728`, `20260811085500`,
      `20260811085656`, `20260811100818`, `20260811102131`, `20260811104338`). Left as they were,
      a future `supabase db push` would have treated all six as new migrations, and
      `add_projects_looking_for`'s `alter table ... add column` would have **failed** on re-apply
      against a database that already has the column

### Web verification
- [ ] All three sign-in methods work end-to-end
- [ ] Post → multi-image gallery → reorder → cover change → co-builder credit shows on their profile
- [ ] Upvote/comment/bookmark persist correctly from both card and detail page
- [ ] Hot/New/Top/Following stable under concurrent inserts, no dup/skip across pages
- [x] Adversarial RLS test: user A cannot vote as B, edit B's project, read B's draft, or fake a view — all verified on seeded data under Phase 6's final review. Storage-path uploads were verified in Phase 3 against policies that haven't changed since
- [x] `get_advisors` clean (security + performance at the documented intentional baseline)
- [ ] Logged-out browsing works; interaction prompts sign-in
- [ ] `turbo run typecheck` clean, `get_advisors` clean

---

## MOBILE APP

### Phase 0 — Mobile foundation
- [ ] `apps/mobile` Expo + expo-router scaffold
- [ ] NativeWind 4 + Tailwind 3 config wired to `packages/tokens`
- [ ] Supabase client: SecureStore session persistence, `AppState` token refresh
- [ ] Tab navigation shell (Feed / Explore / Create / Leaderboard / Profile)
- [ ] **Preview checkpoint**: empty shell running in Expo Go on your phone

### Phase 1 — Auth on mobile
- [ ] Magic-link sign-in on mobile
- [ ] GitHub/Google OAuth via `expo-auth-session`, `cobuild://` scheme registered
- [ ] Username onboarding screen (mobile layout)
- [ ] Switched to development build (`eas build --profile development`)
- [ ] Opus review: full OAuth round-trip tested on physical phone, both providers

### Phase 2/3 — Profile + Projects (mobile UI)
- [ ] Profile screen, settings, follow button
- [ ] Create/edit project form (mobile)
- [ ] Image picker → compression → upload pipeline
- [ ] Project detail: swipeable gallery, pinch-to-zoom
- [ ] Opus review: real phone photo (EXIF/orientation) uploads and displays correctly

### Phase 4 — Feed + engagement (mobile UI)
- [ ] Feed tabs, infinite scroll, pull-to-refresh
- [ ] Vote/comment/bookmark optimistic UI
- [ ] Opus review: scroll performance with seeded data on physical phone

### Phase 5 — Discovery (mobile UI)
- [ ] Leaderboard, search, tag pages (mobile layout)

### Phase 6 — Notifications + push + polish
- [ ] In-app notifications screen
- [ ] Expo push token registration + send pipeline
- [ ] App icon, splash screen, `app.json` metadata
- [ ] **Final Opus review**: cross-platform regression — same backend, both clients in sync

### Mobile verification
- [ ] Cold `expo start` → scan → app loads on phone
- [ ] Both OAuth providers complete round-trip on-device
- [ ] Real phone photo posts correctly oriented, visible on both mobile and web
- [ ] Cross-client sync: action on mobile reflected on web (and vice versa) without manual refresh issues
- [ ] Push notification received on-device
- [ ] Extended scroll of seeded feed: no dropped frames, no memory growth
