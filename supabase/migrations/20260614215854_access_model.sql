-- VolleyCoach — the access-list ownership model.
-- Boards and topics no longer live in exactly one space. A piece of content has a `created_by` label (for
-- attribution only, never load-bearing) and an access list: a set of (principal, capability) grants, where a
-- principal is a user or a team and a capability is viewer, editor, or owner. Content appears in a space's
-- library when that space's principal is on its list, so one board can live in several teams and a personal
-- space at once. Lifecycle is reference counting: content lives while its list is non-empty, and a row
-- grace-archives when the last grant is removed.
--
-- This replaces the scattered placement and access columns: `owner` (as a control field), `scope`, `shared`,
-- `team_id` on boards, and `author_locked` all collapse into the access list. Author-lock becomes a team
-- viewer grant beside the creator's owner grant; sharing becomes a team viewer grant; moving becomes a team
-- owner grant; scope is derived from the grants.

-- A capability's rank, so policies and the capability functions can take a max and compare. Unknown/absent
-- ranks 0, below viewer, so a null capability never clears a write check.
create function public.capability_rank(cap text) returns int
language sql immutable as $$
  select case cap when 'owner' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end;
$$;

grant execute on function public.capability_rank(text) to authenticated;

-- The access list for boards. Exactly one of user_id / team_id is set (the principal). A team grant maps the
-- team's roles, capped by its capability: a coach gets the grant's capability, any member at least viewer.
create table public.board_access (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  capability text not null check (capability in ('viewer', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  constraint board_access_one_principal check ((user_id is null) <> (team_id is null))
);

create unique index board_access_user_key on public.board_access (board_id, user_id) where user_id is not null;
create unique index board_access_team_key on public.board_access (board_id, team_id) where team_id is not null;
create index board_access_user_idx on public.board_access (user_id) where user_id is not null;
create index board_access_team_idx on public.board_access (team_id) where team_id is not null;

create table public.topic_access (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  capability text not null check (capability in ('viewer', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  constraint topic_access_one_principal check ((user_id is null) <> (team_id is null))
);

create unique index topic_access_user_key on public.topic_access (topic_id, user_id) where user_id is not null;
create unique index topic_access_team_key on public.topic_access (topic_id, team_id) where team_id is not null;
create index topic_access_user_idx on public.topic_access (user_id) where user_id is not null;
create index topic_access_team_idx on public.topic_access (team_id) where team_id is not null;

grant select, insert, update, delete on public.board_access to authenticated, service_role;
grant select, insert, update, delete on public.topic_access to authenticated, service_role;

-- The caller's effective capability on a board: the highest grant they hold. Admin is owner everywhere; a
-- direct user grant counts as itself; a team grant counts as its capability for a coach and as viewer for any
-- member; a showcase team grant is viewer for everyone. Null when the caller holds nothing. Security definer
-- and non-recursive, like the membership helpers, so a policy can call it without tripping RLS.
create function public.board_capability(board uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case max(rank) when 3 then 'owner' when 2 then 'editor' when 1 then 'viewer' else null end
  from (
    select 3 as rank where public.is_admin()
    union all
    select public.capability_rank(a.capability)
      from public.board_access a where a.board_id = board and a.user_id = auth.uid()
    union all
    select case
             when public.is_team_coach(a.team_id) then public.capability_rank(a.capability)
             when public.is_team_member(a.team_id) then 1
             when public.is_showcase_team(a.team_id) then 1
             else 0
           end
      from public.board_access a where a.board_id = board and a.team_id is not null
  ) ranks;
$$;

create function public.topic_capability(topic uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case max(rank) when 3 then 'owner' when 2 then 'editor' when 1 then 'viewer' else null end
  from (
    select 3 as rank where public.is_admin()
    union all
    select public.capability_rank(a.capability)
      from public.topic_access a where a.topic_id = topic and a.user_id = auth.uid()
    union all
    select case
             when public.is_team_coach(a.team_id) then public.capability_rank(a.capability)
             when public.is_team_member(a.team_id) then 1
             when public.is_showcase_team(a.team_id) then 1
             else 0
           end
      from public.topic_access a where a.topic_id = topic and a.team_id is not null
  ) ranks;
$$;

grant execute on function public.board_capability(uuid) to authenticated;
grant execute on function public.topic_capability(uuid) to authenticated;

-- Backfill the access list from the columns it replaces, before they are dropped.
insert into public.board_access (board_id, user_id, capability)
  select id, owner, 'owner' from public.boards where scope = 'personal' and owner is not null;
insert into public.board_access (board_id, team_id, capability)
  select id, team_id, 'viewer' from public.boards where scope = 'personal' and shared = true and team_id is not null;
insert into public.board_access (board_id, team_id, capability)
  select id, team_id, 'owner' from public.boards where scope = 'team' and author_locked = false;
insert into public.board_access (board_id, team_id, capability)
  select id, team_id, 'viewer' from public.boards where scope = 'team' and author_locked = true;
insert into public.board_access (board_id, user_id, capability)
  select id, owner, 'owner' from public.boards where scope = 'team' and author_locked = true and owner is not null;

insert into public.topic_access (topic_id, user_id, capability)
  select id, owner, 'owner' from public.topics where scope = 'personal' and owner is not null;
insert into public.topic_access (topic_id, team_id, capability)
  select id, team_id, 'owner' from public.topics where scope = 'team';

-- Retire the old policies and the board guard before dropping the columns they read.
drop policy boards_select on public.boards;
drop policy boards_insert on public.boards;
drop policy boards_update on public.boards;
drop policy boards_delete on public.boards;
drop policy topics_select on public.topics;
drop policy topics_insert on public.topics;
drop policy topics_update on public.topics;
drop policy topics_delete on public.topics;
drop trigger boards_guards on public.boards;

-- `owner` becomes `created_by`, a pure attribution label. Drop the placement/access columns and the
-- constraints that read them. Boards lose their home team entirely (placement is the access list now);
-- topics keep team_id as a home anchor for the tree and slug uniqueness.
alter table public.boards drop constraint boards_team_scope;
alter table public.topics drop constraint topics_team_scope;
alter table public.boards rename column owner to created_by;
alter table public.topics rename column owner to created_by;
alter table public.boards drop column scope, drop column shared, drop column author_locked, drop column team_id;
alter table public.topics drop column scope;

-- Topic slugs stay unique per home space: a team topic by its team, a personal topic by its creator.
drop index public.topics_team_slug_key;
drop index public.topics_personal_slug_key;
create unique index topics_home_slug_key on public.topics (coalesce(team_id, created_by), slug);

-- boards/topics: read with any capability, write with editor or owner. A normal delete is never a hard
-- delete (it is the archive trigger below); only an admin force-deletes the row. Insert stamps the creator.
create policy boards_select on public.boards for select to authenticated
  using (public.board_capability(id) is not null);
create policy boards_insert on public.boards for insert to authenticated
  with check (created_by = auth.uid());
create policy boards_update on public.boards for update to authenticated
  using (public.capability_rank(public.board_capability(id)) >= 2)
  with check (public.capability_rank(public.board_capability(id)) >= 2);
create policy boards_delete on public.boards for delete to authenticated
  using (public.is_admin());

create policy topics_select on public.topics for select to authenticated
  using (public.topic_capability(id) is not null);
create policy topics_insert on public.topics for insert to authenticated
  with check (created_by = auth.uid());
create policy topics_update on public.topics for update to authenticated
  using (public.capability_rank(public.topic_capability(id)) >= 2)
  with check (public.capability_rank(public.topic_capability(id)) >= 2);
create policy topics_delete on public.topics for delete to authenticated
  using (public.is_admin());

-- The access list itself: read it if you can read the content; change it only if you own the content (or
-- are bootstrapping the first grant as its creator); always remove your own grant (leave). A team grant may
-- only target a team you coach, so a board cannot be dumped into an arbitrary team's library.
alter table public.board_access enable row level security;
create policy board_access_select on public.board_access for select to authenticated
  using (public.board_capability(board_id) is not null);
create policy board_access_insert on public.board_access for insert to authenticated
  with check (
    (
      public.capability_rank(public.board_capability(board_id)) >= 3
      or (select created_by from public.boards b where b.id = board_id) = auth.uid()
    )
    and (team_id is null or public.is_team_coach(team_id) or public.is_admin())
  );
create policy board_access_update on public.board_access for update to authenticated
  using (public.capability_rank(public.board_capability(board_id)) >= 3)
  with check (public.capability_rank(public.board_capability(board_id)) >= 3);
create policy board_access_delete on public.board_access for delete to authenticated
  using (public.capability_rank(public.board_capability(board_id)) >= 3 or user_id = auth.uid());

alter table public.topic_access enable row level security;
create policy topic_access_select on public.topic_access for select to authenticated
  using (public.topic_capability(topic_id) is not null);
create policy topic_access_insert on public.topic_access for insert to authenticated
  with check (
    (
      public.capability_rank(public.topic_capability(topic_id)) >= 3
      or (select created_by from public.topics t where t.id = topic_id) = auth.uid()
    )
    and (team_id is null or public.is_team_coach(team_id) or public.is_admin())
  );
create policy topic_access_update on public.topic_access for update to authenticated
  using (public.capability_rank(public.topic_capability(topic_id)) >= 3)
  with check (public.capability_rank(public.topic_capability(topic_id)) >= 3);
create policy topic_access_delete on public.topic_access for delete to authenticated
  using (public.capability_rank(public.topic_capability(topic_id)) >= 3 or user_id = auth.uid());

-- Reference counting: when a content row loses its last grant, grace-archive it. The existence guard skips a
-- board/topic that is itself being hard-deleted (purge cascades its grants away), so the trigger never races
-- the delete that triggered it.
create function public.archive_orphaned_board() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.boards where id = old.board_id and deleted_at is null)
     and not exists (select 1 from public.board_access where board_id = old.board_id) then
    update public.boards set deleted_at = now(), deleted_by = auth.uid() where id = old.board_id;
  end if;
  return old;
end;
$$;

create trigger board_access_archive after delete on public.board_access
for each row execute function public.archive_orphaned_board();

create function public.archive_orphaned_topic() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.topics where id = old.topic_id and deleted_at is null)
     and not exists (select 1 from public.topic_access where topic_id = old.topic_id) then
    update public.topics set deleted_at = now(), deleted_by = auth.uid() where id = old.topic_id;
  end if;
  return old;
end;
$$;

create trigger topic_access_archive after delete on public.topic_access
for each row execute function public.archive_orphaned_topic();

-- The board guard now only keeps the creator label immutable (an admin may reassign or null it). The author
-- lock it used to enforce is gone.
create function public.enforce_board_guards() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by and new.created_by is not null and not public.is_admin() then
    raise exception 'creator cannot be changed';
  end if;
  return new;
end;
$$;

create trigger boards_guards before update on public.boards
for each row execute function public.enforce_board_guards();

-- Resolve a board from its share token, for a visitor with no account. Only a genuinely shared board
-- resolves: one with a team grant, or a grant to a user other than its creator. A private personal board
-- (only its creator's grant) never resolves, so the collection cannot be enumerated.
create or replace function public.board_by_token(token text) returns setof public.boards
language sql stable security definer set search_path = '' as $$
  select b.* from public.boards b
  where b.share_token = token and b.deleted_at is null
    and exists (
      select 1 from public.board_access a
      where a.board_id = b.id and (a.team_id is not null or a.user_id is distinct from b.created_by)
    );
$$;

-- Soft-delete a topic subtree, authorized by the owner capability now (admin, a coach of an owning team, or
-- a personal owner all resolve to owner through topic_capability). Member boards are untouched.
create or replace function public.soft_delete_topic(root uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
begin
  if not exists (select 1 from public.topics where id = root) then
    return;
  end if;
  if public.capability_rank(public.topic_capability(root)) < 3 then
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
end;
$$;

notify pgrst, 'reload schema';
