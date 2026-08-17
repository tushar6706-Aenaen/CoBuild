-- Both collab_requests guards shipped as `security definer`, which made them
-- completely inert. Inside a SECURITY DEFINER function `current_user` is the
-- function owner (`postgres`), never `anon`/`authenticated`, so the opening
--   if current_user not in ('anon', 'authenticated') then return new; end if;
-- was true for every real caller and both functions returned immediately. The
-- status-transition rules and the 10-per-24h rate limit have never run: a
-- requester could self-accept, an author could rewrite the requester's message
-- and backdate created_at, declined -> accepted reopened, and the limit never
-- fired.
--
-- The pre-existing guards this pattern was copied from
-- (profiles_guard_client_columns, projects_guard_client_columns) are INVOKER
-- for exactly this reason. Only the counter-maintainers (projects_after_change)
-- are DEFINER, and they do not test current_user.
--
-- `session_user` is deliberately NOT substituted for `current_user`: under
-- PostgREST that is `authenticator`, not the role the request runs as.
--
-- The bodies below are byte-identical to the originals; only the SECURITY
-- clause is dropped, matching the convention of the two guards above.

create or replace function public.collab_requests_guard()
returns trigger language plpgsql set search_path to '' as $function$
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

create or replace function public.collab_requests_rate_limit()
returns trigger language plpgsql set search_path to '' as $function$
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

-- Re-issued rather than assumed: do not rely on ACLs surviving a replace.
revoke all on function public.collab_requests_guard()      from public;
revoke all on function public.collab_requests_guard()      from anon, authenticated;
revoke all on function public.collab_requests_rate_limit() from public;
revoke all on function public.collab_requests_rate_limit() from anon, authenticated;
