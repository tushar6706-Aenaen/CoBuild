# CoBuild

## What it is

A platform where developers, students, and designers post the projects they've built to showcase them and get discovered — Reddit-style upvoting and a ranked feed, Instagram-style visual posts, and profiles that double as a public portfolio you can link on a résumé.

The problem it solves: student and indie work is invisible. GitHub shows the code but not the story. LinkedIn shows the story but not the work. Dribbble is designers-only. CoBuild is one credible surface for "here's what I built, here's the stack, here's the demo, here's who built it with me."

## Who it's for

Developers, designers, and students — roles aren't exclusive (someone can be both a developer and a designer), and a student flag exists specifically because students are a core segment.

## Core features

- **Showcase posts** — title, description, image gallery (cover + screenshots, no video), live demo URL, GitHub repo link, tech stack tags, status badge (Shipped / In progress / Archived)
- **Reddit-style upvoting** — Hot / New / Top / Following ranked feed, with a real hot-score algorithm (not just chronological)
- **Co-builder credits** — tag teammates on a project with a role label; it auto-adds to their portfolio
- **Comments** — threaded, 2 levels deep
- **Bookmarks, share, view counts**
- **Profiles** — avatar, username, bio, multiple role identities, optional student badge (college + grad year), external links (GitHub/Behance/Dribbble/Figma/etc.), follow/followers
- **Leaderboard** — top projects and top builders, daily/weekly windows
- **Search & tag pages** — projects, people, tags
- **Notifications**

Full feature-by-feature detail lives in the build plans, not here.

## Platforms

Web app (Next.js) and mobile app (Expo/React Native), sharing one Supabase backend. Web ships first; mobile reuses the same schema and data layer.

## Tech stack

| Layer | Choice |
|---|---|
| Web framework | Next.js 16 (App Router), React 19 |
| Mobile framework | Expo 57, expo-router, React Native 0.86 |
| Language | TypeScript |
| Backend / DB / Auth / Storage | Supabase (Postgres 17) — one project shared by both apps |
| Data layer | `@supabase/supabase-js`, `@supabase/ssr` (web), `@tanstack/react-query` |
| Styling — web | Tailwind CSS 4 + shadcn/ui |
| Styling — mobile | Tailwind CSS 3 + NativeWind 4 |
| Validation | Zod |
| Monorepo | Turborepo + pnpm workspaces |
| Design tokens | `packages/tokens` — shared color/spacing/type scale consumed by both apps' Tailwind configs |

**Auth:** GitHub OAuth, Google OAuth, email magic link (all via Supabase Auth).

**Images:** Supabase Storage for avatars and project galleries; served through Supabase's image transformation for resizing/WebP. No video anywhere in the product — images (including short demo GIFs) carry the "demo" role instead.

**Ranking:** Reddit-style hot-score formula computed and stored in Postgres via trigger — no cron re-scoring, no external recommendation service.

## Repo layout

```
COBUILD/
  apps/
    web/            Next.js app
    mobile/         Expo app
  packages/
    db/              generated Supabase types + seed script (src/seed/)
    shared/          Zod schemas, query hooks, data functions (client-agnostic)
    tokens/          shared design tokens
```

Schema lives on Supabase directly (applied via migrations through the Supabase MCP tools, not a local `supabase/` folder) — see `packages/db/src/database.types.ts` for the generated, authoritative shape.

## Supabase project

- Project ref: `mwxokedrwjlyrqcwvdur`
- Region: `ap-southeast-1`
- Postgres: 17.6
- 14 tables, RLS enabled on all. Schema built and adversarially tested by an Opus review pass (22+ migrations, security advisors 25→3 intentional, 30+ live RLS attacks blocked).

## Known gotchas (read before touching schema-adjacent code)

- **Never hardcode a background colour for a scrim — compose it from `--color-bg-page-rgb` / `--color-bg-panel-rgb`.** Translucent overlays (the sticky header, the mobile bottom bar, the gradient over a card's cover image, the composer's sticky action bar, view-count pills) can't use `var(--color-bg-page)` directly because they need an alpha channel, so each one used to spell out `rgba(10,12,16,0.72)`. When the palette moved, every one of those was left holding the *previous* palette's colour — eight stale blue-black scrims floating over a green-black app, invisible in code review because each looked locally correct. Write `bg-[rgb(var(--color-bg-page-rgb)/0.72)]` instead; the channel tokens exist for exactly this.
- **The neutrals are green-tinted near-blacks with deliberately tiny gaps between surfaces** (page `#090A09` → panel `#0F110F` → panelAlt `#121412`). Cards are separated from the page by their border, not by a brightness step — the border is a measured `rgba(255,255,255,0.12)`, which is why borders did *not* change when the palette did. This was briefly replaced by the Tailwind Slate scale to get stronger elevation, then restored on purpose; if elevation needs to read harder, widen the gaps in `packages/tokens/src/colors.ts` rather than reaching for a blue-grey. No chrome in the app carries a blue cast — a DOM sweep for "blue channel ≥8 above both red and green" returns zero hits on every route. The two intentional exceptions are the `#6FD2E8` "Shipped" status colour and Google's brand mark on `/login`.
- **`profiles.avatar_url` holds a storage path, not a URL** — named `avatar_url` for historical reasons, but treated exactly like `projects.cover_image_path` for consistency: resolve it through Supabase's storage/image-transform endpoint at render time, don't store a resolvable URL in the column.
- **`unlisted` projects are NOT hidden by RLS** — the database allows anyone to read a project (and its images/tags/comments, and to vote/bookmark it) when `visibility IN ('public','unlisted')`, on purpose, so a direct link works. This means **every feed/search/tag/leaderboard query must explicitly filter `.eq('visibility', 'public')`** — that app-layer filter, not RLS, is what keeps unlisted projects out of public listings. The partial indexes (`projects_hot_feed_idx`, `projects_new_feed_idx`) are built on `visibility = 'public'`, so a correctly-filtered query is fast and an incorrectly-filtered one silently seq-scans — a good canary if something's wrong.
- **Trigger-maintained columns are not client-writable** — `projects.{upvote_count,comment_count,bookmark_count,view_count,hot_score,search_tsv}`, `profiles.{follower_count,following_count,project_count,total_upvotes_received}`, and `comments.upvote_count` are all guarded: anon/authenticated writes to them are silently discarded, and the real values come only from the `votes`/`comment_votes`/`follows`/`bookmarks` join tables via triggers. Never write to these directly, including in seed/admin scripts run with the service role — the guard doesn't apply there, so a hand-set value gets added on top of the trigger's value instead of ignored.
- **Comment upvoting goes through `comment_votes`**, a dedicated per-user table mirroring `votes` — not a bare counter increment.
- **View counting is RPC-only** (`record_project_view`) — `project_views` has RLS enabled with zero client policies, so it's unreachable except through that function.
- **Username availability checks must use `.eq()`, never `.ilike()`.** `profiles.username` is `citext`, so `eq` is already case-insensitive at the DB level. `_` is a legal username character but a single-char wildcard in `ilike`, so an `ilike` check would falsely report e.g. `a_b` as taken whenever `axb` exists.
- **`profiles.avatar_url` is never populated from an OAuth provider automatically** — the signup trigger deliberately leaves it `null` even though GitHub/Google supply an avatar URL in `raw_user_meta_data ->> 'avatar_url'`, because that value is a full external URL, not a storage path, and would violate the path-only convention above. Onboarding's avatar upload is the only writer. An "import your GitHub avatar" feature is possible later (fetch server-side, re-upload to the `avatars` bucket, store the resulting path) but isn't built.
- **`/auth/signout` is POST-only, deliberately** — a GET-triggerable sign-out (e.g. via `<img src>`) is a CSRF footgun. Any sign-out UI must submit a POST, not link/navigate to it.
- **Next 16's image SSRF guard misfires on NAT64 networks.** Next 16 refuses to optimise an upstream image whose host resolves to a "private" IP. If your DNS resolves through NAT64, Supabase's Cloudflare-fronted storage comes back as `64:ff9b::`-prefixed IPv6 (e.g. `64:ff9b::ac40:95f6` = `172.64.149.246`, which is Cloudflare and genuinely public — the private range is `172.16/12`, i.e. `.16`–`.31`). Next misreads these as private and 400s **every** image. `next.config.ts` sets `dangerouslyAllowLocalIP` in development only; that's safe here because `remotePatterns` already pins fetches to one hostname, so there's no arbitrary-URL surface. Production keeps the strict default. Symptom if this ever regresses: every avatar/cover renders as its placeholder, and the dev server logs `upstream image ... resolved to private ip`.
- **Profile tab queries are capped at `PROFILE_TAB_LIMIT` (48) and depend on composite indexes.** `projects(author_id, created_at desc)`, `bookmarks(profile_id, created_at desc)`, and `project_collaborators(profile_id, status)` (migration `profile_tab_indexes`) are what make these ordered top-N lookups index scans. Phase 0's indexes are partial on `visibility='public'` and ordered for the *feed*, so they do not serve profile tabs. Removing the limit or the ordering reintroduces a full scan with an on-disk sort.
- **`getProfileContributions` ordering is subtle.** It must use `.order("project(created_at)")` — supabase-js's `{ referencedTable: "project" }` emits `project.order=`, which orders *within* a to-many embed and leaves parent order undefined. Combined with a `LIMIT` that silently yields an arbitrary slice.
- **`next/image`'s default loader is incompatible with Supabase's transform API.** Next appends its own `?w=&q=` params; Supabase expects `?width=&height=&resize=&quality=`. Every `<Image>` rendering a Supabase URL MUST build the URL via `transformedStorageUrl()` from `@cobuild/shared` and pass the `unoptimized` prop — otherwise the image is served untransformed at full size (or, with the built-in loader silently mismatched, potentially breaks entirely). `unoptimized` also means no automatic responsive `srcset` — pick one width from `IMAGE_SIZES` per call site.
- **Supabase's transform endpoint distorts images unless `resize` is passed.** Passing only `width` defaults to `resize=cover`, which keeps the source's original height — a 1200×800 image requested at `width=640` comes back `640×800`, visibly squashed. Use `fit: "contain"` (the `transformedStorageUrl` default) for anything shown at its natural aspect ratio; only use `fit: "cover"` with both `width` AND `height` set, for a deliberate square/fixed-box crop (avatars).
- **The raw `/object/public/` endpoint does not apply EXIF orientation; the `/render/image/` transform endpoint does.** Since compression already bakes rotation into the pixels and strips the EXIF tag before upload, both endpoints agree on `width`/`height` for everything this app stores — but never reintroduce a passthrough path that uploads an EXIF-rotated file un-recompressed, or the two endpoints will disagree.
- **Don't trust `createImageBitmap({ imageOrientation: "none" })` to mean "give me raw, unrotated pixels."** Verified empirically (not from documentation): current Chrome ignores that option for JPEGs with an EXIF orientation tag and applies the rotation anyway. `lib/images/compress.ts` therefore runs a cached runtime probe (decode a known 16×8 fixture with Orientation 6, check whether the result comes back rotated) rather than assuming any engine's documented behavior. If you touch orientation handling, re-verify against a real browser with a real EXIF fixture — reading the code is not enough to catch this class of bug, since the code was internally consistent and still wrong.
- **`@supabase/supabase-js` (2.110.8) cannot report upload progress** — `storage.upload()` takes no progress callback and `fetch` can't report request-body progress either. Real byte-level progress requires driving `createSignedUploadUrl()` + a raw `XMLHttpRequest` PUT matching the SDK's multipart wire format (see `lib/images/upload.ts`). A signed PUT needs no `Authorization`/`apikey` header. Progress is capped at 99% until the server confirms — reporting 100 before success is a lie the UI shouldn't tell.
- **The orphan-cleanup job cannot delete via raw SQL.** `storage.objects` has a `protect_objects_delete` trigger that rejects direct `DELETE`; even bypassing it only removes the DB row and strands the bytes in the bucket. Deletion must go through the Storage API — hence the split between a read-only `orphaned_project_media()` SQL function (checks both `project_images.storage_path` AND `projects.cover_image_path`; a circuit breaker refuses to report anything if referenced paths exist but none match any object, which is the signature of a path-format drift) and a separate Edge Function that does the actual deleting, on an hourly `pg_cron` schedule.
- **Never build a keyset-pagination cursor from a `float8` column's printed text value.** This Supabase instance runs `extra_float_digits = 0`, so `hot_score::text` does not round-trip: `hot_score = 'hot_score::text'::float8` can be `false`. A cursor's `eq` tie-break leg then never matches and the `lt` leg fails to exclude the boundary row — an infinite loop, one row at a time. The feed's Hot-tab pagination goes through the `feed_page` SQL function specifically to do a real Postgres row-value comparison server-side instead. If you add another sort that includes a float column, route it through `feed_page` (or a similar RPC) rather than a PostgREST `.or()` cursor chain — this was caught by testing tie-break pagination for real, not by reading the query.
- **Feed pagination is keyset-only, never `OFFSET`.** `getFeedPage`'s cursor is opaque — treat it as such from calling code. `/tag/[slug]` scopes the same feed via `feed_page`'s `p_tag` argument, so it inherits that cursor unchanged; `/notifications` is still a stub until Phase 6.
- **`revoke ... from anon, authenticated` does not lock down a function — `PUBLIC` does.** Postgres grants EXECUTE on every new function to `PUBLIC` by default, and `anon`/`authenticated` inherit it through that grant rather than a direct one, so revoking from them by name changes nothing. This was live for real: `refresh_leaderboard()` (SECURITY DEFINER, does a `DELETE` plus a full materialized-view rebuild) was callable by any anonymous visitor over PostgREST until it was revoked from `PUBLIC`. Any future admin/maintenance function needs `revoke all on function ... from public` — and `has_function_privilege('anon', ...)` is the check that actually proves it, not reading the grant statement.
- **The leaderboard is not "Top with a shorter window".** Feed's Top ranks projects *published* recently by lifetime `upvote_count`; the board ranks every public project by votes *cast* inside the window (`votes.created_at`). A two-year-old project having a great week belongs on the board and can never appear on Top. Don't "simplify" one into the other.
- **`leaderboard_daily` is a materialized view, so RLS does not apply to it.** It is deliberately ungranted (`revoke all ... from anon, authenticated`) and reachable only through `leaderboard_projects()` / `leaderboard_builders()`, which are SECURITY DEFINER and re-check `visibility = 'public'` on the hydration join — so a project that goes private drops off immediately instead of lingering until the next refresh. Never grant SELECT on the view to expose it "more simply".
- **Rank deltas need a stable tie-break.** `leaderboard_daily` orders by `(votes desc, published_at desc, entity_id)` and numbers with `row_number()`. If the tie-break were nondeterministic, two projects tied on votes would swap places every 10 minutes and each report a phantom ±1 rank change. `leaderboard_previous` holds the ranks from one refresh ago; a missing row there means "new to the board", which is rendered as `new` and is deliberately distinct from a delta of `0` ("held position").
- **Search's project ranking is a float and must never become a paging cursor** — same `extra_float_digits` trap as `hot_score`. `search_projects` is therefore a single bounded top-N page (capped at 60 server-side), not a keyset scroll, and returns a `count(*) over ()` total for the section headings.
- **User input reaching `ILIKE` must go through `like_escape()`.** People and tag search are trigram substring matches; unescaped, a query containing `%` matches every row and one containing `_` silently matches an extra character. `search_people`'s predicate must also stay character-for-character identical to `profiles_search_trgm_idx`'s expression — any drift (a changed `coalesce`, a reordered column) silently drops it to a sequential scan.
- **Use `websearch_to_tsquery`, not `to_tsquery`,** for anything user-typed: it accepts quoted phrases, `or`, and a leading `-`, and returns an empty query on malformed input instead of raising an error that would 500 the search page.
- **The `next`/`redirectTo` query param on `/auth/callback` is fully attacker-controlled** — Supabase's redirect allowlist is necessarily a wildcard over our own origin, so anyone can craft an authorize URL with any query string on that route. It's sanitized via `sanitizeNextPath` in `apps/web/src/lib/auth/redirects.ts`; never bypass that helper when adding new redirect logic.

## Related docs

- [WEB_APP_PLAN.md](WEB_APP_PLAN.md) — phased web build plan, agent assignments
- [MOBILE_APP_PLAN.md](MOBILE_APP_PLAN.md) — phased mobile build plan, phone-preview setup
- [CHECKLIST.md](CHECKLIST.md) — tickable progress tracker for both apps
- [AUTH_SETUP.md](AUTH_SETUP.md) — manual GitHub/Google OAuth provider setup (one-time, needs your accounts)
- `CoBuild design system/` — interactive design spec (`.dc.html`) covering all 10 screens
