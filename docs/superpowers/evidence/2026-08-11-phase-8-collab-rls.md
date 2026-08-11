# Phase 8 slice 8.2 — adversarial RLS evidence for `collab_requests`

**Current gate result: PASS**, against migration `20260811T1450_collab_requests_guard_invoker.sql`
(commit `3729db4`).

**This suite failed the first time it was run, and that failure is the most
important thing in this document.** The original migration
(`20260811T1430_add_collab_requests.sql`) shipped with **both** of its trigger
functions completely inert. It had passed two rounds of code review. The defect was
found only by executing attacks against the live schema. The full record of that
failure is kept below in "Round 1"; do not delete it.

Date: 2026-08-11 · Task 8 · Supabase project `mwxokedrwjlyrqcwvdur` (live, seeded)

Final tally: **23 attacks — 22 blocked as expected, 1 expected success (a known,
accepted gap), 0 surprises.** Plus 9 positive controls and 2 independent
confirmations of the load-bearing consequences of the fix.

---

# Round 1 — what was found (the original migration was broken)

## The defect

`collab_requests_guard()` and `collab_requests_rate_limit()` were both declared
`security definer` and both opened with:

```sql
-- 20260811T1430_add_collab_requests.sql, lines 50/54 and 95/98
returns trigger language plpgsql security definer set search_path to '' as $function$
...
  if current_user not in ('anon', 'authenticated') then return new; end if;
```

Inside a `security definer` function, `current_user` is the function **owner**, not
the caller. Both were owned by `postgres`. So the test read
`'postgres' not in ('anon','authenticated')` → true → `return new`, and **the body
of each trigger never executed, for any caller, on any statement.** Both triggers
were inert. `collab_requests` was protected only by its RLS policies, its `CHECK`
constraint, its partial unique index, and the withheld `DELETE` grant.

Proved directly with two throwaway probe functions, created and rolled back in one
transaction:

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
outer_current_user | inside_security_definer     | inside_security_invoker
authenticated      | postgres / session=postgres | authenticated
```

This is a property of `security definer` itself, not of the JWT simulation — it
holds identically on the real PostgREST path.

## The five holes it opened

| # | Attack | Round 1 result |
|---|---|---|
| A8 | Requester sets **own** request to `accepted` / `declined` | **SUCCEEDED** |
| A9/A19 | Author rewrites the requester's `message`, backdates `created_at`, changes the primary key | **SUCCEEDED** |
| A10 | `declined -> accepted` reopen | **SUCCEEDED** |
| A14 | 11th request in 24h | **SUCCEEDED** — limit never fired |
| A18 | Requester repoints their request onto a project they cannot see | **SUCCEEDED** |

Verbatim output from the failing run:

```
EVIDENCE A8 requester-side updates
 | ->accepted:  SUCCEEDED - SECURITY HOLE
 | ->declined:  SUCCEEDED - SECURITY HOLE
 | ->withdrawn: allowed, status now=withdrawn

EVIDENCE A9 owner rewrite of pinned cols | update_error=no error
 | id_preserved=<NULL> | project_id=<NULL> | requester_id=<NULL> | message=<NULL>

EVIDENCE A10 | after_author_decline=declined
 | declined->accepted: SUCCEEDED - status now accepted

EVIDENCE A14 rate limit | first_10_inserted=10
 | 11th attempt: SUCCEEDED - rate limit did NOT fire | total_rows_for_requester=11

EVIDENCE A18 requester rewrites pinned cols
 | project_id->unseen draft: SUCCEEDED - repointed to draft aed32d33-… (can_see_project=false)
 | message rewrite: SUCCEEDED - message now: message rewritten by the REQUESTER after the fact

EVIDENCE A19 author tampers with request
 | message+created_at rewrite: SUCCEEDED - message now: "I will pay you to do my homework" created_at_moved=true
```

The `<NULL>`s in A9 are themselves the finding: the row was re-read by its original
primary key and **was not there**, because the author's `UPDATE` had successfully
changed `id` to `00000000-0000-0000-0000-000000000001`. `new.id := old.id` never ran.

## Why review missed it and attacks did not

The guard body was, line by line, correct. Every transition rule, every pinned
column, the rate-limit window — all of it read correctly and all of it was correct.
The defect lived in the interaction between two things that are individually
idiomatic in this codebase: the `security definer` modifier, and a
`current_user`-based role check. Five earlier-phase guards in this same repo use
that identical `current_user` idiom and are all correct, because they are
`security invoker`. Reading the new function against the pattern of the old ones
produced a match. Only running it revealed that the pattern had been copied without
its precondition.

The generalisable lesson: **a guard that is never exercised is indistinguishable
from a guard that does not exist**, and code review cannot tell them apart. Every
one of the five holes was found by a block that asserted on an actual value read
back from the database, not by a block that merely completed without error.

## Fix applied

Migration `20260811T1450_collab_requests_guard_invoker.sql` (commit `3729db4`)
recreated both functions with identical bodies, minus `security definer`. Verified
independently in the live database before re-running:

```sql
select n.nspname, p.proname, p.prosecdef, pg_get_userbyid(p.proowner) as owner,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname in ('collab_requests_guard','collab_requests_rate_limit',
                     'is_project_author','can_see_project','accept_collab_request');
```

```
private | can_see_project            | t | postgres | true  | true
private | is_project_author          | t | postgres | true  | true
public  | accept_collab_request      | f | postgres | true  | false
public  | collab_requests_guard      | f | postgres | false | false
public  | collab_requests_rate_limit | f | postgres | false | false
```

Both trigger functions are now `prosecdef = false` with EXECUTE still revoked from
`anon` and `authenticated`. `private.is_project_author` and `private.can_see_project`
correctly **remain** `security definer` — they must, since they read `projects` rows
the caller may not be able to see.

---

# Round 2 — state after the fix

## Method

Fixtures, all seeded `@seed.cobuild.dev` profiles (no `p6_*`, no real account):

| role | username | uuid |
|---|---|---|
| project author | `frederiquetorphy519` | `82395f09-5eba-497d-8b15-fd3a63fbc382` |
| requester | `anyarutherford755` | `8fb48cd8-80d9-4add-a79f-a4f2e0529f49` |
| uninvolved third party | `oswaldbailey376` | `b25112d4-4468-47b1-9add-eb2498abc8c4` |

Project under test: `8b889472-f7af-4e3b-9da4-cffad2299795` "Kerbside", `public`,
authored by `frederiquetorphy519`. The requester authors **0** projects, so it is a
true stranger. Also used: `aed32d33-9264-4ff0-b226-c32cf771275d` "Alice Secret Draft"
(`draft`, foreign author) and `c7e71f28-8865-4460-bd62-0b894f21fc6d` "Pantry"
(`unlisted`).

**Nothing was committed.** Every block runs inside `begin;` with `set local role`
plus `set local request.jwt.claims`, and terminates in
`raise exception 'EVIDENCE ...'` carrying the actual values. That serves two
purposes: MCP `execute_sql` does **not** relay `raise notice`, so the numbers would
otherwise be invisible; and the raise aborts the transaction, making it impossible
for a probe to commit. Multi-actor blocks switch identity mid-transaction with
`perform set_config('request.jwt.claims', '...', true)`.

Where the guard pins a column, the update raises no error — it silently discards the
change. Those blocks therefore **read the column back and compare**, and are reported
as "silently pinned", not "blocked". An assertion that only checked for absence of an
error would have passed in Round 1 too.

## Negative attacks — all 22 blocked

### A3 — anon has no access at all

```
EVIDENCE A3 anon (current_user=anon)
 | insert: blocked 42501 permission denied for table collab_requests
 | select: blocked 42501 permission denied for table collab_requests
```

Blocked at the GRANT level, before RLS is consulted.

### A4 — forged `requester_id`, and forced `status` on insert

```
EVIDENCE A4 as requester(uid=8fb48cd8-…)
 | forged requester_id: blocked 42501 new row violates row-level security policy for table "collab_requests"
 | forced status=accepted on insert: blocked 42501 new row violates row-level security policy for table "collab_requests"
```

A stranger cannot create a pre-accepted request.

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

Unlisted being allowed is correct by design — it is link-shareable and
`can_see_project` returns true for it.

### A7 — read isolation holds

```
EVIDENCE A7 | requester_sees=1 | author_sees=1 | third_party_sees=0
 | third_party_direct_id_lookup=<none> | third_party_update: update affected 0 rows
```

The third party cannot see the row even when handed its exact `id`, and their
`UPDATE` matches zero rows. This is the property the whole feature rests on.

### A8 — a requester cannot accept or decline their own request  ← was hole #1

```
EVIDENCE A8 requester-side updates
 | ->accepted:  blocked 42501 collab_requests: only the project author can accepted a request
 | ->declined:  blocked 42501 collab_requests: only the project author can declined a request
 | ->withdrawn: allowed, status now=withdrawn
```

Now blocked by the guard. `->withdrawn` correctly remains available to the requester.

### A9 — author cannot rewrite pinned columns  ← was hole #2

Author attempts to change `message`, `requester_id`, `project_id`, `created_at` and
the primary key in one statement:

```
EVIDENCE A9 owner rewrite of pinned cols | update_error=no error | row still at original id
 | id_preserved=t | project_id=8b889472-… | requester_id=8fb48cd8-… | message=ORIGINAL MESSAGE
 | created_at_preserved=t | updated_at_bumped=t
```

Every pinned column survived; `updated_at` correctly advanced. Compare against the
Round 1 output above, where this same block reported the row missing from its own
primary key.

### A10 — final statuses are final  ← was hole #3

```
EVIDENCE A10 | after_author_decline=declined
 | declined->accepted: blocked 22023 collab_requests: declined is final and cannot be changed
 | status=banana:      blocked 22023 collab_requests: declined is final and cannot be changed
```

### A11 — duplicate pending, illegal transitions, wrong-actor withdraw

```
EVIDENCE A11/A12
 | duplicate pending:  blocked 23505 duplicate key value violates unique constraint "collab_requests_one_pending"
 | pending->banana:    blocked 22023 collab_requests: illegal transition pending -> banana
 | author->withdrawn:  blocked 22023 collab_requests: declined is final and cannot be changed
 | retry after decline: allowed | total_rows_now=2
```

Note `pending -> banana` is now caught by the guard's `else` branch (`22023`) rather
than by the `CHECK` constraint (`23514`) as in Round 1 — the guard simply reaches it
first. Both layers are present; the constraint remains the backstop.

### A13 — DELETE and TRUNCATE withheld at the GRANT level

```
EVIDENCE A13 | requester delete: blocked 42501 permission denied for table collab_requests
 | author delete:    blocked 42501 permission denied for table collab_requests
 | truncate:         blocked 42501 permission denied for table collab_requests
```

Neither party can destroy the audit trail. `authenticated` holds only
`SELECT, INSERT, UPDATE`.

### A14 — the 24h rate limit fires on the 11th  ← was hole #4

```
EVIDENCE A14 rate limit | first_10_inserted=10 | over_block_check=n/a
 | rows_before_11th=10 | 11th attempt: blocked 53400 collab_requests: too many requests in the last 24 hours
```

The loop was written to abort and report if **any** of the first ten were rejected;
`over_block_check=n/a` means none were. The limit is exactly 10, not 9.

### A16 — the accept RPC cannot be abused

```
EVIDENCE A16
 | requester self-accept via RPC: blocked 42501 collab_requests: only the project author can accepted a request
 | uninvolved third party via RPC: blocked 42704 collab_requests: request not found
```

The requester is now stopped **by the guard**, inside the RPC's own `UPDATE`. In
Round 1 they got past the guard and were stopped one layer later by
`project_collaborators`' INSERT policy — the right outcome for the wrong reason, and
only because the RPC is atomic. The third party still cannot `SELECT` the row, so
the RPC's lookup raises `42704` before touching anything.

### A18 — requester cannot rewrite pinned columns  ← was hole #5

```
EVIDENCE A18 requester rewrites pinned cols
 | project_id->unseen draft: silently pinned, project_id still 8b889472-…
 | message rewrite:          silently pinned, message still "benign opening message"
 | requester_id->third party: silently pinned, requester_id still 8fb48cd8-…
```

The requester can no longer relocate a request onto a project they cannot see.

### A19 — author cannot tamper with the message

```
EVIDENCE A19 author tampers with request
 | message+created_at rewrite: silently pinned, message still "ORIGINAL MESSAGE FROM REQUESTER" created_at_preserved=true
 | move to foreign project:    silently pinned, project_id still 8b889472-…
```

The fabricated-attributed-speech hole is closed.

## The one attack that still succeeds — known, accepted gap

### A17 — an author can bypass the RPC and accept without crediting

```
EVIDENCE A17 author direct UPDATE bypassing RPC | status=accepted | credit_rows=0 | credit_notifs=0
```

**This is by design and must stay.** The guard has to permit `pending -> accepted`
for the project author, or the SECURITY INVOKER `accept_collab_request` RPC could not
function at all. The consequence is that an author who PATCHes
`status='accepted'` directly over PostgREST ends up with an accepted request and no
`project_collaborators` credit row.

Do **not** tighten the guard to close this — it would break accept entirely.
**Mitigation, owned by Task 9: the server action must call `accept_collab_request`
exclusively and must never issue a bare `update ... set status = 'accepted'`.**
Recorded here so the constraint is not lost.

## Independent confirmation of the two load-bearing consequences

These were re-derived from scratch rather than taken on trust, because they are what
dropping `SECURITY DEFINER` actually changes.

### C1 — the rate-limit count sees all of a requester's rows under RLS

The risk: as INVOKER the counting query is now subject to RLS, and an undercount
would silently weaken the limit. Tested in the adversarial direction — nine requests
lodged, then three of those projects flipped to `draft` inside the same transaction
so the requester can no longer see them, then the count re-taken under RLS and
compared against the RLS-bypassed truth:

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"8fb48cd8-…","role":"authenticated"}';
-- lodge 9 requests across 9 distinct public projects
reset role;
update public.projects set visibility='draft'
 where id in (select id from public.projects
               where visibility='public' and author_id<>'8fb48cd8-…' order by id limit 3);
set local role authenticated;
set local request.jwt.claims to '{"sub":"8fb48cd8-…","role":"authenticated"}';
-- capture the rate limiter's own predicate under RLS into a GUC
reset role;
select current_setting('cobuild.rls_count')          as rate_limit_count_under_rls,
       current_setting('cobuild.visible_projects')   as of_which_on_still_visible_projects,
       (select count(*) from public.collab_requests
         where requester_id='8fb48cd8-…')::text      as true_count_rls_bypassed;
rollback;
```

```
rate_limit_count_under_rls | of_which_on_still_visible_projects | true_count_rls_bypassed
9                          | 6                                  | 9
```

**No undercount.** The count stays complete even though a third of the rows sit on
projects the requester can no longer see. Structurally this is guaranteed: the SELECT
policy's first disjunct is `requester_id = (select auth.uid())`, which is exactly the
predicate the rate limiter filters on, and the INSERT policy pins `requester_id` to
`auth.uid()`. Project visibility never enters the calculation.

### C2 — `private.is_project_author` resolves correctly from an INVOKER trigger

```
EVIDENCE C2/P3 is_project_author from INVOKER trigger
 | as_requester=f as_author=t as_third=f | author decline: allowed, status=declined
 | collab_declined notif to requester=1
```

Correct in all three directions. It still works because it is itself
`security definer`, and its internal `(select auth.uid())` reads
`request.jwt.claims`, which is transaction-scoped rather than role-scoped — so the
caller's identity survives the INVOKER hop. The functional proof is the pair A8
(returns false for the non-author, so the accept is refused) and A15/A17 (returns
true for the author, so the accept proceeds); a wrong answer in either direction
would have broken one of them.

## Positive controls — over-blocking check

After a change like this, over-blocking is as real a risk as under-blocking. Nine
legitimate operations, all of which must still succeed:

| # | Operation | Result |
|---|---|---|
| P1 | Stranger lodges a request | allowed, `status=pending` |
| P2 | Requester withdraws own pending request | allowed, `status=withdrawn` |
| P3 | Author declines a pending request | allowed, `status=declined` |
| P4 | `collab_declined` notification reaches the requester | 1 |
| P5 | Requester retries after a decline | allowed |
| P6 | Ten requests in 24h (the limit is 10, not 9) | all 10 allowed |
| P7 | Request against an `unlisted` project | allowed |
| P8 | Author accepts via RPC | `accepted`, `credit_rows=1`, `role_label=Backend`, `credit_notifs=1` |
| P9 | Second identical RPC call | idempotent, `credit_rows` stays 1 |

```
EVIDENCE A2 | inserted_id=a435930d-… | status=pending | requester_id=8fb48cd8-… | rows_visible_to_requester=1

EVIDENCE A15 RPC accept by author | status=accepted | credit_rows=1 | role_label=Backend
 | credit_notifs(as requester)=1 | second call: idempotent, credit_rows now 1
```

P9 confirms `on conflict do nothing` correctly infers the partial unique index
`project_collaborators_project_profile_uniq`.

## Observations that are not security findings

- **Grammar bug in a user-facing error string.** The guard raises
  `'only the project author can % a request'` interpolating `new.status`, which
  produces *"only the project author can accepted a request"* and *"…can declined a
  request"*. Cosmetic, but this message can surface to a client. Interpolating a
  verb form (`accept`/`decline`) rather than `new.status` would fix it.
- **A harness defect of my own, from Round 1, worth recording.** My first A15 run
  reported `credit_notifs=0` and looked like a missing notification. It was not: I
  counted `notifications` while the transaction still held the **author's** JWT, and
  that table's RLS scopes reads to `recipient_id = auth.uid()`, so the requester's
  credit notification was invisible to the query rather than absent. Re-counting as
  the requester returned `1`. No product bug — a bug in the test. The same trap will
  catch the next person who asserts on a notification from the wrong side of a JWT.

---

## Database left unchanged

Counts captured before the first attack of Round 1 and again after the last attack
of Round 2:

| table | before | after |
|---|---|---|
| `collab_requests` | 0 | **0** |
| `projects` | 85 | 85 |
| `profiles` | 36 | 36 |
| `project_collaborators` | 4 | 4 |
| `notifications` | 61631 | 61631 |
| leftover `_probe%` functions | 0 | 0 |

No fixture row was ever committed — every block aborted its own transaction — so no
cleanup delete was required. The C1 confirmation temporarily flipped three projects
to `draft` inside its transaction; the visibility distribution is confirmed restored
(`public 80 / draft 3 / unlisted 2`, matching the 80 public projects observed at the
start). The two probe functions from Round 1 were created and rolled back inside a
single transaction and are confirmed gone.

Note for the record: the task brief cited 35 profiles; the live count is 36. Nothing
in either round created a profile, and the count is identical before and after.

---

## Verdict

**PASS.** All 22 negative attacks are blocked, all 9 positive controls succeed, and
the two consequences of the INVOKER switch are independently confirmed. The single
remaining success (A17) is the documented, deliberate gap whose mitigation belongs to
Task 9.

Slice 8.2 is cleared. **Task 9's server action must call `accept_collab_request` and
never write `status` directly** — that is now the only thing standing between an
accepted request and a missing credit row.
