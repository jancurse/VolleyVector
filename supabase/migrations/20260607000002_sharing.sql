-- VolleyCoach Phase 2 — Stage 2 sharing (read paths).
-- Stage 1 covered team membership, personal ownership, admin god-mode, team isolation, and the author
-- lock. Stage 2 adds the two read paths sharing needs: a team member may read a personal board its owner
-- has shared into their team, and a visitor with no account may resolve exactly one board from its
-- unguessable share token. Writes are unchanged: sharing, unsharing, copying, and an owner moving their
-- own board into a team they coach all hold under the existing board policies (an owner editing their own
-- row, or any user inserting a deep copy they author).

-- Read a shared personal board as a team member. A personal board is private to its owner until shared;
-- once shared (shared = true) it names a target team in team_id, and that team's members may read it. The
-- existing owner and admin read paths still apply; this only widens select, never any write.
drop policy if exists boards_select on public.boards;

create policy boards_select on public.boards for select to authenticated
using (
  public.is_admin()
  or (scope = 'team' and public.is_team_member(team_id))
  or (scope = 'personal' and owner = auth.uid())
  or (scope = 'personal' and shared = true and public.is_team_member(team_id))
);

-- Resolve one board from its share token, for a visitor with no account. SECURITY DEFINER so it runs as
-- the owner and bypasses RLS, then returns the row only when it is shareable: a team board, or a shared
-- personal board. An unshared personal board's token never resolves. The token is unguessable and the
-- function takes only an exact token, so the collection cannot be enumerated.
create or replace function public.board_by_token(token text) returns setof public.boards
language sql stable security definer set search_path = '' as $$
  select b.* from public.boards b
  where b.share_token = token
    and (b.scope = 'team' or (b.scope = 'personal' and b.shared = true));
$$;

grant execute on function public.board_by_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
