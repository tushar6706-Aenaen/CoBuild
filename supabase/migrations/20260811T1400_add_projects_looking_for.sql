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
