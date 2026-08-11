-- Same reason as the feed_page migration: a defaulted parameter would add an
-- overload PostgREST cannot resolve, so drop the old signature first.
drop function if exists public.search_projects(text, text[], text[], integer);

CREATE OR REPLACE FUNCTION public.search_projects(p_q text, p_status text[] DEFAULT NULL::text[], p_tags text[] DEFAULT NULL::text[], p_limit integer DEFAULT 24, p_looking_for text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, slug text, title text, tagline text, cover_image_path text, status text, upvote_count integer, comment_count integer, view_count integer, published_at timestamp with time zone, looking_for text[], author jsonb, tags jsonb, total integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with q as (
    -- websearch_to_tsquery, not plainto_/to_tsquery: it accepts what users
    -- actually type (quoted phrases, OR, leading -) and, critically, never
    -- raises on malformed input the way to_tsquery does.
    select websearch_to_tsquery('english', coalesce(p_q, '')) as tsq
  ),
  hits as (
    select p.*, ts_rank_cd(p.search_tsv, q.tsq) as rank
      from public.projects p, q
     where q.tsq is not null
       and numnode(q.tsq) > 0
       and p.search_tsv @@ q.tsq
       and p.visibility = 'public'
       and p.published_at is not null
       and (p_status is null or array_length(p_status, 1) is null or p.status = any(p_status))
       and (p_tags is null or array_length(p_tags, 1) is null
            or exists (select 1
                         from public.project_tags pt
                         join public.tags t on t.id = pt.tag_id
                        where pt.project_id = p.id and t.slug = any(p_tags)))
       -- An empty array is "no filter", not "match nothing": PostgREST sends
       -- {} rather than null, and `looking_for && '{}'` is false for every row.
       and (p_looking_for is null or array_length(p_looking_for, 1) is null
            or p.looking_for && p_looking_for)
  )
  select h.id, h.slug, h.title, h.tagline, h.cover_image_path, h.status,
         h.upvote_count, h.comment_count, h.view_count, h.published_at,
         h.looking_for,
         jsonb_build_object('username', a.username,
                            'display_name', a.display_name,
                            'avatar_url', a.avatar_url) as author,
         coalesce((select jsonb_agg(jsonb_build_object('slug', t.slug, 'name', t.name) order by t.name)
                     from public.project_tags pt
                     join public.tags t on t.id = pt.tag_id
                    where pt.project_id = h.id), '[]'::jsonb) as tags,
         count(*) over ()::integer as total
    from hits h
    left join public.profiles a on a.id = h.author_id
   -- `id` last so the order is total even when rank and upvotes tie.
   order by h.rank desc, h.upvote_count desc, h.id desc
   limit least(greatest(coalesce(p_limit, 24), 1), 60);
$function$;
