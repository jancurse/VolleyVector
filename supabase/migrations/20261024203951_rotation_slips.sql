-- VolleyVector — team rosters and games (rotation slips).
-- A team keeps one roster of its players (jersey number, name, main and optional secondary position). A
-- game is a lightweight named plan (an optional date) holding the squad picked from the roster and its
-- starting lineups, stored as JSON. Both belong to exactly one team and follow its roles: any member reads,
-- a coach of the team or an admin writes. They sit outside the board/note access-list model on purpose.
--
-- Removing a roster player archives the row (archived_at) rather than deleting it, so a game that already
-- includes them still resolves their number and name. Purging a team cascades both tables away.

create table public.roster_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  number integer not null check (number between 0 and 99),
  name text not null default '',
  main_position text not null check (main_position in ('setter', 'outside', 'middle', 'opposite', 'libero')),
  secondary_position text check (secondary_position in ('setter', 'outside', 'middle', 'opposite', 'libero')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- A jersey number is unique among a team's active players; an archived player frees their number.
create unique index roster_players_number_idx on public.roster_players (team_id, number) where archived_at is null;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null default '',
  played_on date,
  squad uuid[] not null default '{}',
  lineups jsonb not null default '[]',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_team_idx on public.games (team_id);

create trigger games_updated_at before update on public.games
for each row execute function public.set_updated_at();

-- "Auto-expose new tables" is off, so the grants are explicit, service_role included.
grant select, insert, update, delete on public.roster_players to authenticated, service_role;
grant select, insert, update, delete on public.games to authenticated, service_role;

alter table public.roster_players enable row level security;
alter table public.games enable row level security;

create policy roster_players_select on public.roster_players for select to authenticated
using (public.is_team_member(team_id) or public.is_admin());

create policy roster_players_write on public.roster_players for all to authenticated
using (public.is_team_coach(team_id) or public.is_admin())
with check (public.is_team_coach(team_id) or public.is_admin());

create policy games_select on public.games for select to authenticated
using (public.is_team_member(team_id) or public.is_admin());

create policy games_write on public.games for all to authenticated
using (public.is_team_coach(team_id) or public.is_admin())
with check (public.is_team_coach(team_id) or public.is_admin());

notify pgrst, 'reload schema';
