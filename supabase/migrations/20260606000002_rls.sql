-- VolleyVector Phase 2 — row-level security.
-- This is the access boundary: every read and write rule holds here, in the database, even if the
-- client is bypassed. The shared-personal and share-token read paths are added in Stage 2; this
-- migration covers team membership, personal ownership, admin god-mode, team isolation, and the
-- author lock.

-- Membership checks run inside policies, so they must not themselves trigger RLS (that would recurse
-- on profiles/memberships). Each is SECURITY DEFINER with an empty search_path: it runs as the owner,
-- bypasses RLS for its own lookup, and fully qualifies every name.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create function public.is_team_member(team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m where m.team_id = team and m.user_id = auth.uid()
  );
$$;

create function public.is_team_coach(team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.team_id = team and m.user_id = auth.uid() and m.role = 'coach'
  );
$$;

-- True when the caller shares any team with `other` — lets teammates read each other's profile (names,
-- emails) for member lists and board authorship, without exposing strangers.
create function public.shares_team(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_team_member(uuid) to anon, authenticated;
grant execute on function public.is_team_coach(uuid) to anon, authenticated;
grant execute on function public.shares_team(uuid) to anon, authenticated;

-- Only an admin may grant or revoke admin, so the flag can never be set by editing a profile row.
create function public.set_admin(target uuid, value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may change admin status';
  end if;
  update public.profiles set is_admin = value where id = target;
end;
$$;

grant execute on function public.set_admin(uuid, boolean) to authenticated;

-- Owner is immutable except to an admin, and only the author (or an admin) may set or clear the author
-- lock. Together with the board policies below this makes a locked board uneditable by other coaches
-- and stops a coach from seizing a board by reassigning its owner or lock.
create function public.enforce_board_guards() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner is distinct from old.owner and not public.is_admin() then
    raise exception 'owner cannot be changed';
  end if;
  if new.author_locked is distinct from old.author_locked
     and not (old.owner = auth.uid() or public.is_admin()) then
    raise exception 'only the author or an admin may change the author lock';
  end if;
  return new;
end;
$$;

create trigger boards_guards before update on public.boards
for each row execute function public.enforce_board_guards();

-- profiles: a user reads their own profile, an admin reads all, and teammates read each other's.
-- Updates touch the caller's own row, and (by grant) only the display_name column.
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin() or public.shares_team(id));

create policy profiles_update on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- teams: visible to members and admins; created, renamed, and deleted by admins only.
alter table public.teams enable row level security;

create policy teams_select on public.teams for select to authenticated
using (public.is_team_member(id) or public.is_admin());

create policy teams_insert on public.teams for insert to authenticated
with check (public.is_admin());

create policy teams_update on public.teams for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy teams_delete on public.teams for delete to authenticated
using (public.is_admin());

-- memberships: a user sees their own and every membership of a team they belong to; coaches of a team
-- (and admins) add, re-role, and remove its members.
alter table public.memberships enable row level security;

create policy memberships_select on public.memberships for select to authenticated
using (user_id = auth.uid() or public.is_team_member(team_id) or public.is_admin());

create policy memberships_insert on public.memberships for insert to authenticated
with check (public.is_team_coach(team_id) or public.is_admin());

create policy memberships_update on public.memberships for update to authenticated
using (public.is_team_coach(team_id) or public.is_admin())
with check (public.is_team_coach(team_id) or public.is_admin());

create policy memberships_delete on public.memberships for delete to authenticated
using (public.is_team_coach(team_id) or public.is_admin());

-- topics: team topics are read by members and written by coaches; personal topics are the owner's
-- alone; admins reach everything. A row's owner is always the caller, and a team topic's team must be
-- one the caller coaches.
alter table public.topics enable row level security;

create policy topics_select on public.topics for select to authenticated
using (
  public.is_admin()
  or (scope = 'team' and public.is_team_member(team_id))
  or (scope = 'personal' and owner = auth.uid())
);

create policy topics_insert on public.topics for insert to authenticated
with check (
  owner = auth.uid()
  and (
    public.is_admin()
    or (scope = 'team' and public.is_team_coach(team_id))
    or scope = 'personal'
  )
);

create policy topics_update on public.topics for update to authenticated
using (
  public.is_admin()
  or (scope = 'team' and public.is_team_coach(team_id))
  or (scope = 'personal' and owner = auth.uid())
)
with check (
  public.is_admin()
  or (scope = 'team' and public.is_team_coach(team_id))
  or (scope = 'personal' and owner = auth.uid())
);

create policy topics_delete on public.topics for delete to authenticated
using (
  public.is_admin()
  or (scope = 'team' and public.is_team_coach(team_id))
  or (scope = 'personal' and owner = auth.uid())
);

-- boards: team boards are read by members and written by their coaches; a locked team board is
-- writable only by its author (and admins); personal boards are the owner's alone; admins reach
-- everything. Stage 2 widens select with the shared-personal and share-token paths.
alter table public.boards enable row level security;

create policy boards_select on public.boards for select to authenticated
using (
  public.is_admin()
  or (scope = 'team' and public.is_team_member(team_id))
  or (scope = 'personal' and owner = auth.uid())
);

create policy boards_insert on public.boards for insert to authenticated
with check (
  owner = auth.uid()
  and (
    public.is_admin()
    or (scope = 'team' and public.is_team_coach(team_id))
    or scope = 'personal'
  )
);

create policy boards_update on public.boards for update to authenticated
using (
  public.is_admin()
  or (scope = 'team' and public.is_team_coach(team_id) and (author_locked = false or owner = auth.uid()))
  or (scope = 'personal' and owner = auth.uid())
)
with check (
  public.is_admin()
  or (scope = 'team' and public.is_team_coach(team_id) and (author_locked = false or owner = auth.uid()))
  or (scope = 'personal' and owner = auth.uid())
);

create policy boards_delete on public.boards for delete to authenticated
using (
  public.is_admin()
  or (scope = 'team' and public.is_team_coach(team_id) and (author_locked = false or owner = auth.uid()))
  or (scope = 'personal' and owner = auth.uid())
);

notify pgrst, 'reload schema';
