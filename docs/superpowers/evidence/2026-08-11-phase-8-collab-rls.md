# Phase 8 slice 8.2 — adversarial RLS evidence for `collab_requests`

**Gate result: FAILED. Do not ship slice 8.2.**

Date: 2026-08-11 · Task 8 · Supabase project `mwxokedrwjlyrqcwvdur` (live, seeded)
Schema under test: `supabase/migrations/20260811T1430_add_collab_requests.sql`

23 attacks run: **17 blocked as expected, 5 succeeded that must not have, 1 test
defect in my own harness (found and corrected, recorded below).**

All five successes trace to a **single root cause** in Task 7: both new trigger
functions are declared `security definer`, which makes their own role guard always
true, so **neither trigger does anything for any caller**. `collab_requests` is
currently protected only by its RLS policies, its `CHECK` constraint, its partial
unique index, and the withheld `DELETE` grant. The guard trigger and the rate
limiter are inert.

---

## Root cause

`collab_requests_guard()` and `collab_requests_rate_limit()` both open with:

```sql
-- migration lines 50/54 and 95/98
returns trigger language plpgsql security definer set search_path to '' as $function$
...
  if current_user not in ('anon', 'authenticated') then return new; end if;
```

Inside a `security definer` function, `current_user` is the **function owner**, not
the caller. Both functions are owned by `postgres`. So the test reads
`'postgres' not in ('anon','authenticated')` → true → `return new` → the trigger
body never executes, for every caller, on every statement.

Proved directly with two throwaway probe functions created and rolled back inside
one transaction:

```sql
begin;
create function public._probe_secdef_tmp() returns text language sql security definer
  as $fn$ select current_user::text || ' / session=' || session_user::text $fn$;
create function public._probe_invoker_tmp() returns text language sql
  as $fn$ select current_user::text $fn$;
set local role authenticated;
select current_user as outer_current_user,
       public._probe_secdef_tmp() as inside_security_definer,
       public._probe_invoker_tmp() as inside_security_invoker;
rollback;
```

```
outer_current_user | inside_security_definer  | inside_security_invoker
authenticated      | postgres / session=postgres | authenticated
```

This is a property of `security definer` itself, not of the JWT simulation — it
holds identically on the real PostgREST path.

**Scope check — is this pattern used elsewhere?**

```sql
select n.nspname, p.proname, p.prosecdef, pg_get_userbyid(p.proowner) as owner
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public','private') and p.prosrc like '%current_user%'
 order by p.prosecdef desc;
```

```
public | collab_requests_guard             | t | postgres   <-- Phase 8, broken
public | collab_requests_rate_limit        | t | postgres   <-- Phase 8, broken
public | comments_guard_immutable_columns  | f | postgres
public | notifications_guard_client_columns| f | postgres
public | profiles_guard_client_columns     | f | postgres
public | projects_guard_client_columns     | f | postgres
public | tags_guard_client_columns         | f | postgres
```

Every earlier-phase guard uses the same `current_user` idiom but is **security
invoker**, so all five work correctly. Only the two functions added by Task 7 are
`security definer`. **This is a Phase 8 regression, and the blast radius is exactly
`collab_requests`.** No previously shipped table is affected.

**Suggested fix (not applied — Task 7 owns the schema):** drop `security definer`
from both trigger functions. Neither needs it. `collab_requests_guard` only reads
`OLD`/`NEW` and calls `private.is_project_author`, which is itself `security
definer` and so still works. `collab_requests_rate_limit` counts
`where requester_id = new.requester_id`, and the INSERT policy already pins
`requester_id` to `auth.uid()`, so the caller can always see every row that counts —
RLS cannot hide any of them and the count stays complete under invoker rights.
Do **not** "fix" this by swapping in `session_user`: under PostgREST that is
`authenticator`, not `authenticated`, so the guard would then be inert in production
and active only in psql.

---

## Method

Fixtures, all seeded `@seed.cobuild.dev` profiles (no `p6_*`, no real account):

| role | username | uuid |
|---|---|---|
| project author | `frederiquetorphy519` | `82395f09-5eba-497d-8b15-fd3a63fbc382` |
| requester | `anyarutherford755` | `8fb48cd8-80d9-4add-a79f-a4f2e0529f49` |
| uninvolved third party | `oswaldbailey376` | `b25112d4-4468-47b1-9add-eb2498abc8c4` |

Project under test: `8b889472-f7af-4e3b-9da4-cffad2299795` "Kerbside", `public`,
authored by `frederiquetorphy519`. The requester authors **0** projects, so it is a
true stranger. Also used: `aed32d33-9264-4ff0-b226-c32cf771275d` "Alice Secret
Draft" (`draft`, foreign author) and `c7e71f28-8865-4460-bd62-0b894f21fc6d`
"Pantry" (`unlisted`).

**Nothing was committed.** Every block runs inside `begin;` with
`set local role` + `set local request.jwt.claims`, and terminates in
`raise exception 'EVIDENCE ... '` carrying the actual values. That serves two
purposes: MCP `execute_sql` does **not** surface `raise notice`, so the numbers
would otherwise be invisible; and the raise aborts the transaction, which makes it
impossible for a probe to commit. Multi-actor blocks switch identity mid-transaction
with `perform set_config('request.jwt.claims', '...', true)`.

"Blocked" below always quotes the real `SQLSTATE` and message.

---

## Attacks that were blocked correctly (17)

### A3 — anon has no access at all

```sql
begin;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
-- insert, then select, each wrapped in its own exception block
```

```
EVIDENCE A3 anon (current_user=anon)
 | insert: blocked 42501 permission denied for table collab_requests
 | select: blocked 42501 permission denied for table collab_requests
```

Blocked at the GRANT level, before RLS is even consulted.

### A4 — forged `requester_id`, and forced `status` on insert

As the requester, inserting with someone else's `requester_id`, then inserting with
`status = 'accepted'`:

```
EVIDENCE A4 as requester(uid=8fb48cd8-…)
 | forged requester_id: blocked 42501 new row violates row-level security policy for table "collab_requests"
 | forced status=accepted on insert: blocked 42501 new row violates row-level security policy for table "collab_requests"
```

The INSERT `WITH CHECK` pins both columns. A stranger cannot create a
pre-accepted request.

### A5 — an author cannot request to join their own project

```
EVIDENCE A5 author self-request (uid=82395f09-…, is_project_author=t)
 | blocked 42501 new row violates row-level security policy for table "collab_requests"
```

### A6 — cannot request against a project you cannot see

```
EVIDENCE A6 | can_see_project(draft)=f can_see_project(unlisted)=t
 | insert vs draft: blocked 42501 new row violates row-level security policy for table "collab_requests"
 | insert vs unlisted: allowed
```

Unlisted being allowed is correct by design — unlisted is link-shareable and
`can_see_project` returns true for it.

### A7 — read isolation holds

One pending request in the transaction, then three identities counted in turn:

```
EVIDENCE A7 | requester_sees=1 | author_sees=1 | third_party_sees=0
 | third_party_direct_id_lookup=<none> | third_party_update: update affected 0 rows
```

The third party cannot see the row even when given its exact `id`, and their
`UPDATE` matches zero rows. This is the property the whole feature rests on — a
stranger's message is visible to exactly two people — and it is intact.

### A11 — duplicate pending request blocked

```
duplicate pending: blocked 23505 duplicate key value violates unique constraint "collab_requests_one_pending"
```

The partial unique index is enforced independently of the triggers, so it survives
the root-cause bug.

### A10b — arbitrary status values rejected

```
status=banana: blocked 23514 new row for relation "collab_requests" violates check constraint "collab_requests_status_check"
```

The `CHECK` constraint still confines status to the four legal values even with the
guard inert. This is the only reason the broken guard does not permit fully
arbitrary status strings.

### A13 — DELETE and TRUNCATE withheld at the GRANT level

```
EVIDENCE A13 | requester delete: blocked 42501 permission denied for table collab_requests
 | author delete:    blocked 42501 permission denied for table collab_requests
 | truncate:         blocked 42501 permission denied for table collab_requests
```

Neither party can destroy the audit trail. Grants confirm `authenticated` holds only
`SELECT, INSERT, UPDATE`.

### A16 — the accept RPC cannot be abused

```
EVIDENCE A16
 | requester self-accept via RPC: blocked 42501 new row violates row-level security policy for table "project_collaborators"
 | uninvolved third party via RPC: blocked 42704 collab_requests: request not found
```

Worth being precise about *why* each is blocked, because it is not the guard:

- The **requester** gets through the inert guard and does flip status to
  `accepted`, then dies on `project_collaborators`' INSERT policy
  (`private.is_project_author`). Because the RPC is one statement, the whole call
  rolls back and the status flip is undone. The requester is saved by RPC
  atomicity, **not** by the guard — and A8 below shows they can simply skip the RPC.
- The **third party** cannot `SELECT` the row, so the RPC's initial lookup finds
  nothing and raises `42704` before touching anything.

### A18c / A19b — identity and project reassignment still fenced by RLS

```
requester_id -> third party:  blocked 42501 new row violates row-level security policy
author moves request to a foreign project: blocked 42501 new row violates row-level security policy
```

The UPDATE `WITH CHECK` is the last line of defence and it does hold for these two.

---

## Attacks that SUCCEEDED and must not have (5)

All five are the inert guard trigger.

### A8 — a requester can accept and decline their own request  ← most severe

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"8fb48cd8-…","role":"authenticated"}';
insert into public.collab_requests (project_id, requester_id, message)
values ('8b889472-…','8fb48cd8-…','original message from requester');
-- then, as that same requester, three transitions
```

```
EVIDENCE A8 requester-side updates
 | ->accepted:  SUCCEEDED - SECURITY HOLE
 | ->declined:  SUCCEEDED - SECURITY HOLE
 | ->withdrawn: allowed, status now=withdrawn
```

A stranger can mark their own request `accepted` on someone else's project. It
produces no `project_collaborators` row, so it is not a public credit forgery — but
any UI that reads `status` to decide what to show (an "Accepted" badge, a
collaborator inbox, an access decision) is reading an attacker-controlled value.
Only `->withdrawn` should have been permitted here.

### A10 — final statuses are not final

```
EVIDENCE A10 | after_author_decline=declined
 | declined->accepted: SUCCEEDED - status now accepted
 | status=banana: blocked 23514 …
```

`declined -> accepted` is supposed to raise `22023`. Combined with A8, either party
can flip a settled request back and forth indefinitely.

### A14 — the 24h rate limit never fires

10 requests against 10 distinct public projects, then an 11th:

```
EVIDENCE A14 rate limit | first_10_inserted=10
 | 11th attempt: SUCCEEDED - rate limit did NOT fire
 | total_rows_for_requester=11
```

Expected `53400` on the 11th. There is currently **no** server-side throttle on
collab request spam. This is the abuse-prevention control for the one endpoint in
the app where a stranger writes a row into another user's inbox, and it is absent.

### A9 / A19 — the author can rewrite the requester's message

```
EVIDENCE A9 owner rewrite of pinned cols | update_error=no error
 | id_preserved=<NULL> | project_id=<NULL> | requester_id=<NULL> | message=<NULL>
```

The `<NULL>`s are themselves the finding: the row was re-read by its original `id`
and **was not there**, because the author's `UPDATE` successfully changed the
primary key to `00000000-0000-0000-0000-000000000001`. `new.id := old.id` never ran.

Re-run reading the row back properly:

```
EVIDENCE A19 author tampers with request
 | message+created_at rewrite: SUCCEEDED - message now: "I will pay you to do my homework" created_at_moved=true
 | move to foreign project: blocked 42501 …
```

A project author can rewrite the text of a message another user sent them, backdate
it ten years, and change its primary key. The requester still sees the row as their
own. This is the worst of the five for user trust: it fabricates attributed speech.

### A18 — a requester can move their request onto a project they cannot see

```
EVIDENCE A18 requester rewrites pinned cols
 | project_id->unseen draft: SUCCEEDED - request repointed to draft project aed32d33-… (can_see_project=false)
 | message rewrite: SUCCEEDED - message now: message rewritten by the REQUESTER after the fact
 | requester_id->third party: blocked 42501 …
```

`can_see_project` is enforced on INSERT but **not** re-checked on UPDATE, and with
the pinning gone a requester can relocate an accepted-looking request onto any
project by id — including a private draft they have no read access to. The draft's
author then sees a request that was never sent to them, and `notify_on_collab_request`
does not fire on this path so it arrives silently.

---

## Known, accepted gap (not a regression)

### A17 — an author can bypass the RPC and accept without crediting

```
EVIDENCE A17 author direct UPDATE bypassing RPC | status=accepted | credit_rows=0 | credit_notifs=0
```

This one is **by design and must stay**. The guard has to permit
`pending -> accepted` for the project author or the SECURITY INVOKER RPC could not
work at all. The consequence is that an author who calls PostgREST directly can end
up with an accepted request and no `project_collaborators` credit row.

Do not tighten the guard to close this — it would break `accept_collab_request`.
**Mitigation, owned by Task 9: the server action must call the RPC exclusively and
must never issue a bare `update ... set status = 'accepted'`.** Recording it here so
that constraint is not lost.

---

## Positive controls (the feature does work when used correctly)

### A2 — a stranger can lodge a request

```
EVIDENCE A2 | inserted_id=dca8af81-7357-4406-9d56-a1f3ef09adce | status=pending
 | requester_id=8fb48cd8-… | rows_visible_to_requester=1
```

`status` defaults to `pending` as intended.

### A12 — retry after a decline is allowed

```
EVIDENCE A11/A12 | duplicate pending: blocked 23505 …
 | retry after decline: allowed | total_rows_now=2
```

The partial index keys on `status = 'pending'`, so a declined request does not
permanently bar the requester. Correct.

### A15 — the accept RPC is correct and idempotent

```
EVIDENCE A15b | status=accepted | credit_rows=1 | credit_notifs_counted_as_requester=1
 | collab_request_notifs_visible_to_requester=0
```

Status flips, exactly one `project_collaborators` row appears with
`role_label = 'Backend'`, and `notify_on_credit` fires once. A second identical call
is idempotent (`credit_rows` stays 1) — `on conflict do nothing` correctly infers the
partial unique index `project_collaborators_project_profile_uniq`. The trailing `0`
is also correct: the `collab_request` notification is addressed to the author, and
the requester cannot see it under `notifications` RLS.

### Test defect in my own harness — recorded per the "surprises too" rule

My first run of A15 reported `credit_notifs=0` and looked like a missing
notification. It was not. I counted `notifications` while the transaction still
carried the **author's** JWT, and `notifications` RLS scopes reads to
`recipient_id = auth.uid()`, so the requester's credit notification was invisible to
the query rather than absent. Re-running the count after switching claims back to
the requester (A15b above) returned `1`. No product bug — a bug in the test. Noting
it because the same trap will catch the next person who asserts on a notification
from the wrong side of the JWT.

---

## Database left unchanged

Counts captured before the first attack and again after the last:

| table | before | after |
|---|---|---|
| `collab_requests` | 0 | **0** |
| `projects` | 85 | 85 |
| `profiles` | 36 | 36 |
| `project_collaborators` | 4 | 4 |
| `notifications` | 61631 | 61631 |
| leftover `_probe%` functions | 0 | 0 |

No fixture row was ever committed — every block aborted its own transaction — so no
cleanup delete was required. The two probe functions from the root-cause section were
created and rolled back inside a single transaction and are confirmed gone.

Note for the record: the task brief cited 35 profiles; the live count is 36. Nothing
in this run created a profile, and the count is identical before and after.

---

## Verdict

The RLS **policies** are sound. Every read-isolation and identity-forgery attack was
blocked, DELETE is properly withheld, and the accept RPC behaves correctly and
idempotently. The failures are entirely in the two trigger functions, and they are
one word each: `security definer` should not be there.

**Blocking Task 9 until `collab_requests_guard()` and `collab_requests_rate_limit()`
are re-declared security invoker and this suite is re-run.** A8, A9/A19, A10, A14 and
A18 must all flip to blocked.
