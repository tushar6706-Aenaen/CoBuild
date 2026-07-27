# CoBuild — Mobile App Build Plan

Companion files: [WEB_APP_PLAN.md](WEB_APP_PLAN.md) · [CHECKLIST.md](CHECKLIST.md)

## Context

Starts only after the web app's Phase 6 final review passes — by then the schema, RLS, ranking, storage pipeline, and `packages/shared` data functions are already built and tested. Mobile's job is UI + platform glue, reusing all of that. Same Supabase project (`mwxokedrwjlyrqcwvdur`), same tables, no schema changes expected.

**Design source:** the same `CoBuild.dc.html` covers mobile at the same breakpoints (the file's `isD`/`isM` flags branch desktop-sidebar vs mobile-bottom-nav layout) — so there is no separate mobile design file to commission; it's the same screens re-laid-out for a narrower viewport plus native affordances (bottom tab bar instead of sidebar, native image picker, swipeable gallery).

**Phone preview requirement:** you want to see the app on your own phone as it's built, not just in a simulator. Setup for that:

1. Install **Expo Go** from the App Store / Play Store on your phone.
2. `npx expo start` in `apps/mobile` — this prints a QR code.
3. Scan it from Expo Go (phone and computer must be on the same Wi-Fi network).
4. If your phone is on a different network / behind a restrictive router, run `npx expo start --tunnel` instead — slower, but works over the internet.
5. Every file save hot-reloads directly on your phone. No cable, no build step needed for day-to-day development.

Two things Expo Go **can't** preview, called out where they come up below: custom OAuth URL schemes and push notification tokens both need a "development build" (`eas build --profile development`) instead — still installs and previews on your phone, just requires one real build rather than Expo Go's instant reload. I'll flag exactly when that switch is needed.

## Agent assignment strategy

Same split as web:

- **Sonnet 5** — screen scaffolding translated from the design file, NativeWind styling, list/gallery components, forms. This is most of the mobile build, since the data layer and business logic already exist in `packages/shared`.
- **Opus 5** — the platform-specific integration points that are genuinely hard to get right and hard to debug on-device: OAuth deep linking, push notification delivery, image picker → compression → upload correctness, and the end-of-phase review pass.

## Phases

### Phase 0 — Mobile foundation (Sonnet scaffolds, Opus reviews the client setup)

| Task | Agent | Why |
|---|---|---|
| `apps/mobile` Expo + expo-router scaffold, NativeWind 4 + Tailwind 3 config wired to `packages/tokens` | Sonnet | Boilerplate, config mapping |
| Supabase client for mobile: AsyncStorage/SecureStore session persistence, `AppState`-driven token refresh | **Opus** | Session handling bugs on mobile manifest as silent logouts — easy to miss in dev, painful in production |
| Tab navigation shell (Feed / Explore / Create / Leaderboard / Profile) matching the design file's mobile layout | Sonnet | Direct translation |
| **Preview checkpoint**: confirm the empty shell runs in Expo Go on your phone | — | First real "is this working on my device" milestone |

### Phase 1 — Auth on mobile

| Task | Agent | Why |
|---|---|---|
| Email magic-link sign-in screen | Sonnet | Reuses web's auth logic from `packages/shared` |
| GitHub/Google OAuth via `expo-auth-session`, `cobuild://` custom scheme registered in Supabase redirect allowlist | **Opus** | Deep-link OAuth is the single most failure-prone piece of the mobile build — redirect URIs, universal links, and Supabase's allowlist all have to agree exactly |
| Username onboarding screen (mobile layout) | Sonnet | Spec-driven, same form as web |
| **Switch to a development build here** (`eas build --profile development`) — Expo Go cannot handle the custom OAuth redirect scheme | — | Required for OAuth testing on-device, not optional |
| **Review**: full OAuth round-trip test on your physical phone for both providers | **Opus** | Simulators mask redirect issues that only show up on a real device |

### Phase 2 — Profile + Phase 3 — Projects (mobile UI)

| Task | Agent | Why |
|---|---|---|
| Profile screen, settings, follow button | Sonnet | Reuses web's data functions, just new UI |
| Create/edit project form | Sonnet | Reuses web's mutation logic |
| `expo-image-picker` (multi-select) → `expo-image-manipulator` compression → direct-to-Storage upload | **Opus** | Same cost/perf risk as web's upload pipeline, plus a new class of platform bug (EXIF orientation, memory pressure on large multi-select) |
| Project detail: swipeable gallery with pinch-to-zoom, `expo-image` rendering | Sonnet | Standard component, well-documented Expo APIs |
| **Review**: upload a real phone photo (unrotated/EXIF-heavy) end-to-end, confirm it displays correctly | **Opus** | This exact bug (sideways images) is the most common mobile-upload regression |

### Phase 4 — Feed + engagement (mobile UI)

| Task | Agent | Why |
|---|---|---|
| Feed tabs, infinite scroll, pull-to-refresh | Sonnet | Reuses web's pagination logic verbatim |
| Vote/comment/bookmark, optimistic UI | Sonnet | Same logic as `ProjectCard`, ported to RN components |
| **Review**: scroll-performance pass with seeded data (~80 projects) on your actual phone, not just a simulator | **Opus** | List virtualization and image-loading jank only show up under real device constraints |

### Phase 5 — Discovery (mobile UI)

| Task | Agent | Why |
|---|---|---|
| Leaderboard, search, tag pages | Sonnet | Direct reuse of web's queries, new RN layout |

### Phase 6 — Notifications + push + submission polish

| Task | Agent | Why |
|---|---|---|
| In-app notifications screen | Sonnet | Reuses web's data layer |
| Expo push notification registration + token storage + a Supabase Edge Function (or trigger) to send them | **Opus** | Push delivery has several silent-failure modes (expired tokens, wrong credentials, background/foreground state) that need deliberate testing, not just "it worked once" |
| App icon, splash screen, `app.json` metadata | Sonnet | Mechanical |
| **Final review**: full regression pass across both platforms sharing the same backend — confirm a project posted on web appears correctly on mobile and vice versa | **Opus** | The whole point of one shared database is that both clients stay perfectly in sync; this is the check that proves it |

## Verification (end of mobile build)

- Fresh Expo Go scan on your phone loads the app from a cold `expo start`.
- Both OAuth providers complete a full round trip on-device (development build).
- Post a project from mobile with a real phone photo; confirm it appears correctly oriented on both mobile and web.
- Vote/comment/bookmark from mobile; confirm it's reflected instantly on web without a refresh-required staleness issue (via React Query cache invalidation, not a hard requirement for realtime sync).
- Push notification received on-device for a vote/comment/follow event.
- Scroll the seeded feed (~80 projects) on your phone and confirm no dropped frames or memory growth over an extended scroll.
