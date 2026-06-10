-- VolleyCoach — account, team, and membership deletion with a grace-archive.
-- Four removal semantics, each with its own field and mechanism:
--   * Remove a player: drop the membership only; content untouched (no schema change — RLS already allows it).
--   * Archive a team: a reversible, hidden-but-restorable state (teams.archived_at).
--   * Delete a team: the team and its content are grace-archived, then purged after 3 months (teams.deleted_at).
--   * Delete an account: personal content is grace-archived; authored team content is reassigned to the team
--     (owner becomes null, meaning "authored by the team").
-- A single grace-archive (deleted_at on boards and topics) backs every board/topic deletion: a deleted row is
-- hidden from normal views by the client, kept 3 months for admin recovery, then permanently purged.

-- Owner becomes nullable and its delete action changes from cascade to set null, so deleting an account no
-- longer hard-deletes the team content it authored. The inline FKs are named <table>_<column>_fkey by default.
alter table public.boards drop constraint boards_owner_fkey;
alter table public.boards alter column owner drop not null;
alter table public.boards add constraint boards_owner_fkey
  foreign key (owner) references public.profiles (id) on delete set null;

alter table public.topics drop constraint topics_owner_fkey;
alter table public.topics alter column owner drop not null;
alter table public.topics add constraint topics_owner_fkey
  foreign key (owner) references public.profiles (id) on delete set null;

-- Grace-archive columns. deleted_by points to the actor and is set null if that account is later deleted.
alter table public.boards
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

alter table public.topics
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

-- Team archive (reversible) and team delete (starts the 3-month purge clock) are distinct states.
alter table public.teams
  add column archived_at timestamptz,
  add column deleted_at timestamptz;

-- Partial indexes keep the purge scan and the admin recovery list cheap.
create index boards_deleted_idx on public.boards (deleted_at) where deleted_at is not null;
create index topics_deleted_idx on public.topics (deleted_at) where deleted_at is not null;

-- Column additions inherit the table grants from the init/grants migrations, so authenticated and
-- service_role already reach the new columns; no new grant is needed.

-- The board guard trigger must let the owner-nulling cascade through. The old guard raised on any owner
-- change by a non-admin, which would block the on-delete-set-null cascade (it runs as an UPDATE under the
-- deleting session) and any orphaning. It now permits setting owner to NULL by anyone (orphaning to the
-- team), requires admin only to change owner to a different non-null value, and auto-clears the author lock
-- on an orphan (a lock is meaningless without an author who can reach the board).
create or replace function public.enforce_board_guards() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner is distinct from old.owner and new.owner is not null and not public.is_admin() then
    raise exception 'owner cannot be changed';
  end if;
  if new.owner is null then
    new.author_locked := false;
  elsif new.author_locked is distinct from old.author_locked
     and not (old.owner = auth.uid() or public.is_admin()) then
    raise exception 'only the author or an admin may change the author lock';
  end if;
  return new;
end;
$$;

-- Soft-delete a team: admin only. Grace-archive the team and its own boards and topics (not the shared
-- personal boards that merely target it). The purge job removes the rows later.
create function public.delete_team(team uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may delete a team';
  end if;
  update public.teams set deleted_at = now() where id = team;
  update public.boards set deleted_at = now(), deleted_by = auth.uid()
    where team_id = team and scope = 'team' and deleted_at is null;
  update public.topics set deleted_at = now(), deleted_by = auth.uid()
    where team_id = team and scope = 'team' and deleted_at is null;
end;
$$;

grant execute on function public.delete_team(uuid) to authenticated;

-- Soft-delete a topic subtree, replicating today's cascade as a grace-archive. Collect the subtree under
-- `root`, grace-archive every topic in it, and return any member board to Unfiled (topic_id = null) rather
-- than deleting it. Authorization mirrors the topics_delete policy (this runs security definer, so the
-- check is explicit): an admin, a coach of a team topic's team, or the owner of a personal topic.
create function public.soft_delete_topic(root uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.topics;
  ids uuid[];
begin
  select * into r from public.topics where id = root;
  if not found then
    return;
  end if;
  if not (
    public.is_admin()
    or (r.scope = 'team' and public.is_team_coach(r.team_id))
    or (r.scope = 'personal' and r.owner = auth.uid())
  ) then
    raise exception 'not allowed to delete this topic';
  end if;

  with recursive subtree as (
    select id from public.topics where id = root
    union all
    select t.id from public.topics t join subtree s on t.parent_id = s.id
  )
  select array_agg(id) into ids from subtree;

  update public.topics set deleted_at = now(), deleted_by = auth.uid()
    where id = any(ids) and deleted_at is null;
  update public.boards set topic_id = null where topic_id = any(ids);
end;
$$;

grant execute on function public.soft_delete_topic(uuid) to authenticated;

-- Permanently remove grace-archived content and teams past the 3-month window. The team delete cascades to
-- any of its rows that remain. This must never be reachable by a client: revoke the default PUBLIC execute
-- and grant only to service_role, the trusted server role the purge schedule runs as.
create function public.purge_expired() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.boards where deleted_at < now() - interval '3 months';
  delete from public.topics where deleted_at < now() - interval '3 months';
  delete from public.teams where deleted_at < now() - interval '3 months';
end;
$$;

revoke all on function public.purge_expired() from public;
grant execute on function public.purge_expired() to service_role;

notify pgrst, 'reload schema';
