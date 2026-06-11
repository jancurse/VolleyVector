-- VolleyCoach — the Inspiration showcase space.
-- One team is the showcase: a read-only, admin-curated collection of example boards and topics that
-- every authenticated user may browse and copy from. The flag plus the widened read policies below are
-- the whole mechanism; writes are unchanged (coaches of the showcase team and admins curate it).

alter table public.teams add column is_showcase boolean not null default false;

-- At most one team is the showcase.
create unique index teams_one_showcase_idx on public.teams (is_showcase) where is_showcase;

-- Policies on boards/topics check the flag across tables, so the lookup must bypass RLS on teams
-- (security definer, empty search path), like the membership helpers.
create function public.is_showcase_team(team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select t.is_showcase from public.teams t where t.id = team), false);
$$;

grant execute on function public.is_showcase_team(uuid) to anon, authenticated;

-- teams: everyone may read the showcase team (so it shows in the space switcher).
drop policy teams_select on public.teams;

create policy teams_select on public.teams for select to authenticated
using (public.is_team_member(id) or public.is_admin() or is_showcase);

-- topics and boards: everyone may read the showcase team's content. The other read arms are unchanged
-- (boards_select keeps the Stage 2 shared-personal path).
drop policy topics_select on public.topics;

create policy topics_select on public.topics for select to authenticated
using (
  public.is_admin()
  or (scope = 'team' and public.is_team_member(team_id))
  or (scope = 'team' and public.is_showcase_team(team_id))
  or (scope = 'personal' and owner = auth.uid())
);

drop policy boards_select on public.boards;

create policy boards_select on public.boards for select to authenticated
using (
  public.is_admin()
  or (scope = 'team' and public.is_team_member(team_id))
  or (scope = 'team' and public.is_showcase_team(team_id))
  or (scope = 'personal' and owner = auth.uid())
  or (scope = 'personal' and shared = true and public.is_team_member(team_id))
);

-- The showcase team itself, with a fixed id so the insert is idempotent.
insert into public.teams (id, name, slug, is_showcase)
values ('44444444-4444-4444-4444-444444444444', 'Inspiration', 'inspiration', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
