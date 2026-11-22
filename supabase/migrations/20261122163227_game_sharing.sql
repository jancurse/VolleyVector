-- VolleyVector — share links for games.
-- A coach can share a game by link: anyone holding it reads the game page without an account (its details,
-- squad, rotations, and saved stats). Sharing is off until a coach turns it on, which mints the game's token, and
-- turning it off clears the token, so the link stops working. Nothing else opens up: the tables keep their
-- policies, and a visitor reads only through game_by_token.

alter table public.games add column share_token text unique;

-- Turn a game's sharing on or off, returning its token (null once off). Turning it on again keeps the token
-- it has. Minted here so a client can neither choose nor predict it, mirroring set_share_token.
create function public.share_game(game uuid, shared boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  team uuid := public.game_team(game);
  token text;
begin
  if team is null then
    raise exception 'game not found';
  end if;
  if not (public.is_team_coach(team) or public.is_admin()) then
    raise exception 'not allowed to share this team''s games' using errcode = '42501';
  end if;

  update public.games set
    share_token = case when shared then coalesce(share_token, encode(extensions.gen_random_bytes(16), 'hex')) end
  where id = game
  returning share_token into token;

  return token;
end;
$$;

revoke execute on function public.share_game(uuid, boolean) from public, anon;
grant execute on function public.share_game(uuid, boolean) to authenticated;

-- Resolve a shared game from its exact token, or null. It carries what the game page shows and no more: the
-- game, its team's name, the roster players in its squad (never the rest of the roster), and each set with its
-- saved stats (never the working copy, nor who saved it).
create function public.game_by_token(token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'game', jsonb_build_object(
      'id', g.id, 'team_id', g.team_id, 'name', g.name, 'played_on', g.played_on, 'opponent', g.opponent,
      'venue', g.venue, 'notes', g.notes, 'squad', g.squad, 'overrides', g.overrides,
      'overview_shift', g.overview_shift, 'rotations', g.rotations
    ),
    'team_name', (select t.name from public.teams t where t.id = g.team_id),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'team_id', p.team_id, 'number', p.number, 'name', p.name, 'short_name', p.short_name,
        'main_position', p.main_position, 'secondary_positions', p.secondary_positions,
        'archived_at', p.archived_at
      ))
      from public.roster_players p
      where p.team_id = g.team_id and p.id = any (g.squad)
    ), '[]'::jsonb),
    'sets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'game_id', s.game_id, 'set_number', s.set_number, 'score_us', s.score_us,
        'score_them', s.score_them, 'video_url', s.video_url, 'touches', s.touches,
        'finished_at', s.finished_at, 'published_at', s.published_at, 'updated_at', s.updated_at,
        'published', s.published
      ) order by s.set_number)
      from public.game_sets s
      where s.game_id = g.id
    ), '[]'::jsonb)
  )
  from public.games g
  where g.share_token = token;
$$;

revoke execute on function public.game_by_token(text) from public;
grant execute on function public.game_by_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
