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
- [ ] Seed script **run** — blocked on you adding `SUPABASE_SERVICE_ROLE_KEY` to `packages/db/.env` (never pasted in chat; see `.env.example`), then `pnpm seed`
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
- [x] Fixture data removed afterwards — the DB is back to 2 profiles / 0 projects, still waiting on `pnpm seed`

**Not built (deliberate):** the design's "Follow tag" button on `/tag/[slug]` — there is no `tag_follows` table and tag following isn't in any phase of the plan, so shipping a dead button was the worse option. Add the table first if you want it.

### Phase 6 — Notifications + polish
- [x] Notifications screen + mark-read — verified live (`/notifications`, empty state + mark-all-read wired)
- [x] Notification-writing triggers (vote/comment/follow/credit) — confirmed live on the Supabase project: `notify_on_vote`, `notify_on_comment`, `notify_on_follow`, `notify_on_credit`
- [x] Global nav (signed-in / signed-out variants) — `nav-items.tsx` branches on `signedIn`, verified signed-in live
- [x] All empty states — consistent dashed-border/icon-badge pattern verified across feed, bookmarks, notifications, profile tabs
- [x] Loading states — added tailored `loading.tsx` for the 5 routes that were silently inheriting the feed's skeleton shape: bookmarks, project detail, profile, tag pages, settings (new `SkeletonTileGrid` primitive added to `components/shell/skeleton.tsx`, reused by bookmarks + profile)
- [x] Delete-confirmation dialog — confirmed a real shadcn `Dialog` (not `window.confirm`) on project delete, with cancel/pending/error states
- [ ] **Final Opus review before mobile starts**: full RLS adversarial pass, advisors check, perf audit, simplification pass

**In-flight UI/UX pass — see [REMEMBER.md](REMEMBER.md) for the full checkpoint.** A three-part audit (interaction, a11y, visual system) found ~40 issues; tranche A (real bugs + a feedback layer) is implemented and partly verified. Landed and verified: the comment-vote bug (comments always rendered un-voted, so un-voting was impossible), and try/catch hardening on all 6 mutation sites after finding that a transport-level failure *rejects* rather than returning `{ error }` — leaving buttons stuck disabled showing votes the server never recorded. **One open bug:** the profile-save confirmation toast doesn't fire, because a Server Action revalidates the `(app)` layout and remounts the toast state. Re-run `pnpm --filter web build` before trusting the tree — the last full build predates the final `toast.tsx` rewrite.

**Investigated and ruled out:** a one-off wrong-viewer-state render on `/u/[username]` (Follow button instead of Edit profile) seen once during Phase 6 verification turned out to be a Turbopack dev-server artifact — it occurred exactly once, on the first client-side navigation to that route right after `loading.tsx` was added to the same segment while the dev server was running. Three subsequent reproductions (a hard reload + three ref-precise `<Link>` clicks from different pages) all rendered correctly with a real per-request RSC fetch each time, and the app has no caching path that could plausibly serve one viewer's data to another (`cacheComponents` isn't enabled, and the Supabase server client reads `cookies()`, which forces dynamic rendering on every request). Not a real bug — no code change made.

### Web verification
- [ ] All three sign-in methods work end-to-end
- [ ] Post → multi-image gallery → reorder → cover change → co-builder credit shows on their profile
- [ ] Upvote/comment/bookmark persist correctly from both card and detail page
- [ ] Hot/New/Top/Following stable under concurrent inserts, no dup/skip across pages
- [ ] Adversarial RLS test: user A cannot vote as B, edit B's project, read B's draft, fake a view, or upload to B's storage path
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
