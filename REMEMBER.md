# Session checkpoint — UI/UX pass (Phase 6 follow-on)

Working notes for picking this back up. Companion to [CHECKLIST.md](CHECKLIST.md).
Full plan: `C:\Users\TUSHAR\.claude\plans\joyful-floating-hollerith.md`

**Status: tranche A implemented, partially verified. One open bug (A7). Re-run build before trusting.**

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
| A2 | Toast primitive | ⚠️ rewritten late, **unverified** |
| A3 | Failure toasts + `disabled`/`aria-busy` on 6 mutation sites | ✅ verified *(before A2 rewrite)* |
| A3b | try/catch hardening — **real bug found** | ✅ verified *(before A2 rewrite)* |
| A4 | Onboarding dead-end | ⚠️ implemented, not verified live |
| A5 | Silent truncation | 🟡 partly verified |
| A6 | Composer unsaved-changes guard | ⚠️ implemented, not verified live |
| A7 | Profile-save confirmation | ❌ **not working — open** |

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

**Verified:** `maxLength=280` / `=80` present in the live DOM — that's the part that actually prevents the loss. **Not verified:** the counter appearing at threshold — keyboard input would not reach the page via automation.

---

## 4. ⚠️ OPEN BUG — A7 profile-save confirmation

**Symptom:** saving the profile shows no confirmation toast. The save itself works (DB `updated_at` confirms).

**Root cause found:** a Server Action **revalidates the `(app)` layout**, which remounts anything holding toast state → the toast is queued and then wiped by its own provider remounting, milliseconds later. This defeated three separate approaches:
1. `?saved=1` param + toast on the destination profile page
2. client-side `router.push` after the action returns
3. staying put entirely (no navigation) — *still* fails, because the action itself triggers the revalidation

**Last change (UNVERIFIED, may be wrong):** rewrote `components/ui/toast.tsx` from a React-context provider to a **module-level store** + `useSyncExternalStore`, so a remount re-reads the live queue instead of resetting it. This is how real toast libraries work and is architecturally right — **but it is not verified, and one regression test of the previously-passing comment-vote toast failed after the rewrite** (that test is confounded: the `fetch` patch it relies on is flaky). The Chrome extension disconnected before I could isolate it.

**Also changed as part of A7:** saving now **stays on `/settings/profile`** instead of redirecting to your public profile. This is a deliberate UX change (matches GitHub/Linear) and is independently good — keep it regardless of how the toast is resolved. `actions.ts` returns `{ savedUsername }` instead of calling `redirect()`. `saved-toast.tsx` was deleted.

### Next steps for A7
1. Re-run `pnpm --filter web build` — **the last full build predates the toast store rewrite.**
2. Verify the store works at all: temporarily expose `showToast` on `window`, call it manually, confirm a toast paints. That isolates store+viewport from the calling code.
3. If the store is fine → the settings effect isn't firing; check `state.savedUsername` actually reaches the client.
4. If the store is broken → suspect duplicate module instances across Turbopack chunks; otherwise revert `toast.tsx` to the context-provider version (which was **proven working** for failure toasts) and accept that the settings success toast needs a different mechanism.

---

## 5. Tranche B — only one item done

- ✅ **B1** `prefers-reduced-motion` block added to `globals.css` (was zero coverage; skeletons pulsed on every navigation).

Not started: B2 transitions, B3 focus-visible on 6 `outline-none` inputs, B4 shadow tokens, B5 radius dedupe (31 literals duplicating existing tokens), B6 `--color-text-tertiary` contrast fix (4.42:1, fails AA).

**Do not remove the `tw-animate-css` import** in `globals.css` — one audit called it dead; it is not, `ui/dialog.tsx` uses its classes.

---

## 6. Environment notes

- Dev server: `pnpm --filter web dev`. It does **not** always die with the task wrapper — check `netstat -ano | grep :3000` and `taskkill //F //PID <pid>` before restarting, or it silently starts on :3001.
- Browser automation could not deliver **keyboard input** to this app (values never changed). Clicks work; `element.click()` via JS is more reliable than coordinate clicks.
- The recurring `cz-shortcut-listen` hydration error in console is a **browser extension (ColorZilla)**, not an app bug. Pre-existing.
- Test data: 3 projects, 7 comments, 5 profiles. `p6_alice/p6-alice-proj` has 4 comments — good for comment testing.
