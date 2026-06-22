-- VolleyVector — fix board/note creation for non-admins (access-list bootstrap).
-- Creating content is two writes: insert the boards/topics row (created_by = auth.uid()), then insert the
-- creator's first owner grant. The grant insert's bootstrap clause read `created_by` with a plain subquery
-- on the content table, but that subquery runs under RLS, and *_select only reveals a row the caller already
-- holds a grant on. A brand-new row has no grant yet, so the creator could not see their own just-created row
-- through the subquery: it returned null, the clause failed, and the first grant was rejected. Read
-- `created_by` through a security-definer helper that bypasses RLS instead.

-- The creator of a board, but only while it still has no access grant — the transient bootstrap window. Once
-- any grant exists this returns null, so it cannot look up the author of an established board. Security
-- definer so it sees the row regardless of the caller's grants, like the capability helpers.
create function public.board_creator(board uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select b.created_by from public.boards b
  where b.id = board and not exists (select 1 from public.board_access a where a.board_id = board);
$$;

create function public.topic_creator(topic uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select t.created_by from public.topics t
  where t.id = topic and not exists (select 1 from public.topic_access a where a.topic_id = topic);
$$;

grant execute on function public.board_creator(uuid) to authenticated;
grant execute on function public.topic_creator(uuid) to authenticated;

-- Re-create the access-list insert policies with the bootstrap clause reading the creator through the helper.
-- Every other clause is unchanged: the existing-owner path and the team-grant guard.
drop policy board_access_insert on public.board_access;
create policy board_access_insert on public.board_access for insert to authenticated
  with check (
    (
      public.capability_rank(public.board_capability(board_id)) >= 3
      or public.board_creator(board_id) = auth.uid()
    )
    and (team_id is null or public.is_team_coach(team_id) or public.is_admin())
  );

drop policy topic_access_insert on public.topic_access;
create policy topic_access_insert on public.topic_access for insert to authenticated
  with check (
    (
      public.capability_rank(public.topic_capability(topic_id)) >= 3
      or public.topic_creator(topic_id) = auth.uid()
    )
    and (team_id is null or public.is_team_coach(team_id) or public.is_admin())
  );

-- Atomicity for the two-step create: if the grant write fails after the row landed, the client removes the
-- orphaned row through these helpers. A plain client delete cannot (boards/topics delete is admin-only), so
-- this security-definer path does it, scoped so it only ever removes a grant-less row the caller created —
-- never an established board/note (which always carries at least its creator's grant).
create function public.delete_orphan_board(board uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.boards b
  where b.id = board and b.created_by = auth.uid()
    and not exists (select 1 from public.board_access a where a.board_id = board);
$$;

create function public.delete_orphan_topic(topic uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.topics t
  where t.id = topic and t.created_by = auth.uid()
    and not exists (select 1 from public.topic_access a where a.topic_id = topic);
$$;

grant execute on function public.delete_orphan_board(uuid) to authenticated;
grant execute on function public.delete_orphan_topic(uuid) to authenticated;

notify pgrst, 'reload schema';
