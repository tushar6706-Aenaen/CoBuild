# Session checkpoint — UI/UX pass (Phase 6 follow-on)

Working notes for picking this back up. Companion to [CHECKLIST.md](CHECKLIST.md).
Full plan: `C:\Users\TUSHAR\.claude\plans\joyful-floating-hollerith.md`

**Status: tranche A is COMPLETE — all eight items implemented and verified live (A4 and A6 closed out last). `pnpm --filter web build` re-run clean (21 routes).**

**Read this before re-verifying anything in a browser:** the "A7 toast never fires" bug and the "automation can't type into this app" note were the *same* environment artifact, not app bugs — a hidden automation tab never fires `requestAnimationFrame`, so React never reveals a Suspense boundary, so no page segment ever hydrates. Full write-up in `PROJECT_INFO.md`'s gotchas. Force the tab foreground (a screenshot does it) before concluding anything is broken.

---

## 1. Loading states (done earlier, verified)

Added tailored `loading.tsx` for the 5 routes that were silently inheriting the feed's card-shaped skeleton: `bookmarks`, `p/[username]/[slug]`, `u/[username]`, `tag/[slug]`, `settings/profile`. New `SkeletonTileGrid` primitive in `components/shell/skeleton.tsx` (reused by bookmarks + profile). Verified live, build clean.

Also investigated and **ruled out** a suspected stale-viewer-cache bug on `/u/[username]` — it was a one-off Turbopack dev artifact, not real. Documented in CHECKLIST.md.

---

## 2. UI/UX audit

Three parallel audits (interaction/feedback, a11y/responsive, visual-system) found ~40 issues. Two dominate:

- **No feedback channel existed at all** — no toast, no `aria-live` anywhere. Every optimistic action failed invisibly.
- **113 `hover:` utilities vs 13 `transition` declarations** — nearly everything hard-cuts its colour. No `prefers-reduced-motion` at all.

Scope agreed: **tranche A** (bugs + feedback layer) and **tranche B** (cheap visual polish), dark theme only. A11y pass and design-system refactor (type scale, button variants) explicitly deferred.

---

## 3. Tranche A — what was built

| # | Item | Status |
|---|---|---|
| A1 | Comment-vote viewer state | ✅ **verified live** |
| A2 | Toast primitive (module store) | ✅ **verified live** — see A7 |
| A3 | Failure toasts + `disabled`/`aria-busy` on 6 mutation sites | ✅ verified *(before A2 rewrite)* |
| A3b | try/catch hardening — **real bug found** | ✅ verified *(before A2 rewrite)* |
| A4 | Onboarding dead-end | ✅ **verified live** |
| A5 | Silent truncation | ✅ **verified live** |
| A6 | Composer unsaved-changes guard | ✅ **verified live** |
| A7 | Profile-save confirmation | ✅ **fixed + verified live** |

### A1 — comment-vote bug (the headline fix) ✅
`getProjectComments` never joined `comment_votes`, so `comments.tsx` hardcoded `useState(false)`. Every comment rendered un-voted on load; clicking one you'd already upvoted hit the unique constraint → silent rollback → **un-voting was impossible**.

Added `getViewerCommentVotes()` + `collectCommentIds()` to `packages/shared/src/project-detail.ts`, threaded a `votedCommentIds: Set<string>` through the detail page → `Comments` → `CommentItem`.

**Verified live:** upvoted → full reload → came back already-upvoted → un-voted successfully (`comment_votes` 1 → 0 in DB).

### A3b — real bug the plan didn't anticipate ✅
PostgREST reports most failures as `{ error }`, but a **transport-level** failure (offline/DNS/CORS) *rejects* instead. That exception escaped the handlers entirely: no rollback, no message, and `setPending(false)` never ran — leaving the button **permanently disabled showing a vote the server never recorded**.

Wrapped all 6 mutation sites in try/catch so both failure shapes reach the rollback: `vote-button`, `bookmark-button`, `follow-button`, comment vote, comment submit, reply submit.

**Verified:** forced a network failure, captured exact toast text `"Couldn't save your upvote. Check your connection and try again."` with `aria-pressed` back to `false` and the button not stuck. Typecheck passed both before *and* after the fix — this was only findable by running it.

### A5 — silent truncation 🟡
Server was `.slice()`ing displayName/headline/bio/location/timezone/college with no client counter — a 400-char bio lost 120 chars with no warning.

- New `packages/shared/src/profile-limits.ts` — one source of truth for both the form and the action (they previously disagreed silently).
- `maxLength` on every capped field + new `components/ui/field-counter.tsx` (appears only within 20 of the cap, red at zero).

**Verified live (complete):** `maxLength=280` / `=80` present in the live DOM — that's the part that actually prevents the loss — **and** the counter at threshold: typed 66 real characters into Display name (cap 80) and the counter appeared reading `14 left`. The earlier "keyboard input would not reach the page via automation" was the hidden-tab artifact, not an automation limit; typing works normally once the tab is foreground.

---

## 4. ✅ RESOLVED — A7 profile-save confirmation

**Symptom was:** saving the profile showed no confirmation toast, though the save itself worked.

**What it actually was:** *not* the Server Action revalidation theory below. Every previous verification ran in a **hidden** automation tab, where `requestAnimationFrame` never fires, so React never revealed the page's Suspense boundary and the settings segment never hydrated. An unhydrated `<form action={formAction}>` falls back to its progressive-enhancement **native POST** — a full page navigation. That destroys the whole JS context, which is why the toast never appeared *and* why no amount of restructuring helped: module scope, context state, and `?saved=1` all die the same death in a document replacement. The three "defeated approaches" below were defeated by this, not by revalidation. Full mechanism in `PROJECT_INFO.md`'s gotchas.

**Verified live on a production build** (`next build` + `next start`), tab foregrounded:
- form and submit button both carry React fiber keys (genuinely hydrated)
- clicking Save fires **no** navigation (`pagehide` never fires)
- the toast region gains one child reading **"Profile saved."**, and it is visible on screen with its check icon and dismiss button
- the button correctly passes through its `Saving…` pending state

**The module-store rewrite of `components/ui/toast.tsx` is kept.** It was never proven necessary — but it is how real toast libraries work, it is strictly more robust than the context provider under remounts, and it is now verified working end to end. The old "one regression test failed after the rewrite" note was the confounded `fetch`-patch test plus this same hidden-tab artifact; the toast layer is fine.

**Also changed as part of A7:** saving now **stays on `/settings/profile`** instead of redirecting to your public profile. This is a deliberate UX change (matches GitHub/Linear) and is independently good — keep it regardless of how the toast is resolved. `actions.ts` returns `{ savedUsername }` instead of calling `redirect()`. `saved-toast.tsx` was deleted.

**Also part of A7, unchanged and still wanted:** saving now **stays on `/settings/profile`** instead of redirecting to the public profile (`actions.ts` returns `{ savedUsername }`; `saved-toast.tsx` was deleted). Keep it — it matches GitHub/Linear and confirms fields the profile page doesn't render.

### What's left here
Nothing. A4 and A6 were the last two, and both are now verified live (below).

---

## 4b. A4 + A6 — verified live

Both were "implemented, not verified" since the hidden-tab artifact blocked verification. Done now against `next dev`, tab foregrounded.

**A6 — composer unsaved-changes guard.** Verified by dispatching a *synthetic* cancelable `beforeunload` and reading `defaultPrevented` — never a real one, because a native unload prompt is a modal that freezes browser automation dead. Three states, all correct:

| Form state | `defaultPrevented` |
|---|---|
| clean (untouched `/new`) | `false` |
| dirty (typed a title) | **`true`** |
| reverted (title cleared again) | `false` |

The third row is the one worth having: it proves the signature-comparison approach in the code comment actually works — undoing an edit genuinely stops counting as dirty, rather than latching a boolean forever. The title input carried React fiber keys, so this was a hydrated form, not the native-POST fallback.

**A4 — onboarding dead-end.** The trap only exists when `initial.username === null`, so it needs a genuinely un-onboarded account: `profiles.username` was temporarily set to `null` for `tushar_solodev`, then restored (verified back to 5/5 profiles with usernames, 0 null; `/u/tushar_solodev` renders). `window.fetch` was patched to reject Supabase requests, reproducing the network blip.

With the check failing (4 requests blocked): the message **"Couldn't check availability — you can still continue."** renders with a **"Check again"** control, and — the actual fix — **`submitDisabled: false`**. That is the bug closed: this screen previously greyed out its only button permanently, with no message and no retry, recoverable only by reload. Unblocking `fetch` and clicking "Check again" re-ran the real request and recovered to "Available." with submit still enabled.

**Do not click "Create my profile" while running this fixture** — it would claim a handle for real. Observing `disabled` is the whole assertion; submitting is not needed.

---

## 5. Tranche B — only one item done

- ✅ **B1** `prefers-reduced-motion` block added to `globals.css` (was zero coverage; skeletons pulsed on every navigation).

Not started: B2 transitions, B3 focus-visible on 6 `outline-none` inputs, B4 shadow tokens, B5 radius dedupe (31 literals duplicating existing tokens), B6 `--color-text-tertiary` contrast fix (4.42:1, fails AA).

**Do not remove the `tw-animate-css` import** in `globals.css` — one audit called it dead; it is not, `ui/dialog.tsx` uses its classes.

---

## 6. Environment notes

- Dev server: `pnpm --filter web dev`. It does **not** always die with the task wrapper — check `netstat -ano | grep :3000` and `taskkill //F //PID <pid>` before restarting, or it silently starts on :3001.
- **A stale `.next` 404s every dynamic route** (`/u/*`, `/p/*`, `/badge/*`, `/embed/*`) while `/`, `/leaderboard`, `/search` stay 200 — this cost real time during the A4 run and looked exactly like a Phase 7 regression. `rm -rf apps/web/.next` and restart before debugging any dev-only breakage. Full write-up in `PROJECT_INFO.md`'s gotchas.
- ~~Browser automation could not deliver **keyboard input** to this app (values never changed).~~ **Wrong — this was the hidden-tab artifact.** Typing works normally once the tab is foreground; `element.click()` via JS is still more reliable than coordinate clicks. Foreground the tab (take a screenshot) as the *first* step of any browser verification, and sanity-check `document.visibilityState` if a page seems stuck on its skeleton.
- The recurring `cz-shortcut-listen` hydration error in console is a **browser extension (ColorZilla)**, not an app bug. Pre-existing.
- Test data: 3 projects, 7 comments, 5 profiles. `p6_alice/p6-alice-proj` has 4 comments — good for comment testing.
