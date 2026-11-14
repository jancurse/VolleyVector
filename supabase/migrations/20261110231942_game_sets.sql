-- VolleyVector — recorded sets (the stats tracker).
-- A game gains an opponent, a venue, and notes, and holds its recorded sets. A set row keeps the tracker's data as
-- JSON in the tracker's set format (AppData version 2), plus a version for conflict detection
-- and the columns the games list shows (set number, score, video, touch count), refreshed on every save.
-- Sets follow their game's team roles: any member reads, a coach of the team or an admin writes.
--
-- Saving is one compare-and-swap step (save_game_set): the caller names the version their changes were
-- made on, and a save on a stale version is refused with the newer version's details. The set's id is
-- minted in the browser, so a set started offline is created by its first save (base version 0).
-- Autosave overwrites the live row, and marking a set finished only stamps finished_at, so a set is always one row.

alter table public.games
  add column opponent text not null default '',
  add column venue text not null default 'home' check (venue in ('home', 'away', 'neutral')),
  add column notes text not null default '';

create table public.game_sets (
  id uuid primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  data jsonb not null,
  version integer not null default 1,
  set_number integer not null default 0,
  score_us integer not null default 0,
  score_them integer not null default 0,
  video_url text not null default '',
  touches integer not null default 0,
  finished_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_sets_game_idx on public.game_sets (game_id);

-- Writes go through save_game_set and finish_game_set; a client only reads and deletes directly.
grant select, delete on public.game_sets to authenticated;
grant select, insert, update, delete on public.game_sets to service_role;

alter table public.game_sets enable row level security;

-- The team a game belongs to. Security definer so the policies below need no read access to games.
create function public.game_team(game uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select team_id from public.games where id = game;
$$;

grant execute on function public.game_team(uuid) to authenticated;

create policy game_sets_select on public.game_sets for select to authenticated
using (public.is_team_member(public.game_team(game_id)) or public.is_admin());

create policy game_sets_delete on public.game_sets for delete to authenticated
using (public.is_team_coach(public.game_team(game_id)) or public.is_admin());

-- The list columns a save derives from the set's JSON.
create function public.game_set_number(content jsonb) returns integer
language sql immutable set search_path = '' as $$
  select coalesce(substring(content #>> '{meta,setNumber}' from '^\s*(\d{1,4})')::integer, 0);
$$;

create function public.game_set_touches(content jsonb) returns integer
language sql immutable set search_path = '' as $$
  select count(*)::integer
  from jsonb_array_elements(coalesce(content -> 'events', '[]'::jsonb)) e
  where e ->> 'kind' = 'touch';
$$;

-- Save a set: compare-and-swap on its version. `base` is the version the caller's changes were made on,
-- or 0 for a set the browser created that the server has not seen yet. The score follows from the rally
-- rules, so the client derives it and it is stored for the list. Returns {"version": n} on success,
-- {"conflict": true, "version", "updated_by", "updated_at"} when someone saved in between, or
-- {"missing": true} when the set or its game was deleted. A save that repeats the stored content succeeds
-- again. Security definer for one atomic step; it checks the caller's role explicitly since it bypasses RLS.
create function public.save_game_set(set_id uuid, game uuid, content jsonb, base integer, us integer, them integer)
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
    insert into public.game_sets (id, game_id, data, set_number, score_us, score_them, video_url, touches,
                                  created_by, updated_by)
    values (set_id, game, content, public.game_set_number(content), us, them,
            coalesce(content #>> '{meta,youtubeUrl}', ''), public.game_set_touches(content), auth.uid(), auth.uid())
    on conflict (id) do nothing
    returning version into saved;
  else
    update public.game_sets set
      data = content,
      version = version + 1,
      set_number = public.game_set_number(content),
      score_us = us,
      score_them = them,
      video_url = coalesce(content #>> '{meta,youtubeUrl}', ''),
      touches = public.game_set_touches(content),
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
  -- A save repeated after its answer was lost (a timeout) already holds this content: it succeeded.
  if existing.data = content then
    return jsonb_build_object('version', existing.version);
  end if;

  return jsonb_build_object(
    'conflict', true,
    'version', existing.version,
    'updated_by', coalesce((select display_name from public.profiles where id = existing.updated_by), 'Someone'),
    'updated_at', existing.updated_at
  );
end;
$$;

-- Mark a set finished, or reopen it.
create function public.finish_game_set(set_id uuid, finished boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  game uuid;
begin
  select game_id into game from public.game_sets where id = set_id;
  if not found then
    raise exception 'set not found';
  end if;
  if not (public.is_team_coach(public.game_team(game)) or public.is_admin()) then
    raise exception 'not allowed to record sets for this team' using errcode = '42501';
  end if;

  update public.game_sets set finished_at = case when finished then now() end where id = set_id;
end;
$$;

revoke execute on function public.save_game_set(uuid, uuid, jsonb, integer, integer, integer) from public, anon;
revoke execute on function public.finish_game_set(uuid, boolean) from public, anon;
grant execute on function public.save_game_set(uuid, uuid, jsonb, integer, integer, integer) to authenticated;
grant execute on function public.finish_game_set(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
