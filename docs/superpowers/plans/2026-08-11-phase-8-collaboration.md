# Phase 8 — Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn CoBuild from a one-way showcase into a collaboration surface — projects declare what help they want, profiles declare availability, and strangers can ask to join.

**Architecture:** Three additive slices on the existing schema. 8.0 wires up two profile columns that already exist. 8.1 adds one `text[]` column to `projects` and threads it through the existing `feed_page` / `search_projects` RPCs as a pure filter. 8.2 adds one new table (`collab_requests`) with RLS, two guard triggers, a notification trigger, and an atomic accept RPC. **Credit-only: no existing RLS policy is modified anywhere in this plan.**

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), TypeScript, Supabase Postgres 17 (RLS, plpgsql triggers, PostgREST RPCs), Zod, Tailwind + shadcn, pnpm/Turborepo monorepo.

**Spec:** [`docs/superpowers/specs/2026-08-11-phase-8-collaboration-design.md`](../specs/2026-08-11-phase-8-collaboration-design.md)
**Branch:** `phase-8-collaboration` (already created, spec already committed)
**Supabase project id:** `mwxokedrwjlyrqcwvdur`

---

## How "test-first" works in this repo

**This repo has no JS test runner.** No vitest, no jest, no `test` script — verified across the whole workspace. Do not add one; that is a separate decision, not a side effect of this plan.

Phases 0–7 verified work with a different and genuinely effective loop, and this plan follows it:

| Layer | Red-green mechanism |
|---|---|
| SQL / RLS / triggers | An assertion query run via `execute_sql` **before** the migration (fails: relation/column does not exist) and again after (passes). Adversarial checks use `set local role` + `request.jwt.claims` to simulate real users. |
| TypeScript | `pnpm --filter <pkg> typecheck` — red before the type exists, green after. |
| App behaviour | `pnpm --filter web build`, then live browser verification. |

Every task below states its own red step and its own green step. **A step that says "expect FAIL" must actually be run and actually fail before you implement.** If it passes early, something is already in the database and you must stop and investigate rather than proceeding.

## Global Constraints

- **Never modify an existing RLS policy.** This phase is additive. If you find yourself editing `projects_update_own`, `project_images_*`, `project_tags_*` or `project_collaborators_*`, stop — that is the edit-rights feature, which was explicitly cut.
- **Every new function gets both revokes**, in the same migration that creates it:
  `revoke all on function public.<fn>(<args>) from public;` **and** `revoke all on function public.<fn>(<args>) from anon, authenticated;`
  Revoking from `anon, authenticated` alone leaves the default `PUBLIC` EXECUTE grant intact — that was a real live security hole in Phase 5, and a repeat in Phase 7.
- **Run `get_advisors` (security *and* performance) immediately after every migration**, not at the end of the phase. Both prior holes were caught by advisors, not by review.
- **Adding a parameter to an existing Postgres function creates an overload, it does not replace it.** PostgREST then cannot resolve the call. Every RPC signature change in this plan must `drop function` with the full old argument list first, in the same migration.
- **Trigger-maintained columns are read-only to the app**: `upvote_count`, `comment_count`, `bookmark_count`, `view_count`, `hot_score`, `search_tsv`, `project_count`, `follower_count`, `following_count`, `total_upvotes_received`, `tags.follower_count`, `tags.usage_count`.
- **`looking_for` is author-writable.** Do **not** add it to `projects_guard_client_columns()`.
- **Browser verification runs in a visible tab against a production build** (`pnpm --filter web build && pnpm --filter web start`). A hidden/backgrounded automation tab never fires `requestAnimationFrame`, so React never reveals the Suspense boundary, the page never hydrates, and forms fall back to a native POST. This has already cost this project a multi-day false bug hunt.
- **If dynamic routes 404 while `/` and `/search` return 200**, the cause is a stale `apps/web/.next`. Delete it and restart before debugging anything else. The tell is the dev server logging `application-code: 12ms` for a page whose first act is a Supabase round-trip.
- **`apps/web/AGENTS.md` applies**: this is Next.js 16 and its APIs differ from older versions. Read the relevant guide under `apps/web/node_modules/next/dist/docs/` before writing route or server-action code.
- **Vocabulary, exact strings, used everywhere:** `co-builder`, `feedback`, `beta-testers`, `designer`. Empty array means "not looking" — there is no `nothing` value.
- Commit at the end of each task. Do not batch commits.

---

### Task 1: Availability signals on profiles (slice 8.0)

No migration. `profiles.open_to_collab` (boolean, not null, default false) and `profiles.weekly_hours_available` (integer, nullable) already exist and are populated by the seed, and `profiles_guard_client_columns()` was confirmed live **not** to pin either — it pins only `id`, the four counters, and `created_at`. They are genuinely client-writable.

**Files:**
- Modify: `packages/shared/src/profiles.ts` (the `ProfileSummary` type at :11 and `PROFILE_COLUMNS` at :33)
- Modify: `packages/shared/src/profile-limits.ts` (add the hours bounds)
- Modify: `packages/shared/src/index.ts` (export the new constants)
- Modify: `apps/web/src/app/(app)/settings/profile/settings-form.tsx`
- Modify: `apps/web/src/app/(app)/settings/profile/actions.ts` (the update payload at :82-97)
- Modify: `apps/web/src/app/(app)/u/[username]/page.tsx`

**Interfaces:**
- Produces: `ProfileSummary.open_to_collab: boolean`, `ProfileSummary.weekly_hours_available: number | null`, and `WEEKLY_HOURS_MIN = 1` / `WEEKLY_HOURS_MAX = 80` exported from `@cobuild/shared`. Task 10 does not depend on these; nothing else in this plan does either.

- [ ] **Step 1: Confirm the columns really are unpinned (red-adjacent baseline)**

Run via `execute_sql` on project `mwxokedrwjlyrqcwvdur`:

```sql
select pg_get_functiondef(p.oid) like '%open_to_collab%' as pins_collab,
       pg_get_functiondef(p.oid) like '%weekly_hours%'   as pins_hours
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'profiles_guard_client_columns';
```

Expected: `pins_collab = false`, `pins_hours = false`. If either is true, stop — the guard would silently discard writes and the whole task is built on a false premise.

- [ ] **Step 2: Add the bounds constants**

In `packages/shared/src/profile-limits.ts`, append:

```ts
/**
 * Bounds for `profiles.weekly_hours_available`. Null means "open to
 * collaborate, hours unspecified" — a real and common state — so a blank
 * input must store null, never 0. Zero would render as "~0 hrs/week",
 * which reads as the opposite of being available.
 */
export const WEEKLY_HOURS_MIN = 1;
export const WEEKLY_HOURS_MAX = 80;
```

- [ ] **Step 3: Widen `ProfileSummary` and `PROFILE_COLUMNS`**

In `packages/shared/src/profiles.ts`, add to the `ProfileSummary` type after `timezone`:

```ts
  open_to_collab: boolean;
  weekly_hours_available: number | null;
```

and replace `PROFILE_COLUMNS` with:

```ts
const PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, bio, headline, github_username, roles, is_student, college, grad_year, location, timezone, open_to_collab, weekly_hours_available, links, follower_count, following_count, project_count, total_upvotes_received, created_at";
```

- [ ] **Step 4: Export the constants**

In `packages/shared/src/index.ts`, extend the `profile-limits` export block:

```ts
export {
  DISPLAY_NAME_MAX,
  HEADLINE_MAX,
  BIO_MAX,
  LOCATION_MAX,
  TIMEZONE_MAX,
  COLLEGE_MAX,
  WEEKLY_HOURS_MIN,
  WEEKLY_HOURS_MAX,
} from "./profile-limits";
```

- [ ] **Step 5: Run typecheck — expect FAIL**

Run: `pnpm --filter @cobuild/shared typecheck`
Expected: PASS for shared, but `pnpm --filter web typecheck` may still pass too — the new fields are additive. This step's real purpose is confirming the shared package compiles with the widened type before touching the app.

- [ ] **Step 6: Persist the fields in the settings action**

In `apps/web/src/app/(app)/settings/profile/actions.ts`, import the bounds:

```ts
import {
  validateUsername,
  usernameIsTaken,
  DISPLAY_NAME_MAX,
  HEADLINE_MAX,
  BIO_MAX,
  LOCATION_MAX,
  TIMEZONE_MAX,
  COLLEGE_MAX,
  WEEKLY_HOURS_MIN,
  WEEKLY_HOURS_MAX,
} from "@cobuild/shared";
```

After the `isStudent` block (around :70), add:

```ts
  const openToCollab = formData.get("openToCollab") === "on";
  const hoursRaw = String(formData.get("weeklyHours") ?? "").trim();
  const hoursParsed = hoursRaw ? Number.parseInt(hoursRaw, 10) : Number.NaN;
  // Blank, unparseable, or out-of-range all collapse to null rather than
  // erroring: this is a soft signal on a settings form, not a gate.
  const weeklyHours =
    Number.isFinite(hoursParsed) &&
    hoursParsed >= WEEKLY_HOURS_MIN &&
    hoursParsed <= WEEKLY_HOURS_MAX
      ? hoursParsed
      : null;
```

Then add to the `.update({...})` payload, after `timezone: timezone || null,`:

```ts
      open_to_collab: openToCollab,
      // Hours without the toggle on would render nowhere and confuse a later
      // read; clear them when the user closes availability.
      weekly_hours_available: openToCollab ? weeklyHours : null,
```

- [ ] **Step 7: Add the form controls**

Read `apps/web/src/app/(app)/settings/profile/settings-form.tsx` first and match its existing field markup exactly — it already has a student toggle with a conditionally-revealed college/grad-year pair, which is the same shape as this. Reuse `components/ui/switch.tsx` if the student toggle uses it, or a plain checkbox if it does not.

Add a section after the student block:

```tsx
<div className="space-y-3">
  <label className="flex items-center gap-3">
    <input
      type="checkbox"
      name="openToCollab"
      defaultChecked={profile.open_to_collab}
      onChange={(e) => setOpenToCollab(e.currentTarget.checked)}
    />
    <span>Open to collaborate</span>
  </label>
  {openToCollab && (
    <div>
      <Label htmlFor="weeklyHours">Hours available per week</Label>
      <Input
        id="weeklyHours"
        name="weeklyHours"
        type="number"
        min={WEEKLY_HOURS_MIN}
        max={WEEKLY_HOURS_MAX}
        defaultValue={profile.weekly_hours_available ?? ""}
        placeholder="Optional"
      />
    </div>
  )}
</div>
```

Wire `openToCollab` into the component's existing `useState` pattern, mirroring how `isStudent` is handled.

**Do not** add these fields to the `beforeunload` dirty-check signature by hand — check how that guard builds its signature and extend it the same way, or the guard will report a clean form as dirty.

- [ ] **Step 8: Render the chip on the profile**

In `apps/web/src/app/(app)/u/[username]/page.tsx`, near the existing student badge / role chips, add:

```tsx
{profile.open_to_collab && (
  <span className="...matching the existing chip classes...">
    Open to collaborate
    {profile.weekly_hours_available
      ? ` · ~${profile.weekly_hours_available} hrs/week`
      : ""}
  </span>
)}
```

Use `pill`/`chip` from `apps/web/src/components/ui/control-classes.ts` — Phase 6 tranche B lifted those exact class strings there specifically so new chips do not re-hardcode them.

- [ ] **Step 9: Typecheck and build — expect PASS**

```bash
pnpm turbo run typecheck
pnpm --filter web build
```

Expected: typecheck 4/4 clean, build clean.

- [ ] **Step 10: Verify live in a visible browser tab**

Start a production build (`pnpm --filter web start`), sign in, go to `/settings/profile`. Set the toggle on with 10 hours, save. Expected: success toast appears, redirect to profile, chip reads `Open to collaborate · ~10 hrs/week`. Reload — value persists. Then clear the hours, save: chip reads `Open to collaborate` with no hours clause. Then toggle off, save: chip disappears and `weekly_hours_available` is null in the DB.

Confirm with:

```sql
select open_to_collab, weekly_hours_available from public.profiles where username = '<your handle>';
```

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/profiles.ts packages/shared/src/profile-limits.ts packages/shared/src/index.ts "apps/web/src/app/(app)/settings/profile/actions.ts" "apps/web/src/app/(app)/settings/profile/settings-form.tsx" "apps/web/src/app/(app)/u/[username]/page.tsx"
git commit -m "feat(profile): surface open_to_collab and weekly_hours_available

Both columns have been in the schema and populated by the seed since
Phase 0 with nothing reading or writing them. No migration needed:
profiles_guard_client_columns() was confirmed live not to pin either.

Blank hours store null, not 0 — 'open to collaborate, hours
unspecified' is a real state and 0 reads as the opposite."
```

---

### Task 2: `looking_for` migration (slice 8.1)

**Files:**
- Migration only (applied via `apply_migration`, name `add_projects_looking_for`)

**Interfaces:**
- Produces: `projects.looking_for text[] not null default '{}'`, constrained to the four-value vocabulary; index `projects_looking_for_idx`. Tasks 3–6 all depend on this column existing.

- [ ] **Step 1: Write the assertion and run it — expect FAIL**

```sql
select count(*) as ok
from information_schema.columns
where table_schema = 'public' and table_name = 'projects' and column_name = 'looking_for';
```

Expected: `ok = 0`. This is the red state.

- [ ] **Step 2: Apply the migration**

`apply_migration`, name `add_projects_looking_for`:

```sql
alter table public.projects
  add column looking_for text[] not null default '{}';

-- Fixed vocabulary is product policy, not user data, which is why this is a
-- CHECK and not a lookup table the way user-created tags are. `<@` also
-- rejects duplicates-with-unknowns and empty-string members in one test.
alter table public.projects
  add constraint projects_looking_for_valid
  check (looking_for <@ array['co-builder','feedback','beta-testers','designer']::text[]);

-- Partial GIN, matching the listing filter (`visibility = 'public'`) that
-- every feed and search branch already applies.
create index projects_looking_for_idx
  on public.projects using gin (looking_for)
  where visibility = 'public';
```

- [ ] **Step 3: Re-run the assertion — expect PASS**

Re-run Step 1's query. Expected: `ok = 1`.

- [ ] **Step 4: Prove the CHECK actually rejects garbage**

```sql
do $$
begin
  begin
    update public.projects set looking_for = array['nonsense'] where id = (select id from public.projects limit 1);
    raise exception 'FAIL: CHECK did not reject an unknown value';
  exception when check_violation then
    raise notice 'PASS: unknown value rejected';
  end;
end $$;
```

Expected: `PASS` notice, no exception escaping.

- [ ] **Step 5: Confirm the default applied to every existing row**

```sql
select count(*) filter (where looking_for is null) as nulls,
       count(*) filter (where looking_for = '{}')  as empties,
       count(*) as total
from public.projects;
```

Expected: `nulls = 0`, `empties = total`.

- [ ] **Step 6: Run advisors**

Run `get_advisors` with `type: "security"` and again with `type: "performance"`. Expected: no new entries beyond the documented intentional baseline (RLS-enabled-no-policy on the leaderboard snapshot table; SECURITY DEFINER RPCs as the sole read path to the ungranted MV; the unused-index INFO for `tags_name_trgm_idx`; the Auth leaked-password WARN). A brand-new unused-index INFO for `projects_looking_for_idx` is expected and correct at this point — nothing filters on it yet.

- [ ] **Step 7: Commit**

There is nothing in the working tree (migrations are applied through the MCP server, and `supabase/migrations/` is empty in this repo). Record the migration in the tracker instead:

```bash
# no-op commit step — migration lives in the remote project.
# Note the migration name in NEW_FEATURES_TODO.md's session log at the end of Task 6.
```

---

### Task 3: Thread `looking_for` through the shared data layer (slice 8.1)

**Files:**
- Modify: `packages/shared/src/project-schema.ts`
- Modify: `packages/shared/src/projects.ts` (the `row` object at :121-138)
- Modify: `packages/shared/src/feed.ts` (`FeedItem` at :30, `FeedRpcRow` at :51, `toItem` at :67, `getFeedPage` at :133)
- Modify: `packages/shared/src/search.ts` (`SearchProjectHit` at :16, `searchProjects` at :70)
- Modify: `packages/shared/src/project-detail.ts` (the `ProjectDetail` type and its select list)
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/db/src/database.types.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: `projects.looking_for` from Task 2.
- Produces:
  - `LOOKING_FOR_OPTIONS: readonly ["co-builder","feedback","beta-testers","designer"]`
  - `LOOKING_FOR_LABELS: Record<LookingFor, string>`
  - `type LookingFor`
  - `parseLookingFor(input: readonly string[]): LookingFor[]`
  - `ProjectDraft.lookingFor: LookingFor[]`
  - `FeedItem.looking_for: string[]`, `SearchProjectHit.looking_for: string[]`, `ProjectDetail.looking_for: string[]`
  - `getFeedPage(client, { ..., lookingFor?: readonly string[] | null })`
  - `searchProjects(client, { ..., lookingFor?: readonly string[] })`

  Tasks 4, 5 and 9 all consume these exact names.

- [ ] **Step 1: Regenerate DB types**

Run `generate_typescript_types` for project `mwxokedrwjlyrqcwvdur` and write the result to `packages/db/src/database.types.ts`. Do not hand-edit it.

- [ ] **Step 2: Add the vocabulary to `project-schema.ts`**

After the `PROJECT_VISIBILITIES` line:

```ts
/**
 * What a project is asking for. Fixed vocabulary enforced by a CHECK on
 * `projects.looking_for` — keep this array and that constraint in sync.
 *
 * There is deliberately no "nothing" member: an empty array *is* "not
 * looking", and a sentinel would be a second representation of the same
 * state for the two to drift apart on.
 */
export const LOOKING_FOR_OPTIONS = [
  "co-builder",
  "feedback",
  "beta-testers",
  "designer",
] as const;

export type LookingFor = (typeof LOOKING_FOR_OPTIONS)[number];

export const LOOKING_FOR_LABELS: Record<LookingFor, string> = {
  "co-builder": "Co-builder",
  feedback: "Feedback",
  "beta-testers": "Beta testers",
  designer: "Designer",
};

/** Narrows arbitrary URL or form input down to real vocabulary values. */
export function parseLookingFor(input: readonly string[]): LookingFor[] {
  const allowed = new Set<string>(LOOKING_FOR_OPTIONS);
  return [...new Set(input.filter((v) => allowed.has(v)))] as LookingFor[];
}
```

Add to `projectDraftSchema`, after `tagIds`:

```ts
  lookingFor: z.array(z.enum(LOOKING_FOR_OPTIONS)).default([]),
```

- [ ] **Step 3: Persist it in `saveProject`**

In `packages/shared/src/projects.ts`, add to the `row` object after `visibility: draft.visibility,`:

```ts
    looking_for: draft.lookingFor,
```

`looking_for` is author-writable, so unlike the counters it belongs in this payload. Do not touch `projects_guard_client_columns()`.

- [ ] **Step 4: Thread it through `feed.ts`**

Add `looking_for: string[];` to both `FeedItem` (after `hot_score`) and `FeedRpcRow`. Add to `toItem`:

```ts
    looking_for: row.looking_for ?? [],
```

Extend the `getFeedPage` options type with `lookingFor?: readonly string[] | null;` and add to the `.rpc("feed_page", {...})` payload:

```ts
    p_looking_for: opts.lookingFor?.length ? [...opts.lookingFor] : undefined,
```

Add this to `getFeedPage`'s doc comment, above `@param opts.viewerId`:

```
 * @param opts.lookingFor Restricts the page to projects asking for at least
 *   one of these. A pure filter: it does not enter the sort tuple, does not
 *   change what the cursor encodes, and introduces no float into the paging
 *   key — so the `FeedCursor` contract is unchanged by it.
```

- [ ] **Step 5: Thread it through `search.ts`**

Add `looking_for: string[];` to `SearchProjectHit`. Extend `searchProjects`' options with `lookingFor?: readonly string[];`, add before the `.rpc` call:

```ts
  const lookingFor = opts.lookingFor?.length ? [...opts.lookingFor] : undefined;
```

add `p_looking_for: lookingFor,` to the RPC payload, and `looking_for: r.looking_for ?? [],` to the mapped result.

- [ ] **Step 6: Thread it through `project-detail.ts`**

Add `looking_for: string[];` to the `ProjectDetail` type and add `looking_for` to that module's project select column list.

- [ ] **Step 7: Export everything**

In `packages/shared/src/index.ts`, extend the `project-schema` export block with `LOOKING_FOR_OPTIONS`, `LOOKING_FOR_LABELS`, `parseLookingFor`, and add `LookingFor` to its `export type` line.

- [ ] **Step 8: Typecheck — expect FAIL, then fix**

Run: `pnpm turbo run typecheck`
Expected: FAIL in `apps/web` — the composer builds a `ProjectDraft` literal and now lacks `lookingFor`. That failure is the point: it lists every call site Task 4 must update. Note them, then proceed to Task 4 rather than papering over them with `as` casts.

- [ ] **Step 9: Commit** (after Task 4 makes typecheck green — these two tasks share one commit boundary; commit at Task 4 Step 6)

---

### Task 4: Composer UI for `looking_for` (slice 8.1)

**Files:**
- Modify: `apps/web/src/components/project/composer.tsx`
- Modify: `apps/web/src/app/(app)/p/[username]/[slug]/edit/page.tsx` (the `initial` prop at :33-57)

**Interfaces:**
- Consumes: `LOOKING_FOR_OPTIONS`, `LOOKING_FOR_LABELS`, `LookingFor` from Task 3.

- [ ] **Step 1: Read the composer first**

Read `apps/web/src/components/project/composer.tsx` in full before editing. It is the largest client component in the app and owns the whole draft state machine plus the `beforeunload` dirty guard. Find: the state shape, where `tagIds` is held, how the draft object is assembled for `saveProject`, and how the dirty-check signature is computed.

- [ ] **Step 2: Add state and the control group**

Add state alongside the existing tag state:

```tsx
const [lookingFor, setLookingFor] = useState<LookingFor[]>(initial?.lookingFor ?? []);
```

Add the control group near the tags field:

```tsx
<fieldset className="space-y-2">
  <legend className="...matching sibling legends...">Looking for</legend>
  <p className="...matching sibling help text...">
    Optional. Shows a chip on your project and lets people filter for it.
  </p>
  <div className="flex flex-wrap gap-2">
    {LOOKING_FOR_OPTIONS.map((option) => {
      const active = lookingFor.includes(option);
      return (
        <button
          key={option}
          type="button"
          aria-pressed={active}
          onClick={() =>
            setLookingFor((prev) =>
              prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option],
            )
          }
          className={/* chip classes from components/ui/control-classes.ts, active variant when `active` */}
        >
          {LOOKING_FOR_LABELS[option]}
        </button>
      );
    })}
  </div>
</fieldset>
```

Use `aria-pressed` on a `<button type="button">` rather than styled checkboxes — this is a toggle group, and `type="button"` is required or each chip submits the form.

- [ ] **Step 3: Include it in the saved draft**

Add `lookingFor,` to the object passed to `saveProject`.

- [ ] **Step 4: Include it in the dirty-check signature**

Extend the `beforeunload` signature the same way the other array fields are included. Verify by loading the edit page, toggling a chip, and toggling it back — the guard must **not** fire after a revert. Phase 6 verified this exact behaviour for the existing fields; a latching guard is the failure mode to watch for.

- [ ] **Step 5: Pass the initial value from the edit page**

In `apps/web/src/app/(app)/p/[username]/[slug]/edit/page.tsx`, add to the `initial` object after `tags: project.tags,`:

```tsx
        lookingFor: parseLookingFor(project.looking_for),
```

and import `parseLookingFor` from `@cobuild/shared`. Parsing rather than casting matters: the DB CHECK could gain a value this client predates, and `parseLookingFor` drops unknowns instead of rendering a chip with no label.

- [ ] **Step 6: Typecheck, build, verify live, commit**

```bash
pnpm turbo run typecheck
pnpm --filter web build
```

Both must be clean. Then in a visible browser tab on a production build: create a project, select `Co-builder` and `Feedback`, save, reopen the edit page — both chips must come back selected. Confirm in SQL:

```sql
select title, looking_for from public.projects where id = '<the project id>';
```

Expected: `{co-builder,feedback}`.

```bash
git add packages/shared/src packages/db/src/database.types.ts apps/web/src/components/project/composer.tsx "apps/web/src/app/(app)/p/[username]/[slug]/edit/page.tsx"
git commit -m "feat(projects): looking_for vocabulary, schema, and composer

projects.looking_for is a text[] with a CHECK-enforced four-value
vocabulary. Empty array means 'not looking' — no sentinel value, so
there is only one representation of that state.

Author-writable, so deliberately NOT added to
projects_guard_client_columns()."
```

---

### Task 5: `looking_for` filter in feed and search RPCs (slice 8.1)

**Files:**
- Two migrations: `feed_page_looking_for` and `search_projects_looking_for`

**Interfaces:**
- Consumes: `projects.looking_for` (Task 2), the client-side params added in Task 3.
- Produces: `feed_page(..., p_looking_for text[])` and `search_projects(..., p_looking_for text[])`.

**Critical:** adding a defaulted parameter to an existing function creates a **second overload**, and PostgREST cannot then resolve the call. Each migration must `drop function` with the exact old signature first.

- [ ] **Step 1: Assert the current signature — this is the red state**

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('feed_page','search_projects')
order by p.proname;
```

Expected: exactly two rows, neither containing `p_looking_for`. Record the exact arg lists — you need them for the DROP.

- [ ] **Step 2: Apply `feed_page_looking_for`**

Take the current body from `pg_get_functiondef` (do not retype it from memory), and apply it with the drop, the new parameter, and the new predicate added to **all four** tab branches:

```sql
drop function if exists public.feed_page(text, integer, text, uuid, integer, timestamp with time zone, uuid, text);

create or replace function public.feed_page(
  p_tab text,
  p_limit integer default 21,
  p_window text default 'all',
  p_viewer uuid default null,
  p_cur_num integer default null,
  p_cur_ts timestamp with time zone default null,
  p_cur_id uuid default null,
  p_tag text default null,
  p_looking_for text[] default null
)
returns table(id uuid, slug text, title text, tagline text, cover_image_path text,
              status text, upvote_count integer, comment_count integer,
              view_count integer, published_at timestamp with time zone,
              hot_score double precision, looking_for text[], author jsonb, tags jsonb)
language plpgsql stable set search_path to ''
as $function$
-- ... body unchanged from the current definition, except:
--   (a) each of the four branches gains, alongside the existing tag predicate:
--         and (p_looking_for is null
--              or array_length(p_looking_for, 1) is null
--              or p.looking_for && p_looking_for)
--   (b) the final hydration SELECT gains `p.looking_for,` immediately
--       before the `jsonb_build_object('username', ...)` author column,
--       matching the new RETURNS TABLE column order.
$function$;
```

Write the body out in full when applying — the comment above is an instruction to you, not something to paste.

The `array_length(...) is null` clause matters: PostgREST sends an empty array as `{}`, not null, and `looking_for && '{}'` is false for every row, which would silently empty the feed instead of not filtering.

- [ ] **Step 3: Assert the filter works — expect PASS**

```sql
-- Seed a known row first.
update public.projects set looking_for = array['designer']
 where id = (select id from public.projects
              where visibility = 'public' and published_at is not null
              order by published_at desc limit 1)
returning id, title;

-- Filtered: only that project.
select count(*) as designer_rows
  from public.feed_page('new', 51, 'all', null, null, null, null, null, array['designer']);

-- Unfiltered: the full public set.
select count(*) as all_rows
  from public.feed_page('new', 51, 'all', null, null, null, null, null, null);

-- Empty array must behave as "no filter", not "match nothing".
select count(*) as empty_array_rows
  from public.feed_page('new', 51, 'all', null, null, null, null, null, array[]::text[]);
```

Expected: `designer_rows = 1`; `all_rows` = the seeded public count (51 cap, so expect 51 given 78 public projects); `empty_array_rows = all_rows`.

- [ ] **Step 4: Apply `search_projects_looking_for`**

```sql
drop function if exists public.search_projects(text, text[], text[], integer);
```

Then recreate it from its current definition with `p_looking_for text[] default null` as the final parameter, `looking_for text[]` added to `RETURNS TABLE` (immediately before `author`), `h.looking_for,` added to the final select list in the matching position, and this predicate added to the `hits` CTE alongside the existing `p_tags` one:

```sql
       and (p_looking_for is null or array_length(p_looking_for, 1) is null
            or p.looking_for && p_looking_for)
```

- [ ] **Step 5: Assert search filtering — expect PASS**

```sql
select count(*) as hits
  from public.search_projects('a', null, null, 60, array['designer']);
select count(*) as unfiltered
  from public.search_projects('a', null, null, 60, null);
```

Expected: `hits <= unfiltered`, and `hits` counts only projects carrying `designer`. Spot-check by listing titles.

- [ ] **Step 6: Verify the keyset cursor still paginates cleanly**

This is the non-negotiable check. Phase 4's pagination bug was found by testing, not by reading.

```sql
-- Walk every page of Hot with a small page size, collecting ids, then
-- assert no duplicates and no gaps against the full ordered set.
do $$
declare
  v_cur_num integer := null;
  v_cur_ts  timestamptz := null;
  v_cur_id  uuid := null;
  v_ids     uuid[] := '{}';
  v_page    record;
  v_rows    integer;
  v_pages   integer := 0;
begin
  loop
    v_rows := 0;
    for v_page in
      select * from public.feed_page('hot', 6, 'all', null, v_cur_num, v_cur_ts, v_cur_id, null, null)
    loop
      v_ids := v_ids || v_page.id;
      v_cur_num := v_page.upvote_count;
      v_cur_ts  := v_page.published_at;
      v_cur_id  := v_page.id;
      v_rows := v_rows + 1;
    end loop;
    v_pages := v_pages + 1;
    exit when v_rows < 6 or v_pages > 200;
  end loop;

  raise notice 'pages=% collected=% distinct=%',
    v_pages, array_length(v_ids, 1), (select count(distinct x) from unnest(v_ids) x);

  if array_length(v_ids, 1) <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'FAIL: duplicate rows across pages';
  end if;
  if array_length(v_ids, 1) <> (select count(*) from public.projects
                                 where visibility = 'public' and published_at is not null) then
    raise exception 'FAIL: page walk collected % of % rows',
      array_length(v_ids, 1),
      (select count(*) from public.projects where visibility='public' and published_at is not null);
  end if;
  raise notice 'PASS: no duplicates, no skips';
end $$;
```

Expected: `PASS` notice. Then run the identical block with `array['designer']` as the final `feed_page` argument and the row-count assertion changed to count only projects carrying `designer`. Both must pass.

- [ ] **Step 7: Advisors, then commit the regenerated types**

Run `get_advisors` for both types. Then regenerate DB types (the RPC return shapes changed) and commit:

```bash
git add packages/db/src/database.types.ts packages/shared/src
git commit -m "feat(feed,search): looking_for facet on feed_page and search_projects

Both functions were dropped and recreated rather than replaced: adding a
defaulted parameter creates an overload PostgREST cannot resolve.

The filter is a pure predicate — it does not enter the (hot_score,
published_at, id) sort tuple and adds no float to the paging key, so the
FeedCursor contract is unchanged. Verified anyway with a full page walk,
filtered and unfiltered: no duplicates, no skips.

An empty array is treated as no filter; PostgREST sends {} rather than
null, and `looking_for && '{}'` would have silently emptied the feed."
```

---

### Task 6: Feed filter UI, card chips, and seed (slice 8.1)

**Files:**
- Modify: `apps/web/src/components/project/project-card.tsx`
- Modify: `apps/web/src/app/(app)/p/[username]/[slug]/page.tsx`
- Modify: `apps/web/src/app/(app)/page.tsx` (read `?looking_for=`, pass to `getFeedPage`)
- Modify: `apps/web/src/app/(app)/feed-tabs.tsx` (or a sibling — put the filter chips wherever the tab row lives)
- Modify: `apps/web/src/app/(app)/search/page.tsx` (facet chips)
- Modify: `packages/db/src/seed/seed.ts`
- Modify: `NEW_FEATURES_TODO.md`, `CHECKLIST.md`

- [ ] **Step 1: Render the chip on `ProjectCard`**

Read `apps/web/src/components/project/project-card.tsx` first — it is a Server Component with client islands, and the whole point of that split is that a feed page ships one card's worth of JS rather than one per card. **The chip must stay in the server part**; it is static text with no interactivity.

```tsx
{item.looking_for.length > 0 && (
  <span className={/* chip classes */}>
    Looking for {item.looking_for.map((v) => LOOKING_FOR_LABELS[v as LookingFor] ?? v).join(", ")}
  </span>
)}
```

- [ ] **Step 2: Render it on the project detail page**

Same treatment in `apps/web/src/app/(app)/p/[username]/[slug]/page.tsx`, near the status chip.

- [ ] **Step 3: Wire the feed filter**

In `apps/web/src/app/(app)/page.tsx`, read the param and pass it down:

```tsx
const lookingFor = parseLookingFor(
  typeof sp.looking_for === "string" ? [sp.looking_for] : (sp.looking_for ?? []),
);
```

Pass `lookingFor` into `getFeedPage`. Handle the `string[]` case explicitly — Next can pass either, and Phase 2 already shipped a bug from an `as Tab` cast that assumed a bare string.

**The cursor must reset when the filter changes.** The filter chips are links that set `?looking_for=` and drop any existing `?cursor=`; a cursor from an unfiltered page is meaningless against a filtered set. Verify by paginating, then applying a filter — the first filtered page must start at the top.

Add the chips as links (not client state) so the whole feed stays a Server Component, matching how `?tab=` and `?window=` already work.

- [ ] **Step 4: Add the search facet**

In `apps/web/src/app/(app)/search/page.tsx`, add a `looking_for` facet row alongside the existing status and tag facets, and pass `lookingFor` into `searchProjects`. Follow the existing facet chip markup exactly.

- [ ] **Step 5: Seed the field**

In `packages/db/src/seed/seed.ts`, assign `looking_for` to a realistic minority of projects. Most real projects want nothing, so weight it that way — roughly one in three, with one or two values each:

```ts
// Most projects aren't asking for anything; a facet that matches 80% of
// the corpus tells a browser nothing. Keep this sparse on purpose.
const LOOKING_FOR_POOL = ["co-builder", "feedback", "beta-testers", "designer"] as const;
const lookingFor =
  rng() < 0.34
    ? [...new Set([LOOKING_FOR_POOL[Math.floor(rng() * LOOKING_FOR_POOL.length)]])]
    : [];
```

Match the seed's existing deterministic-RNG helper rather than calling `Math.random` — the seed is idempotent by design and must stay reproducible. Read the file to find the helper's actual name before writing this.

- [ ] **Step 6: Re-run the seed and verify the distribution**

```bash
pnpm seed
```

```sql
select coalesce(nullif(array_to_string(looking_for, ','), ''), '(none)') as asks, count(*)
from public.projects group by 1 order by 2 desc;
```

Expected: a `(none)` majority and a spread across all four values.

- [ ] **Step 7: Typecheck, build, verify live**

```bash
pnpm turbo run typecheck
pnpm --filter web build
```

In a visible browser tab on a production build: the feed shows "Looking for …" chips on the seeded projects; clicking a filter chip narrows the feed and every visible card carries that value; "load more" works within the filtered set; clearing the filter restores the full feed; the same facet works on `/search`.

- [ ] **Step 8: Update the tracker and commit**

Tick the 8.0 and 8.1 items in `NEW_FEATURES_TODO.md` §3, record both migration names (`add_projects_looking_for`, `feed_page_looking_for`, `search_projects_looking_for`) and the verification evidence in `CHECKLIST.md` under a new `### Phase 8 — Collaboration` heading, and add a session-log line.

```bash
git add apps/web/src packages/db/src/seed/seed.ts NEW_FEATURES_TODO.md CHECKLIST.md
git commit -m "feat(feed,search): looking_for chips, filter, and seed data

Chips render in ProjectCard's server part — the card's client islands
exist so a feed page ships one card's worth of JS, and a static chip
must not move it.

Filter chips are links that drop any existing cursor: a cursor from an
unfiltered page has no meaning against a filtered set.

Seeded sparse (~1 in 3) on purpose — a facet matching most of the corpus
tells a browser nothing."
```

---

### Task 7: `collab_requests` migration (slice 8.2)

**Files:**
- One migration, name `add_collab_requests`

**Interfaces:**
- Produces: table `public.collab_requests`, RPC `public.accept_collab_request(uuid, text)`, notification types `collab_request` and `collab_declined`.

**Note on acceptance notifications:** accepting inserts a `project_collaborators` row, which already fires `notify_on_credit` and sends the requester a `credit` notification. Adding a separate `collab_accepted` type would double-notify, so this plan adds **only** `collab_request` and `collab_declined`. The spec listed three types; this is a deliberate narrowing and must be noted in the spec when the phase closes.

- [ ] **Step 1: Assert the table does not exist — red state**

```sql
select count(*) as ok from information_schema.tables
where table_schema = 'public' and table_name = 'collab_requests';
```

Expected: `0`.

- [ ] **Step 2: Apply the migration**

`apply_migration`, name `add_collab_requests`:

```sql
create table public.collab_requests (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  message      text not null check (char_length(message) between 1 and 500),
  status       text not null default 'pending'
               check (status in ('pending','accepted','declined','withdrawn')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Partial on purpose: one *pending* request per person per project, but a
-- decline must not permanently block a later, better-argued request.
create unique index collab_requests_one_pending
  on public.collab_requests (project_id, requester_id) where status = 'pending';

create index collab_requests_project_idx   on public.collab_requests (project_id, created_at desc);
create index collab_requests_requester_idx on public.collab_requests (requester_id, created_at desc);

alter table public.collab_requests enable row level security;

-- DELETE is withheld at the GRANT level, which is stronger than RLS:
-- withdrawal is a status change, so the record survives.
revoke all on table public.collab_requests from anon, authenticated;
grant select, insert, update on table public.collab_requests to authenticated;

create policy collab_requests_select on public.collab_requests
  for select to authenticated
  using (requester_id = (select auth.uid()) or private.is_project_author(project_id));

create policy collab_requests_insert on public.collab_requests
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    -- Reuses the visibility helper so a request cannot be aimed at a draft
    -- the requester cannot see.
    and private.can_see_project(project_id)
    -- Requesting to join your own project would mint a self-credit.
    and not private.is_project_author(project_id)
  );

create policy collab_requests_update on public.collab_requests
  for update to authenticated
  using (requester_id = (select auth.uid()) or private.is_project_author(project_id))
  with check (requester_id = (select auth.uid()) or private.is_project_author(project_id));

-- RLS cannot express an old->new status transition, so the guard does it.
create or replace function public.collab_requests_guard()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;

  new.id           := old.id;
  new.project_id   := old.project_id;
  new.requester_id := old.requester_id;
  new.message      := old.message;
  new.created_at   := old.created_at;
  new.updated_at   := now();

  if new.status = old.status then return new; end if;

  if old.status <> 'pending' then
    raise exception 'collab_requests: % is final and cannot be changed', old.status
      using errcode = '22023';
  end if;

  if new.status = 'withdrawn' then
    if v_uid is distinct from old.requester_id then
      raise exception 'collab_requests: only the requester can withdraw'
        using errcode = '42501';
    end if;
  elsif new.status in ('accepted', 'declined') then
    if not private.is_project_author(old.project_id) then
      raise exception 'collab_requests: only the project author can % a request', new.status
        using errcode = '42501';
    end if;
  else
    raise exception 'collab_requests: illegal transition % -> %', old.status, new.status
      using errcode = '22023';
  end if;

  return new;
end;
$function$;

create trigger collab_requests_guard_trg
  before update on public.collab_requests
  for each row execute function public.collab_requests_guard();

-- Rate limit lives here, not in the UI: the UI is not the only PostgREST client.
create or replace function public.collab_requests_rate_limit()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_recent integer;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;

  select count(*) into v_recent
    from public.collab_requests r
   where r.requester_id = new.requester_id
     and r.created_at > now() - interval '24 hours';

  if v_recent >= 10 then
    raise exception 'collab_requests: too many requests in the last 24 hours'
      using errcode = '53400';
  end if;
  return new;
end;
$function$;

create trigger collab_requests_rate_limit_trg
  before insert on public.collab_requests
  for each row execute function public.collab_requests_rate_limit();

-- Notification types. Acceptance is signalled by the existing `credit`
-- notification that notify_on_credit already fires when the
-- project_collaborators row lands, so there is no collab_accepted type.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('upvote','comment','reply','follow','credit',
                  'collab_request','collab_declined'));

create or replace function public.notify_on_collab_request()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_author uuid;
begin
  select p.author_id into v_author from public.projects p where p.id = new.project_id;
  if v_author is null then return new; end if;

  if tg_op = 'INSERT' then
    if v_author = new.requester_id then return new; end if;
    insert into public.notifications (recipient_id, actor_id, type, project_id)
    values (v_author, new.requester_id, 'collab_request', new.project_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'declined' then
    insert into public.notifications (recipient_id, actor_id, type, project_id)
    values (new.requester_id, v_author, 'collab_declined', new.project_id);
  end if;
  return new;
end;
$function$;

create trigger notify_on_collab_request_trg
  after insert or update on public.collab_requests
  for each row execute function public.notify_on_collab_request();

-- Accept is two writes (status + credit row) and must be atomic: a partial
-- failure would mark a request accepted with no credit behind it.
-- SECURITY INVOKER on purpose — authorization stays with the existing
-- policies (collab_requests_update + the guard, and
-- project_collaborators_insert), rather than being re-implemented here.
create or replace function public.accept_collab_request(
  p_request_id uuid,
  p_role_label text default null
) returns void language plpgsql security invoker set search_path to '' as $function$
declare
  r     public.collab_requests%rowtype;
  v_pos integer;
begin
  select * into r from public.collab_requests where id = p_request_id;
  if not found then
    raise exception 'collab_requests: request not found' using errcode = '42704';
  end if;

  update public.collab_requests set status = 'accepted' where id = p_request_id;

  select coalesce(max(position) + 1, 0) into v_pos
    from public.project_collaborators where project_id = r.project_id;

  insert into public.project_collaborators
    (project_id, profile_id, role_label, status, position)
  values
    (r.project_id, r.requester_id,
     nullif(btrim(coalesce(p_role_label, '')), ''), 'accepted', v_pos)
  on conflict do nothing;
end;
$function$;

revoke all on function public.collab_requests_guard()            from public;
revoke all on function public.collab_requests_guard()            from anon, authenticated;
revoke all on function public.collab_requests_rate_limit()       from public;
revoke all on function public.collab_requests_rate_limit()       from anon, authenticated;
revoke all on function public.notify_on_collab_request()         from public;
revoke all on function public.notify_on_collab_request()         from anon, authenticated;
revoke all on function public.accept_collab_request(uuid, text)  from public;
revoke all on function public.accept_collab_request(uuid, text)  from anon, authenticated;
grant  execute on function public.accept_collab_request(uuid, text) to authenticated;
```

- [ ] **Step 3: Re-run the assertion — expect PASS**

Re-run Step 1's query. Expected: `1`.

- [ ] **Step 4: Prove the trigger functions are not callable over PostgREST**

This is the check that caught real holes in Phases 5 and 7.

```sql
select p.proname,
       has_function_privilege('anon',          p.oid, 'execute') as anon_can,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_can
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('collab_requests_guard','collab_requests_rate_limit',
                    'notify_on_collab_request','accept_collab_request')
order by p.proname;
```

Expected: `false/false` for the three trigger functions; `false/true` for `accept_collab_request` only.

- [ ] **Step 5: Run advisors — expect the documented baseline**

`get_advisors` for `security` and `performance`. Expected: **no new security entries.** If `collab_requests_guard`, `collab_requests_rate_limit` or `notify_on_collab_request` appears, a revoke was missed — fix it in a follow-up migration and re-run before continuing.

- [ ] **Step 6: Record the migration name in the tracker session log** (committed with Task 9)

---

### Task 8: Adversarial RLS verification for `collab_requests` (slice 8.2)

**Files:** none — this task produces evidence, not code.

**Interfaces:** Consumes everything from Task 7.

Run each block via `execute_sql`. Every block must produce its `PASS` notice. Simulate users with `set local role` plus a JWT claim, the same technique Phases 2, 6 and 7 used.

- [ ] **Step 1: Set up two real fixture users and a project**

```sql
-- Pick two seeded profiles and one public project owned by the first.
select p.id as owner_id, p.username as owner, pr.id as project_id, pr.title
  from public.profiles p
  join public.projects pr on pr.author_id = p.id
 where pr.visibility = 'public' and p.username is not null
 limit 1;

select id as stranger_id, username from public.profiles
 where username is not null and id <> '<owner_id>' limit 1;
```

Record `owner_id`, `stranger_id`, `project_id`.

- [ ] **Step 2: A stranger can insert; anon cannot**

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<stranger_id>","role":"authenticated"}';
insert into public.collab_requests (project_id, requester_id, message)
values ('<project_id>', '<stranger_id>', 'I would like to help with the API layer.');
select 'PASS: stranger insert allowed' as result;
rollback;

begin;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
do $$ begin
  begin
    insert into public.collab_requests (project_id, requester_id, message)
    values ('<project_id>', '<stranger_id>', 'anon attempt');
    raise exception 'FAIL: anon insert succeeded';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: anon insert blocked';
  end;
end $$;
rollback;
```

- [ ] **Step 3: Cannot insert on someone else's behalf, or against your own project**

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<stranger_id>","role":"authenticated"}';
do $$ begin
  begin
    insert into public.collab_requests (project_id, requester_id, message)
    values ('<project_id>', '<owner_id>', 'forged requester');
    raise exception 'FAIL: forged requester_id accepted';
  exception when insufficient_privilege then raise notice 'PASS: forged requester_id blocked';
  end;
end $$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<owner_id>","role":"authenticated"}';
do $$ begin
  begin
    insert into public.collab_requests (project_id, requester_id, message)
    values ('<project_id>', '<owner_id>', 'joining my own project');
    raise exception 'FAIL: self-request accepted';
  exception when insufficient_privilege then raise notice 'PASS: self-request blocked';
  end;
end $$;
rollback;
```

- [ ] **Step 4: A third party sees neither side**

Insert a real (committed) request from the stranger, then:

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<third_party_id>","role":"authenticated"}';
select count(*) as visible_to_third_party from public.collab_requests;
rollback;
```

Expected: `0`. Then repeat as `<owner_id>` and `<stranger_id>` — each must see `1`.

- [ ] **Step 5: A requester cannot self-accept; an owner cannot rewrite the message**

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<stranger_id>","role":"authenticated"}';
do $$ begin
  begin
    update public.collab_requests set status = 'accepted' where requester_id = '<stranger_id>';
    raise exception 'FAIL: requester self-accepted';
  exception when insufficient_privilege then raise notice 'PASS: self-accept blocked';
  end;
end $$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<owner_id>","role":"authenticated"}';
update public.collab_requests set message = 'rewritten by owner' where project_id = '<project_id>';
select message from public.collab_requests where project_id = '<project_id>';
rollback;
```

Expected: first block `PASS`; second block returns the **original** message — the guard pinned it.

- [ ] **Step 6: Final statuses are final**

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<owner_id>","role":"authenticated"}';
update public.collab_requests set status = 'declined' where project_id = '<project_id>';
do $$ begin
  begin
    update public.collab_requests set status = 'accepted' where project_id = '<project_id>';
    raise exception 'FAIL: declined -> accepted allowed';
  exception when others then raise notice 'PASS: declined is final';
  end;
end $$;
rollback;
```

- [ ] **Step 7: Duplicate-pending blocked, post-decline retry allowed**

```sql
-- Second pending request must violate collab_requests_one_pending (23505).
-- After a decline, a fresh request must succeed.
```

Write both as `do` blocks in the same shape as above. Expected: `PASS` on both.

- [ ] **Step 8: DELETE is blocked at the grant level**

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<stranger_id>","role":"authenticated"}';
do $$ begin
  begin
    delete from public.collab_requests where requester_id = '<stranger_id>';
    raise exception 'FAIL: delete succeeded';
  exception when insufficient_privilege then raise notice 'PASS: delete blocked at GRANT level';
  end;
end $$;
rollback;
```

- [ ] **Step 9: Rate limit fires on the 11th request in 24h**

Insert 10 requests from one requester against 10 different projects, then attempt an 11th. Expected: the 11th raises `53400`, the first 10 succeed. Roll back.

- [ ] **Step 10: Accept is atomic and credits the requester**

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<owner_id>","role":"authenticated"}';
select public.accept_collab_request('<request_id>', 'Backend');
select status from public.collab_requests where id = '<request_id>';
select count(*) as credit_rows from public.project_collaborators
 where project_id = '<project_id>' and profile_id = '<stranger_id>' and status = 'accepted';
select count(*) as credit_notifs from public.notifications
 where recipient_id = '<stranger_id>' and type = 'credit' and project_id = '<project_id>';
rollback;
```

Expected: status `accepted`, `credit_rows = 1`, `credit_notifs = 1` (from the existing `notify_on_credit`).

Then confirm a **stranger** cannot call it:

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<stranger_id>","role":"authenticated"}';
do $$ begin
  begin
    perform public.accept_collab_request('<request_id>', null);
    raise exception 'FAIL: stranger accepted their own request via RPC';
  exception when others then raise notice 'PASS: RPC accept blocked for non-author';
  end;
end $$;
rollback;
```

- [ ] **Step 11: Clean up and record**

Roll back or delete every fixture row created outside a transaction. Confirm:

```sql
select count(*) as leftover from public.collab_requests;
```

Expected: `0`. Record every `PASS` in `CHECKLIST.md` when Task 10 closes the phase.

---

### Task 9: Collaboration data layer and UI (slice 8.2)

**Files:**
- Create: `packages/shared/src/collab.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/notifications.ts` (`NOTIFICATION_TYPES` at :5, `notificationHref` at :181)
- Create: `apps/web/src/components/project/request-to-join.tsx`
- Create: `apps/web/src/app/(app)/p/[username]/[slug]/collab-actions.ts` (server actions)
- Modify: `apps/web/src/app/(app)/p/[username]/[slug]/page.tsx`
- Modify: `apps/web/src/app/(app)/notifications/page.tsx` and its item component

**Interfaces:**
- Consumes: everything from Task 7.
- Produces:
  ```ts
  export const COLLAB_MESSAGE_MAX = 500;
  export type CollabRequestStatus = "pending" | "accepted" | "declined" | "withdrawn";
  export type CollabRequest = {
    id: string; project_id: string; requester_id: string;
    message: string; status: CollabRequestStatus; created_at: string;
    requester: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  };
  export function createCollabRequest(client, projectId: string, requesterId: string, message: string): Promise<void>;
  export function getViewerCollabRequest(client, projectId: string, viewerId: string): Promise<CollabRequest | null>;
  export function getProjectCollabRequests(client, projectId: string): Promise<CollabRequest[]>;
  export function withdrawCollabRequest(client, requestId: string): Promise<void>;
  export function acceptCollabRequest(client, requestId: string, roleLabel?: string | null): Promise<void>;
  export function declineCollabRequest(client, requestId: string): Promise<void>;
  ```

- [ ] **Step 1: Add the new notification types**

In `packages/shared/src/notifications.ts`:

```ts
export const NOTIFICATION_TYPES = [
  "upvote",
  "comment",
  "reply",
  "follow",
  "credit",
  "collab_request",
  "collab_declined",
] as const;
```

`toItem` already drops unknown types, and `notificationHref` already falls through to the project link for anything that is not `follow` — both new types are project-scoped, so `notificationHref` needs no change. Verify that by reading it rather than assuming.

- [ ] **Step 2: Write `packages/shared/src/collab.ts`**

Follow the conventions of `packages/shared/src/tags.ts` (the closest-sized sibling): a `type Client` alias at the top, one exported function per operation, every function taking the client as its first argument, `if (error) throw error` on every call.

```ts
import type { Database, SupabaseClient } from "@cobuild/db";

type Client = SupabaseClient<Database>;

/** Mirrors the DB CHECK on `collab_requests.message`. */
export const COLLAB_MESSAGE_MAX = 500;

export type CollabRequestStatus = "pending" | "accepted" | "declined" | "withdrawn";

export type CollabRequest = {
  id: string;
  project_id: string;
  requester_id: string;
  message: string;
  status: CollabRequestStatus;
  created_at: string;
  requester: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const SELECT = `
  id, project_id, requester_id, message, status, created_at,
  requester:profiles!collab_requests_requester_id_fkey (username, display_name, avatar_url)
` as const;

/**
 * Sends a request to join. `requesterId` is a value, not an authorization
 * check — `collab_requests_insert` pins it to `auth.uid()`, so a forged id
 * is rejected by the database rather than trusted here.
 *
 * Two failures are expected rather than exceptional and callers should map
 * them to copy: `23505` is an existing pending request (the partial unique
 * index), `53400` is the 24-hour rate limit.
 */
export async function createCollabRequest(
  client: Client,
  projectId: string,
  requesterId: string,
  message: string,
): Promise<void> {
  const { error } = await client
    .from("collab_requests")
    .insert({ project_id: projectId, requester_id: requesterId, message: message.trim() });
  if (error) throw error;
}

/** The viewer's own most recent request against this project, if any. */
export async function getViewerCollabRequest(
  client: Client,
  projectId: string,
  viewerId: string,
): Promise<CollabRequest | null> {
  if (!viewerId) return null;
  const { data, error } = await client
    .from("collab_requests")
    .select(SELECT)
    .eq("project_id", projectId)
    .eq("requester_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CollabRequest | null) ?? null;
}

/** Every request against a project. RLS returns [] unless you are the author. */
export async function getProjectCollabRequests(
  client: Client,
  projectId: string,
): Promise<CollabRequest[]> {
  const { data, error } = await client
    .from("collab_requests")
    .select(SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CollabRequest[];
}

export async function withdrawCollabRequest(client: Client, requestId: string): Promise<void> {
  const { error } = await client
    .from("collab_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId);
  if (error) throw error;
}

/**
 * Accept goes through an RPC because it is two writes — the status change and
 * the `project_collaborators` credit row — and a partial failure would leave a
 * request marked accepted with no credit behind it. The function is
 * SECURITY INVOKER, so the existing policies still authorize both writes.
 */
export async function acceptCollabRequest(
  client: Client,
  requestId: string,
  roleLabel?: string | null,
): Promise<void> {
  const { error } = await client.rpc("accept_collab_request", {
    p_request_id: requestId,
    p_role_label: roleLabel?.trim() || undefined,
  });
  if (error) throw error;
}

export async function declineCollabRequest(client: Client, requestId: string): Promise<void> {
  const { error } = await client
    .from("collab_requests")
    .update({ status: "declined" })
    .eq("id", requestId);
  if (error) throw error;
}
```

- [ ] **Step 3: Export from the package index**

```ts
export {
  COLLAB_MESSAGE_MAX,
  createCollabRequest,
  getViewerCollabRequest,
  getProjectCollabRequests,
  withdrawCollabRequest,
  acceptCollabRequest,
  declineCollabRequest,
} from "./collab";
export type { CollabRequest, CollabRequestStatus } from "./collab";
```

- [ ] **Step 4: Typecheck the shared package — expect PASS**

Run: `pnpm --filter @cobuild/shared typecheck`. If `collab_requests` is unknown to the types, regenerate `packages/db/src/database.types.ts` first.

- [ ] **Step 5: Write the server actions**

Create `apps/web/src/app/(app)/p/[username]/[slug]/collab-actions.ts`. Follow `settings/profile/actions.ts` for shape — `"use server"`, a `{ error?: string; ok?: boolean }` state type, `redirect(LOGIN_PATH)` when unauthenticated, `revalidatePath` on success.

Map the two expected Postgres errors to real copy:

```ts
    if (error.code === "23505") {
      return { error: "You already have a request pending on this project." };
    }
    if (error.code === "53400") {
      return { error: "You've sent a lot of requests today — try again tomorrow." };
    }
    console.error("[collab] request failed", error);
    return { error: "Something went wrong sending your request. Try again." };
```

Wrap every call in `try`/`catch`. Phase 6 established that a transport-level failure *rejects* rather than returning `{ error }`, which previously left buttons stuck disabled showing state the server never recorded.

- [ ] **Step 6: Build the request dialog**

Create `apps/web/src/components/project/request-to-join.tsx` as a client component. Use the real shadcn `Dialog` from `components/ui/dialog.tsx` — the same component the delete-confirmation flow uses, never `window.confirm`. Use `components/ui/textarea.tsx` with `components/ui/field-counter.tsx` for the 500-character limit, matching the composer's fields.

Render states:
- no request → "Request to join" button
- `pending` → "Request sent" plus a "Withdraw" button
- `accepted` → "You're a collaborator"
- `declined` / `withdrawn` → the "Request to join" button again

- [ ] **Step 7: Mount it on the project detail page**

In `apps/web/src/app/(app)/p/[username]/[slug]/page.tsx`, render it only when `project.looking_for.length > 0` and `viewer?.id !== project.author.id`. For signed-out visitors, use the same sign-in gate `VoteButton` and `BookmarkButton` already use — read one of them and follow it rather than inventing a second pattern.

- [ ] **Step 8: Accept/decline in notifications**

In the notifications item component, add cases for `collab_request` (copy: "*{actor}* asked to join **{project}**", with Accept and Decline buttons) and `collab_declined` ("*{actor}* declined your request to join **{project}**", no actions).

The notification row does not carry the request id, so the accept/decline handler must resolve it: look up the pending `collab_requests` row for `(project_id, requester_id) = (notification.project_id, notification.actor_id)`. Add a narrow helper to `collab.ts` for that rather than widening the notifications query — the notifications list runs on every page load of `/notifications` and should not grow a join for two row types.

- [ ] **Step 9: Typecheck and build — expect PASS**

```bash
pnpm turbo run typecheck
pnpm --filter web build
```

- [ ] **Step 10: Verify end-to-end live, in a visible tab, on a production build**

As two real signed-in accounts in separate browser profiles:
1. User B opens User A's project (which must have a non-empty `looking_for`), clicks Request to join, sends a pitch.
2. The button becomes "Request sent" without a reload.
3. User A's nav badge increments; `/notifications` shows the request with Accept/Decline.
4. A clicks Accept. B appears in the project's credits, the project appears on B's profile contributions tab, and B receives a `credit` notification.
5. Repeat with Decline on a second request: B receives a `collab_declined` notification and can request again.
6. B sends a request and withdraws it: the row's status is `withdrawn` and the button returns to "Request to join".

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src apps/web/src packages/db/src/database.types.ts
git commit -m "feat(collab): request-to-join flow, credit-only

New collab_requests table with RLS on both sides, a guard trigger
enforcing status transitions (RLS cannot express old->new), and a
DB-level 24h rate limit — the UI is not the only PostgREST client.

DELETE is withheld at the GRANT level rather than by policy: withdrawal
is a status, so the record survives.

Accept goes through a SECURITY INVOKER RPC so the status change and the
credit row are one transaction, while authorization stays with the
existing policies. Acceptance reuses the credit notification that
notify_on_credit already fires, so there is no collab_accepted type to
double-notify with."
```

---

### Task 10: Phase close — review, docs, tracker

**Files:**
- Modify: `CHECKLIST.md`, `NEW_FEATURES_TODO.md`, `NEW_FEATURES.md`, the spec

- [ ] **Step 1: Full advisors pass**

`get_advisors` for `security` and `performance`. Expected: the documented intentional baseline only. Note whether `projects_looking_for_idx` still reports as unused — after Task 6's seed and filter it should be exercised; if it is genuinely unused at this scale, say so plainly rather than claiming a win.

- [ ] **Step 2: Confirm no existing policy drifted**

```sql
select c.relname, pol.polname, pg_get_expr(pol.polqual, pol.polrelid) as using_expr
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('projects','project_images','project_tags','project_collaborators')
order by c.relname, pol.polname;
```

Expected: identical to the pre-phase state — `projects` on `author_id = auth.uid()`, the three child tables on `private.is_project_author`. This phase is credit-only; any drift here is a bug.

- [ ] **Step 3: Full workspace verification**

```bash
pnpm turbo run typecheck
pnpm --filter web build
```

Expected: typecheck 4/4, build clean. Record the route count.

- [ ] **Step 4: Update the spec's one narrowing**

Edit `docs/superpowers/specs/2026-08-11-phase-8-collaboration-design.md` to record that `collab_accepted` was dropped: acceptance reuses the existing `credit` notification, because inserting the `project_collaborators` row already fires `notify_on_credit` and a separate type would double-notify.

- [ ] **Step 5: Mirror evidence into `CHECKLIST.md`**

Add a `### Phase 8 — Collaboration` section following the style of the Phase 7 section: one ticked line per delivered item, the migration names, the adversarial-RLS results from Task 8, and any bug found by testing rather than reading. Note honestly anything left open.

- [ ] **Step 6: Update `NEW_FEATURES_TODO.md`**

Tick §3's items, mark D-B answered as credit-only in §2, and add a session-log entry in §9.

- [ ] **Step 7: Correct `NEW_FEATURES.md`**

Two edits: mark Phase 8 complete, and fix open decision #2 — record that the storage re-keying and orphan-cleanup costs it warns about were checked against the live database and are false, with the real cost noted for a future edit-rights phase.

- [ ] **Step 8: Commit and open the PR**

```bash
git add CHECKLIST.md NEW_FEATURES_TODO.md NEW_FEATURES.md docs/superpowers/specs
git commit -m "docs: close Phase 8 — collaboration

Records the adversarial RLS evidence, the migration names, and the one
spec narrowing (no collab_accepted type — acceptance reuses the credit
notification rather than double-notifying)."
git push -u origin phase-8-collaboration
```

Then open a PR against `main` summarising the three slices.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: 8.0 → Task 1; 8.1 schema → Task 2; 8.1 shared layer → Task 3; composer → Task 4; feed/search RPCs → Task 5; chips, filter, facet, seed → Task 6; 8.2 schema/RLS/guards/rate-limit/notifications → Task 7; adversarial RLS → Task 8; data layer and UI → Task 9; verification and docs → Task 10. Error handling appears in Task 9 Step 5. The spec's "out of scope" list is enforced by the Global Constraints.

**One deliberate deviation from the spec**, flagged in Task 7 and corrected in the spec at Task 10 Step 4: the spec named three new notification types; this plan adds two. `collab_accepted` is dropped because inserting the `project_collaborators` row already fires `notify_on_credit`, so a third type would double-notify the requester.

**Type consistency.** `LookingFor`, `LOOKING_FOR_OPTIONS`, `LOOKING_FOR_LABELS`, `parseLookingFor` are defined in Task 3 and used under those exact names in Tasks 4 and 6. `CollabRequest` and the six `collab.ts` functions are defined in Task 9's Interfaces block and used under those names in its own steps. `p_looking_for` is the parameter name in both RPCs (Task 5) and matches the `lookingFor` client option (Task 3).

**Known risk, called out rather than hidden.** Task 6 Step 3's cursor-reset requirement is behavioural and has no compile-time enforcement. If the filter chips preserve an existing `?cursor=`, the first filtered page starts mid-feed. It is verified by hand in that step; there is no test to catch a later regression.
