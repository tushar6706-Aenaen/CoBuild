-- Adding a defaulted parameter to an existing function creates a second
-- OVERLOAD rather than replacing it, and PostgREST then cannot resolve the
-- call — every feed request 300s. So drop the old signature explicitly, in
-- the same migration, before recreating.
drop function if exists public.feed_page(text, integer, text, uuid, integer, timestamp with time zone, uuid, text);

CREATE OR REPLACE FUNCTION public.feed_page(p_tab text, p_limit integer DEFAULT 21, p_window text DEFAULT 'all'::text, p_viewer uuid DEFAULT NULL::uuid, p_cur_num integer DEFAULT NULL::integer, p_cur_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cur_id uuid DEFAULT NULL::uuid, p_tag text DEFAULT NULL::text, p_looking_for text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, slug text, title text, tagline text, cover_image_path text, status text, upvote_count integer, comment_count integer, view_count integer, published_at timestamp with time zone, hot_score double precision, looking_for text[], author jsonb, tags jsonb)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_ids     uuid[];
  v_since   timestamptz;
  v_score   double precision;
  v_tag_id  uuid;
begin
  if p_limit is null or p_limit < 1 then p_limit := 21; end if;
  p_limit := least(p_limit, 51);

  v_since := case p_window
               when 'today' then now() - interval '1 day'
               when 'week'  then now() - interval '7 days'
               when 'month' then now() - interval '30 days'
               else null
             end;

  -- Resolved once to a uuid so the per-row filter is an index probe on
  -- project_tags' primary key rather than a join through `tags` per candidate.
  -- A slug that matches no tag yields a null id, and the `p_tag is not null`
  -- guard below then makes every branch return zero rows — an unknown tag is
  -- an empty tag page, never an unfiltered feed.
  if p_tag is not null then
    select t.id into v_tag_id from public.tags t where t.slug = p_tag;
    if v_tag_id is null then return; end if;
  end if;

  if p_tab = 'hot' then
    v_score := public.compute_hot_score(coalesce(p_cur_num, 0), p_cur_ts);
    v_ids := array(
      select p.id from public.projects p
       where p.visibility = 'public'
         and p.published_at is not null
         and (v_tag_id is null
              or exists (select 1 from public.project_tags pt
                          where pt.project_id = p.id and pt.tag_id = v_tag_id))
         and (p_looking_for is null
              or array_length(p_looking_for, 1) is null
              or p.looking_for && p_looking_for)
         and (p_cur_id is null
              or (p.hot_score, p.published_at, p.id) < (v_score, p_cur_ts, p_cur_id))
       order by p.hot_score desc, p.published_at desc, p.id desc
       limit p_limit);

  elsif p_tab = 'top' then
    v_ids := array(
      select p.id from public.projects p
       where p.visibility = 'public'
         and p.published_at is not null
         and (v_since is null or p.published_at >= v_since)
         and (v_tag_id is null
              or exists (select 1 from public.project_tags pt
                          where pt.project_id = p.id and pt.tag_id = v_tag_id))
         and (p_looking_for is null
              or array_length(p_looking_for, 1) is null
              or p.looking_for && p_looking_for)
         and (p_cur_id is null
              or (p.upvote_count, p.published_at, p.id) < (p_cur_num, p_cur_ts, p_cur_id))
       order by p.upvote_count desc, p.published_at desc, p.id desc
       limit p_limit);

  elsif p_tab = 'following' then
    if p_viewer is null then return; end if;
    v_ids := array(
      select p.id from public.projects p
       where p.visibility = 'public'
         and p.published_at is not null
         and (p.author_id in (select f.following_id from public.follows f
                               where f.follower_id = p_viewer)
              or exists (select 1 from public.project_tags pt
                           join public.tag_follows tf on tf.tag_id = pt.tag_id
                          where pt.project_id = p.id and tf.profile_id = p_viewer))
         and (v_tag_id is null
              or exists (select 1 from public.project_tags pt
                          where pt.project_id = p.id and pt.tag_id = v_tag_id))
         and (p_looking_for is null
              or array_length(p_looking_for, 1) is null
              or p.looking_for && p_looking_for)
         and (p_cur_id is null
              or (p.published_at, p.id) < (p_cur_ts, p_cur_id))
       order by p.published_at desc, p.id desc
       limit p_limit);

  elsif p_tab = 'new' then
    v_ids := array(
      select p.id from public.projects p
       where p.visibility = 'public'
         and p.published_at is not null
         and (v_tag_id is null
              or exists (select 1 from public.project_tags pt
                          where pt.project_id = p.id and pt.tag_id = v_tag_id))
         and (p_looking_for is null
              or array_length(p_looking_for, 1) is null
              or p.looking_for && p_looking_for)
         and (p_cur_id is null
              or (p.published_at, p.id) < (p_cur_ts, p_cur_id))
       order by p.published_at desc, p.id desc
       limit p_limit);

  else
    raise exception 'feed_page: unknown tab %', p_tab using errcode = '22023';
  end if;

  -- Hydrate only the page's rows. Ranking and hydration are split so the
  -- author/tag lookups run `p_limit` times, not once per candidate row.
  return query
    select p.id, p.slug, p.title, p.tagline, p.cover_image_path, p.status,
           p.upvote_count, p.comment_count, p.view_count, p.published_at, p.hot_score,
           p.looking_for,
           jsonb_build_object('username', a.username,
                              'display_name', a.display_name,
                              'avatar_url', a.avatar_url) as author,
           coalesce((select jsonb_agg(jsonb_build_object('slug', t.slug, 'name', t.name)
                                      order by t.name)
                       from public.project_tags pt
                       join public.tags t on t.id = pt.tag_id
                      where pt.project_id = p.id), '[]'::jsonb) as tags
      from unnest(v_ids) with ordinality as u(pid, ord)
      join public.projects p on p.id = u.pid
      left join public.profiles a on a.id = p.author_id
     order by u.ord;
end;
$function$;
