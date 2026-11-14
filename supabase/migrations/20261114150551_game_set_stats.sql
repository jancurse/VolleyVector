-- VolleyVector — saved stats for recorded sets.
-- A set keeps two copies of its tracker data. `data` is the working copy the tracker saves as it records;
-- `published` is the stats everyone reads (the dashboard, highlights, and report). A coach copies one to the other
-- with publish_game_set ("Save stats"), so changes stay out of the stats until then. `unpublished` flags a working
-- copy that differs from its stats, unless nothing is recorded in it yet and it has none. The sets recorded so far
-- were already read as stats, so they start saved.
--
-- Everything outside the tracker describes the stats: the list columns (score, video, touch count) are written when
-- the stats are saved, never by recording. Only the set's identity (its number, finished, who saved) follows the
-- working copy.
--
-- Changes that follow the game rather than the recording (the squad joining or leaving a set's player list, a
-- roster rename) reach both copies at once through relink_game_set, which leaves who last saved the set alone.

alter table public.game_sets
  add column published jsonb,
  add column published_at timestamptz,
  add column published_by uuid references public.profiles (id) on delete set null,
  add column unpublished boolean generated always as (
    published is distinct from data and (published is not null or jsonb_array_length(data -> 'events') > 0)
  ) stored;

update public.game_sets set published = data, published_at = updated_at, published_by = updated_by;

-- The answer to a write made on a stale version: the newer version and who saved it.
create function public.game_set_conflict(existing public.game_sets) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'conflict', true,
    'version', existing.version,
    'updated_by', coalesce((select display_name from public.profiles where id = existing.updated_by), 'Someone'),
    'updated_at', existing.updated_at
  );
$$;

revoke execute on function public.game_set_conflict(public.game_sets) from public, anon, authenticated;

-- Saving the working copy no longer touches the list columns, which follow the stats, so it takes no score.
drop function public.save_game_set(uuid, uuid, jsonb, integer, integer, integer);

-- Save a set's working copy: compare-and-swap on its version, as before. `base` is the version the caller's changes
-- were made on, or 0 for a set the browser created that the server has not seen yet. Returns {"version": n} on
-- success, the conflict answer when someone saved in between, or {"missing": true} when the set or its game was
-- deleted. A save that repeats the stored content succeeds again.
create function public.save_game_set(set_id uuid, game uuid, content jsonb, base integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  team uuid := public.game_team(game);
  saved integer;
  existing public.game_sets;
begin
  if team is null then
    return jsonb_build_object('missing', true);
  end if;
  if not (public.is_team_coach(team) or public.is_admin()) then
    raise exception 'not allowed to record sets for this team' using errcode = '42501';
  end if;
  if jsonb_typeof(content) is distinct from 'object' or (content ->> 'version') is distinct from '2'
     or jsonb_typeof(content -> 'events') is distinct from 'array' then
    raise exception 'not a set in the stats format (version 2)' using errcode = '22023';
  end if;

  if base = 0 then
    insert into public.game_sets (id, game_id, data, set_number, created_by, updated_by)
    values (set_id, game, content, public.game_set_number(content), auth.uid(), auth.uid())
    on conflict (id) do nothing
    returning version into saved;
  else
    update public.game_sets set
      data = content,
      version = version + 1,
      set_number = public.game_set_number(content),
      updated_by = auth.uid(),
      updated_at = now()
    where id = set_id and game_id = game and version = base
    returning version into saved;
  end if;

  if saved is not null then
    return jsonb_build_object('version', saved);
  end if;

  select * into existing from public.game_sets where id = set_id and game_id = game;
  if not found then
    return jsonb_build_object('missing', true);
  end if;
  if existing.data = content then
    return jsonb_build_object('version', existing.version);
  end if;

  return public.game_set_conflict(existing);
end;
$$;

-- Save a set's stats: its working copy at version `base` becomes what everyone reads, and the list columns follow
-- it. The score follows from the rally rules, so the client derives it from that copy. Returns {"version": n}, the
-- conflict answer when the working copy changed since `base`, or {"missing": true}.
create function public.publish_game_set(set_id uuid, base integer, us integer, them integer) returns jsonb
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
    published = data,
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

-- Replace both copies of a set with the game's changes applied (`stats` is null for a set with no saved stats),
-- as a compare-and-swap on the version like save_game_set. The score and who last saved stay as they are.
create function public.relink_game_set(set_id uuid, base integer, content jsonb, stats jsonb) returns jsonb
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
  if (content ->> 'version') is distinct from '2' or jsonb_typeof(content -> 'events') is distinct from 'array'
     or (stats is not null and ((stats ->> 'version') is distinct from '2'
                                or jsonb_typeof(stats -> 'events') is distinct from 'array')) then
    raise exception 'not a set in the stats format (version 2)' using errcode = '22023';
  end if;
  if existing.version <> base then
    -- Repeated after its answer was lost: the set already holds these copies.
    if existing.data = content and existing.published is not distinct from stats then
      return jsonb_build_object('version', existing.version);
    end if;

    return public.game_set_conflict(existing);
  end if;

  update public.game_sets set
    data = content,
    published = stats,
    version = version + 1,
    set_number = public.game_set_number(content),
    video_url = coalesce(stats #>> '{meta,youtubeUrl}', ''),
    touches = coalesce(public.game_set_touches(stats), 0)
  where id = set_id;

  return jsonb_build_object('version', base + 1);
end;
$$;

revoke execute on function public.save_game_set(uuid, uuid, jsonb, integer) from public, anon;
revoke execute on function public.publish_game_set(uuid, integer, integer, integer) from public, anon;
revoke execute on function public.relink_game_set(uuid, integer, jsonb, jsonb) from public, anon;
grant execute on function public.save_game_set(uuid, uuid, jsonb, integer) to authenticated;
grant execute on function public.publish_game_set(uuid, integer, integer, integer) to authenticated;
grant execute on function public.relink_game_set(uuid, integer, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
