-- VolleyVector — pre-launch access, lifecycle, and validation hardening.
-- Five database fixes, each closing a gap the access-list model left open:
--   1. The access-list UPDATE policies skip the team-coach guard the INSERT policies carry, so an owner
--      could repoint a grant onto a team they do not coach. Carry the same guard on UPDATE.
--   2. topics.team_id cascades on team delete, so purging a team hard-deletes the notes it anchored —
--      including notes shared out to other principals. Switch to set null so a purge nulls the anchor and
--      the reference-count trigger grace-archives only the now-orphaned notes, matching board behaviour.
--   3. The three outside-team grant paths insert with `on conflict do nothing`, so a recipient who already
--      holds a lower grant is never upgraded yet the call reports success (burning a single-use link).
--      Upgrade-or-grant: raise the capability when the new one outranks the existing.
--   4. commit_topic stores content->>'slug' verbatim, so a direct RPC call could persist an empty or
--      malformed slug. Slugify and reject an empty slug server-side, mirroring src/routing/slug.ts.
--   5. enforce_board_guards only raises when the new creator is non-null, so an editor may null created_by.
--      Forbid any non-admin change to created_by, including to null.

-- ---------------------------------------------------------------------------
-- 1. Access-list UPDATE: carry the team-coach guard the INSERT policies have.
-- ---------------------------------------------------------------------------
drop policy board_access_update on public.board_access;
create policy board_access_update on public.board_access for update to authenticated
  using (public.capability_rank(public.board_capability(board_id)) >= 3)
  with check (
    public.capability_rank(public.board_capability(board_id)) >= 3
    and (team_id is null or public.is_team_coach(team_id) or public.is_admin())
  );

drop policy topic_access_update on public.topic_access;
create policy topic_access_update on public.topic_access for update to authenticated
  using (public.capability_rank(public.topic_capability(topic_id)) >= 3)
  with check (
    public.capability_rank(public.topic_capability(topic_id)) >= 3
    and (team_id is null or public.is_team_coach(team_id) or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- 2. topics.team_id: set null on team delete, so a purge does not hard-delete an anchored note.
-- ---------------------------------------------------------------------------
-- A purge first hard-deletes grace-archived topics, then deletes the team. Any topic still anchored to the
-- team at that point is one shared out to another principal that outlived the team's own archive: nulling
-- its anchor keeps it alive, and the cascading topic_access team-grant deletion fires archive_orphaned_topic,
-- which grace-archives only a note with no remaining grant. A surviving note keeps every other grant.
alter table public.topics drop constraint topics_team_id_fkey;
alter table public.topics add constraint topics_team_id_fkey
  foreign key (team_id) references public.teams (id) on delete set null;

-- The home-slug uniqueness key is coalesce(team_id, created_by), slug. After a team-wide set-null an
-- anchored note keys on its creator instead, so it could collide with a live sibling that creator already
-- keys on the same slug. Exclude grace-archived rows from the key so an archived sibling never blocks the
-- set-null; a residual collision between two live notes of one creator is a narrow, separately-tracked risk
-- (see Implementation Notes / Follow-ups), not widened here.
drop index public.topics_home_slug_key;
create unique index topics_home_slug_key
  on public.topics (coalesce(team_id, created_by), slug) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. Outside-team grants upgrade-or-grant instead of silently no-opping on an existing lower grant.
-- ---------------------------------------------------------------------------
-- redeem_access_link keeps the deleted-target guard from 20260617155801; only the conflict resolution
-- changes, from `do nothing` to a capability-raising `do update`, on both the board and the subtree path.
create or replace function public.redeem_access_link(link_token text)
returns table (board_id uuid, topic_id uuid)
language plpgsql security definer set search_path = '' as $$
-- The OUT columns board_id/topic_id share names with the access tables, so the on-conflict inference would
-- read them as variables; resolve an ambiguous bare name to the column.
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  claimed public.access_links;
begin
  if uid is null then
    raise exception 'must be signed in to redeem a link';
  end if;

  update public.access_links
    set used_at = now(), used_by = uid
    where token = link_token and used_at is null and expires_at > now()
    returning * into claimed;

  if claimed.token is null then
    raise exception 'This link is no longer valid.';
  end if;

  if claimed.board_id is not null then
    if not exists (select 1 from public.boards where id = claimed.board_id and deleted_at is null) then
      raise exception 'This link is no longer valid.';
    end if;

    insert into public.board_access (board_id, user_id, capability)
      values (claimed.board_id, uid, claimed.capability)
      on conflict (board_id, user_id) where user_id is not null
        do update set capability = excluded.capability
        where public.capability_rank(excluded.capability) > public.capability_rank(public.board_access.capability);
  else
    if not exists (select 1 from public.topics where id = claimed.topic_id and deleted_at is null) then
      raise exception 'This link is no longer valid.';
    end if;

    insert into public.topic_access (topic_id, user_id, capability)
      select s.id, uid, claimed.capability
      from (
        with recursive subtree as (
          select id from public.topics where id = claimed.topic_id
          union all
          select c.id from public.topics c join subtree p on c.parent_id = p.id
        )
        select id from subtree
      ) s
      on conflict (topic_id, user_id) where user_id is not null
        do update set capability = excluded.capability
        where public.capability_rank(excluded.capability) > public.capability_rank(public.topic_access.capability);
  end if;

  return query select claimed.board_id, claimed.topic_id;
end;
$$;

create or replace function public.grant_board_by_email(board uuid, addr text, cap text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if public.capability_rank(public.board_capability(board)) < 3 then
    raise exception 'not allowed to share this board';
  end if;
  if cap not in ('viewer', 'editor', 'owner') then
    raise exception 'invalid capability';
  end if;

  select id into target from public.profiles
    where lower(email) = lower(trim(addr)) and deleted_at is null
    limit 1;

  if target is not null then
    insert into public.board_access (board_id, user_id, capability)
      values (board, target, cap)
      on conflict (board_id, user_id) where user_id is not null
        do update set capability = excluded.capability
        where public.capability_rank(excluded.capability) > public.capability_rank(public.board_access.capability);
  end if;
end;
$$;

create or replace function public.grant_topic_by_email(root uuid, addr text, cap text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if public.capability_rank(public.topic_capability(root)) < 3 then
    raise exception 'not allowed to share this note';
  end if;
  if cap not in ('viewer', 'editor', 'owner') then
    raise exception 'invalid capability';
  end if;

  select id into target from public.profiles
    where lower(email) = lower(trim(addr)) and deleted_at is null
    limit 1;

  if target is not null then
    insert into public.topic_access (topic_id, user_id, capability)
      select s.id, target, cap
      from (
        with recursive subtree as (
          select id from public.topics where id = root
          union all
          select c.id from public.topics c join subtree p on c.parent_id = p.id
        )
        select id from subtree
      ) s
      on conflict (topic_id, user_id) where user_id is not null
        do update set capability = excluded.capability
        where public.capability_rank(excluded.capability) > public.capability_rank(public.topic_access.capability);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. commit_topic: slugify and reject an empty slug, mirroring src/routing/slug.ts.
-- ---------------------------------------------------------------------------
-- The client folds a title to a slug (lowercase, accents stripped, non-alphanumeric runs hyphenated,
-- leading/trailing hyphens trimmed) and never persists an empty one. A direct RPC call must not bypass that.
-- Normalise the submitted slug the same way and reject it when it folds to nothing.
create or replace function public.normalize_slug(input text) returns text
language sql immutable set search_path = '' as $$
  select nullif(
    trim(both '-' from regexp_replace(
      lower(translate(coalesce(input, ''),
        'àáâäãåāèéêëēìíîïīòóôöõøōùúûüūçñýÿžšđ',
        'aaaaaaaeeeeeiiiiiooooooouuuuucnyyzsd')),
      '[^a-z0-9]+', '-', 'g')),
    '');
$$;

create or replace function public.commit_topic(topic uuid, content jsonb, base uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_rev uuid;
  new_rev uuid;
  clean_slug text := public.normalize_slug(content->>'slug');
begin
  if public.capability_rank(public.topic_capability(topic)) < 2 then
    raise exception 'not allowed to edit this topic';
  end if;
  if clean_slug is null then
    raise exception 'slug cannot be empty';
  end if;

  select current_revision_id into current_rev from public.topics where id = topic for update;
  if not found then
    raise exception 'topic not found';
  end if;
  if current_rev is distinct from base then
    return null;
  end if;

  update public.topics set
    title = content->>'title',
    slug = clean_slug,
    blocks = content->'blocks'
  where id = topic;

  insert into public.topic_revisions (topic_id, content, created_by, base_revision_id)
    values (topic, content || jsonb_build_object('slug', clean_slug), auth.uid(), base) returning id into new_rev;
  update public.topics set current_revision_id = new_rev where id = topic;
  return new_rev;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. enforce_board_guards: a non-admin may not change created_by at all, including to null.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_board_guards() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by and not public.is_admin() then
    raise exception 'creator cannot be changed';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
