# Phase 8 — Collaboration ("Looking for") — Design

Date: 2026-08-11 · Status: approved, pending spec review
Source of intent: [NEW_FEATURES.md](../../../NEW_FEATURES.md) §Phase 8 ·
Tracker: [NEW_FEATURES_TODO.md](../../../NEW_FEATURES_TODO.md) §3

## Problem

CoBuild is named for collaboration and is currently one-way: you post finished work
and other people look at it. Devpost, Dribbble and Product Hunt are all pure showcases,
so a working collaboration layer is the product's only defensible difference.

Two supporting facts shape the design:

1. `profiles.open_to_collab` and `profiles.weekly_hours_available` already exist in the
   live schema and are populated by the seed, but **nothing reads or writes them**. The
   data model for availability is half-built.
2. `project_collaborators` and the `notify_on_credit` trigger already exist. What is
   missing is the front door — a way for someone who is not already credited to ask.

## Decisions taken

| # | Decision | Choice | Consequence |
|---|---|---|---|
| D-A | `looking_for` storage | `projects.looking_for text[]` + CHECK, partial GIN index | No join added to `feed_page` or `search_projects` |
| D-B | Accepted collaborator rights | **Credit only** | **Zero changes to any existing RLS policy** |
| D-C | "not looking" representation | Empty array | No `nothing` sentinel to keep in sync |
| D-D | Request history | `withdrawn` is a status; no DELETE policy | History survives; withdraw is not a delete |

D-B was reconsidered mid-design. An owner-chooses-per-collaborator edit tier was designed
and then dropped in favour of the simpler option. The investigation is kept below because
it corrected two wrong assumptions in `NEW_FEATURES.md`, and those corrections stand
whether or not edit rights are ever built.

### Corrections to NEW_FEATURES.md's stated gotchas

`NEW_FEATURES.md` (open decision #2) claims edit rights would require re-keying the
`{userId}/{projectId}/…` storage prefix and updating the orphan-cleanup function. Both
were checked against the live database and both are **false**:

- **Storage needs no re-keying.** The `project-media` policies scope writes to
  `(storage.foldername(name))[1] = auth.uid()`. A co-editor uploading to
  `{theirUserId}/{projectId}/{uuid}.webp` writes under their *own* prefix, which the
  existing INSERT policy already permits.
- **`orphaned_project_media()` needs no change.** It does not derive ownership from the
  prefix. It filters on `array_length(storage.foldername(o.name), 1) = 2` and then
  matches `project_images.storage_path` / `projects.cover_image_path` exactly. A
  co-editor's upload satisfies both and is never reported as an orphan.

The real cost of edit rights is narrower than documented: one new
`private.can_edit_project()` helper swapped into the write policies of `projects`,
`project_images` and `project_tags`, with `projects` DELETE and all of
`project_collaborators` deliberately left on `is_project_author` as the
privilege-escalation guard. Recorded here so a future phase can cost it correctly.

## Architecture

Three independently shippable slices, in order. Each is one commit with its own
verification gate.

### 8.0 — Availability signals · no migration

The cheapest possible start: both columns already exist, and
`profiles_guard_client_columns()` was confirmed live **not** to pin either one, so they
are genuinely client-writable.

- `ProfileSummary` and `PROFILE_COLUMNS` (`packages/shared/src/profiles.ts`) gain
  `open_to_collab: boolean` and `weekly_hours_available: number | null`.
- `/settings/profile`: a checkbox and a number input. Hours are nullable and clamped to
  1–80; a blank input stores `null`, not `0`, because "open to collaborate, unspecified
  hours" is a real state and `0` reads as "no availability".
- `/u/[username]`: one chip — `Open to collaborate · ~10 hrs/week`, with the hours
  clause omitted when null. Nothing renders when `open_to_collab` is false.

Interface: no new module. Both values ride the existing `ProfileSummary` that every
profile surface already receives.

### 8.1 — `looking_for` on projects

Vocabulary, fixed: `co-builder` · `feedback` · `beta-testers` · `designer`. This is
product policy rather than user data, which is why it is a CHECK constraint and not a
table the way user-created tags are.

```sql
alter table projects add column looking_for text[] not null default '{}';

alter table projects add constraint projects_looking_for_valid
  check (looking_for <@ array['co-builder','feedback','beta-testers','designer']);

create index projects_looking_for_idx on projects
  using gin (looking_for) where visibility = 'public';
```

- `looking_for` is author-writable, so `projects_guard_client_columns()` is **not**
  extended. It stays the guard for counters and `author_id` only.
- `projectDraftSchema` gains `lookingFor: z.array(z.enum(LOOKING_FOR_OPTIONS))`,
  defaulting to `[]`. The vocabulary is exported from `project-schema.ts` alongside
  `PROJECT_STATUSES`, matching the existing pattern.
- Composer: a checkbox group in `/new` and `/p/[username]/[slug]/edit`.
- Render: a chip on `ProjectCard` and on the detail page.
- `feed_page` gains `p_looking_for text[] default null`, applied as
  `and (p_looking_for is null or looking_for && p_looking_for)`.
- `search_projects` gains the same parameter as a facet, alongside the existing status
  and tag facets.

**Why the cursor is safe.** `p_looking_for` is a pure filter. It does not enter the
`(hot_score, published_at, id)` sort tuple, does not change what the cursor encodes, and
does not introduce a float into the paging key. This is the opposite of the Phase 4 bug,
which was caused by a float *in the cursor*. Pagination is still re-verified — but the
claim being verified is "an added predicate did not change paging", not "a new sort
order paginates correctly".

**Seed.** `packages/db/src/seed/seed.ts` assigns `looking_for` to a realistic minority of
projects (most real projects want nothing), so the facet is judgeable on the existing 83
seeded rows rather than needing a throwaway fixture. This follows the prerequisite
reasoning in `NEW_FEATURES.md`: a discovery surface that cannot be evaluated on real data
has not really been verified.

**Index honesty.** The partial GIN index serves the facet filter. Ordering for Hot / New
/ Top is still driven by the btree feed indexes aligned in Phase 7
(`align_feed_indexes_with_keyset_order`). At 83 rows the planner may well ignore the GIN
index entirely; it is there for the shape of the query, not for a measured win at
current scale. Do not claim a speedup that has not been measured.

### 8.2 — Request to join

The first path in the app where a stranger writes a row that a project owner reads.

```sql
create table collab_requests (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  message      text not null check (char_length(message) between 1 and 500),
  status       text not null default 'pending'
               check (status in ('pending','accepted','declined','withdrawn')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index collab_requests_one_pending
  on collab_requests (project_id, requester_id) where status = 'pending';
```

The partial unique index is what stops one person opening N requests against the same
project. It is partial on purpose: a declined request must not block a later, better one.

**RLS.**

| Command | Rule |
|---|---|
| SELECT | `requester_id = auth.uid()` OR `private.is_project_author(project_id)` |
| INSERT | `requester_id = auth.uid()` AND `status = 'pending'` AND `private.can_see_project(project_id)` AND NOT `private.is_project_author(project_id)` |
| UPDATE | USING and WITH CHECK both `requester_id = auth.uid()` OR `private.is_project_author(project_id)`, narrowed further by the guard trigger below |
| DELETE | **no policy** — withdrawal is a status change, so the record survives |

Reusing `can_see_project` rather than writing a fresh visibility test means a request
cannot be sent to a draft the requester cannot see. Excluding the author stops a
self-request creating a self-credit.

**Guard trigger.** Postgres RLS cannot express an old→new status transition, so
`collab_requests_guard()` (BEFORE UPDATE) does it:

- pins `id`, `project_id`, `requester_id`, `message`, `created_at` to their old values
- sets `updated_at := now()`
- allows exactly `pending → withdrawn` when `auth.uid() = requester_id`
- allows exactly `pending → accepted | declined` when the caller is the project author
- rejects every other transition, so a declined request cannot be reopened

**Rate limit, in the database.** `collab_requests_rate_limit()` (BEFORE INSERT) rejects
an insert when the requester already has more than 10 requests in the trailing 24 hours.
This lives in the DB rather than the UI because the UI is not the only client of
PostgREST.

**Function grants.** Both trigger functions get `revoke all on function … from public`
**and** `… from anon, authenticated`. Phase 5 and Phase 7 each shipped a function
callable over PostgREST and both were caught by `get_advisors`, not by review — so
advisors runs immediately after this migration, not at the end of the phase.

**Notifications.** `notifications.type`'s CHECK currently allows
`upvote | comment | reply | follow | credit` and must be widened with
`collab_request | collab_accepted | collab_declined`. No new column is needed:
`recipient_id`, `actor_id` and `project_id` carry everything the notification list needs
to render and link. Notification rows are written by SECURITY DEFINER triggers, matching
`notify_on_vote` / `notify_on_comment` / `notify_on_follow` / `notify_on_credit`;
direct INSERT stays GRANT-blocked for `anon` and `authenticated`.

**Accepting.** The owner accepting a request inserts a `project_collaborators` row with
`status = 'accepted'` and the requester's `profile_id`. That row already surfaces the
project on the collaborator's profile through the Phase 2 contributions tab, and already
fires `notify_on_credit`. Credit only: **no** edit rights, and no existing policy changes.

**UI.**

- Detail page: a "Request to join" button, shown when `looking_for` is non-empty, the
  viewer is signed in, the viewer is not the author, and no pending request exists.
  Signed-out visitors get the same sign-in gate the vote and bookmark buttons use.
- A dialog with a 500-character pitch, using the existing shadcn `Dialog` — the same
  component the delete-confirmation flow uses, not `window.confirm`.
- `/notifications`: accept and decline inline on a `collab_request` item.
- Requester sees their own pending request state on the project detail page, and can
  withdraw it.

**Data layer.** A new `packages/shared/src/collab.ts`, sized like the existing modules
(the largest in that package is 222 lines): create a request, list requests for a
project, list a viewer's own requests, withdraw, accept, decline. Each is one exported
function with an explicit return type, following `profiles.ts` and `feed.ts`.

## Error handling

- A duplicate pending request violates `collab_requests_one_pending` and returns Postgres
  `23505`. The action maps it to "You already have a request pending on this project."
  rather than surfacing a constraint name — the same treatment `updateProfile` gives the
  username collision.
- The rate-limit trigger raises. The action maps it to a plain "You've sent a lot of
  requests today — try again tomorrow."
- Every mutation site wraps the call in `try`/`catch`. Phase 6's tranche B established
  that a transport-level failure *rejects* rather than returning `{ error }`, which left
  buttons stuck disabled showing state the server never recorded.

## Testing strategy

Per slice, before the commit:

1. `turbo run typecheck` (4/4) and `pnpm --filter web build` clean.
2. `get_advisors` (security **and** performance) immediately after each migration,
   compared against the documented intentional baseline.
3. Browser verification **in a visible tab on a production build**. A hidden automation
   tab never fires `requestAnimationFrame`, so React never reveals the Suspense boundary,
   the page never hydrates, and forms fall back to a native POST — which looks exactly
   like a real application bug.

For 8.1 specifically: a dup/skip scan across pages with the facet applied and unapplied.

For 8.2 specifically, adversarial RLS with real JWTs from both sides:

- a third party can read neither side of a request
- `anon` cannot insert
- inserting with someone else's `requester_id` is blocked
- requesting to join a project you cannot see is blocked
- requesting to join your own project is blocked
- a requester cannot set `status = 'accepted'` on their own request
- an owner cannot edit the `message`
- `declined → accepted` is rejected
- the 11th request in 24 hours is rejected
- a second pending request against the same project is rejected, but a new request after
  a decline succeeds

## Out of scope

- Moderation queue behind `reports` — backlog, and explicitly not a blocker for this phase.
- Collaborator-initiated invites: the owner already has co-builder search from Phase 3.
- Any change to `hot_score` or ranking.
- Edit rights for collaborators (D-B). The cost analysis above is retained for a future phase.

## Order of work

`8.0` → `8.1` → `8.2`, one commit each, checkpoint after each. Evidence mirrored into
`CHECKLIST.md` and the slice ticked in `NEW_FEATURES_TODO.md` as it lands.
