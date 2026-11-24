-- VolleyVector — a set's draft stays out of its saved stats.
-- A set's working copy may hold a `draft`: contacts that have a time and still need describing, marked by the
-- recorder or placed by a model. Only the tracker reads it, so saving the stats leaves it behind, and a working copy
-- that differs from its stats only by its draft is not flagged as changed.

alter table public.game_sets drop column unpublished;
alter table public.game_sets
  add column unpublished boolean generated always as (
    published is distinct from (data - 'draft')
    and (published is not null or jsonb_array_length(data -> 'events') > 0)
  ) stored;

-- Save a set's stats: its working copy at version `base`, without its draft, becomes what everyone reads, and the
-- list columns follow it. Returns {"version": n}, the conflict answer when the working copy changed since `base`,
-- or {"missing": true}.
create or replace function public.publish_game_set(set_id uuid, base integer, us integer, them integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  existing public.game_sets;
begin
  select * into existing from public.game_sets where id = set_id for update;
  if not found then
    return jsonb_build_object('missing', true);
  end if;
  if not (public.is_team_coach(public.game_team(existing.game_id)) or public.is_admin()) then
    raise exception 'not allowed to record sets for this team' using errcode = '42501';
  end if;
  if existing.version <> base then
    return public.game_set_conflict(existing);
  end if;

  update public.game_sets set
    published = data - 'draft',
    published_at = now(),
    published_by = auth.uid(),
    score_us = us,
    score_them = them,
    video_url = coalesce(data #>> '{meta,youtubeUrl}', ''),
    touches = public.game_set_touches(data)
  where id = set_id;

  return jsonb_build_object('version', base);
end;
$$;

notify pgrst, 'reload schema';
