-- VolleyVector — edit history and conflict detection for boards and topics.
-- Every commit (the editor's Done) appends a full content snapshot as a revision, and a board/topic points
-- at its current revision. Committing is a compare-and-swap: the caller passes the revision it started from,
-- and the write only lands when that is still current; otherwise the caller resolves the conflict (overwrite,
-- save a copy, or discard). History is linear and append-only — restoring an old revision commits its content
-- as a new revision rather than rewinding. No branching or merging.

create table public.board_revisions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  content jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  base_revision_id uuid references public.board_revisions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.topic_revisions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  content jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  base_revision_id uuid references public.topic_revisions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index board_revisions_board_idx on public.board_revisions (board_id, created_at);
create index topic_revisions_topic_idx on public.topic_revisions (topic_id, created_at);

alter table public.boards add column current_revision_id uuid;
alter table public.topics add column current_revision_id uuid;
alter table public.boards add constraint boards_current_revision_fkey
  foreign key (current_revision_id) references public.board_revisions (id) on delete set null;
alter table public.topics add constraint topics_current_revision_fkey
  foreign key (current_revision_id) references public.topic_revisions (id) on delete set null;

-- History is read-only to clients: the snapshot writes go through the commit RPCs (security definer) and the
-- purge cascade runs as service_role. A revision is readable to anyone who can read its content.
grant select on public.board_revisions to authenticated;
grant select on public.topic_revisions to authenticated;
grant select, insert, update, delete on public.board_revisions to service_role;
grant select, insert, update, delete on public.topic_revisions to service_role;

alter table public.board_revisions enable row level security;
create policy board_revisions_select on public.board_revisions for select to authenticated
  using (public.board_capability(board_id) is not null);

alter table public.topic_revisions enable row level security;
create policy topic_revisions_select on public.topic_revisions for select to authenticated
  using (public.topic_capability(topic_id) is not null);

-- Seed one revision per existing row from its current content, and point each row at it, so the first real
-- commit has a base to compare against.
insert into public.board_revisions (board_id, content, created_by)
  select b.id,
    jsonb_build_object(
      'title', b.title, 'description', b.description, 'mode', b.mode,
      'markers', b.markers, 'steps', b.steps, 'tags', to_jsonb(b.tags),
      'auto_arrows', b.auto_arrows, 'rotation_strict', b.rotation_strict
    ),
    b.created_by
  from public.boards b;
update public.boards b set current_revision_id = r.id
  from public.board_revisions r where r.board_id = b.id;

insert into public.topic_revisions (topic_id, content, created_by)
  select t.id, jsonb_build_object('title', t.title, 'slug', t.slug, 'blocks', t.blocks), t.created_by
  from public.topics t;
update public.topics t set current_revision_id = r.id
  from public.topic_revisions r where r.topic_id = t.id;

-- Commit a board: enforce editor capability, compare-and-swap on the current revision, write the content
-- columns, append the snapshot, and advance the pointer. Returns the new revision id, or null when the base
-- is stale (a conflict the caller must resolve). Security definer so one round-trip is atomic; it checks the
-- caller's capability explicitly since it bypasses RLS.
create function public.commit_board(board uuid, content jsonb, base uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_rev uuid;
  new_rev uuid;
begin
  if public.capability_rank(public.board_capability(board)) < 2 then
    raise exception 'not allowed to edit this board';
  end if;

  select current_revision_id into current_rev from public.boards where id = board for update;
  if not found then
    raise exception 'board not found';
  end if;
  if current_rev is distinct from base then
    return null;
  end if;

  update public.boards set
    title = content->>'title',
    description = content->>'description',
    mode = content->>'mode',
    markers = content->'markers',
    steps = content->'steps',
    tags = coalesce((select array_agg(value) from jsonb_array_elements_text(content->'tags')), '{}'),
    auto_arrows = (content->>'auto_arrows')::boolean,
    rotation_strict = (content->>'rotation_strict')::boolean
  where id = board;

  insert into public.board_revisions (board_id, content, created_by, base_revision_id)
    values (board, content, auth.uid(), base) returning id into new_rev;
  update public.boards set current_revision_id = new_rev where id = board;
  return new_rev;
end;
$$;

create function public.commit_topic(topic uuid, content jsonb, base uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_rev uuid;
  new_rev uuid;
begin
  if public.capability_rank(public.topic_capability(topic)) < 2 then
    raise exception 'not allowed to edit this topic';
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
    slug = content->>'slug',
    blocks = content->'blocks'
  where id = topic;

  insert into public.topic_revisions (topic_id, content, created_by, base_revision_id)
    values (topic, content, auth.uid(), base) returning id into new_rev;
  update public.topics set current_revision_id = new_rev where id = topic;
  return new_rev;
end;
$$;

grant execute on function public.commit_board(uuid, jsonb, uuid) to authenticated;
grant execute on function public.commit_topic(uuid, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
