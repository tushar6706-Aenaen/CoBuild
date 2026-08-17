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
