-- `accept_collab_request` ends its credit insert with `on conflict do nothing`,
-- but the only unique index on this table was the primary key on `id` — a fresh
-- uuid on every insert, so that clause could never fire. An author who manually
-- credits someone and later accepts that same person's pending request would
-- mint a duplicate (project_id, profile_id) row plus a second `credit`
-- notification, both of which survive edits and show on the public project page.
--
-- Partial on purpose: name-only credits carry `profile_id is null`, and several
-- unlinked placeholder names on one project are legitimate.
create unique index project_collaborators_project_profile_uniq
  on public.project_collaborators (project_id, profile_id)
  where profile_id is not null;
