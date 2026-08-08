-- Per-board opponent half: off by default, so every existing board stays a half-court board. Marker
-- sides need no migration (they nest in the existing markers jsonb), and no new grant or policy is
-- required, because the table-level grants already cover new columns and no RLS rule references it.

alter table public.boards add column opponent_side boolean not null default false;

-- commit_board unpacks the content snapshot into the board's columns, so it has to carry the new one.
-- A client running the previous bundle commits content without the key, and a bare cast would write
-- null into a not-null column, so the coalesce keeps that commit landing as a half-court board.
create or replace function public.commit_board(board uuid, content jsonb, base uuid) returns uuid
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
    rotation_strict = (content->>'rotation_strict')::boolean,
    opponent_side = coalesce((content->>'opponent_side')::boolean, false)
  where id = board;

  insert into public.board_revisions (board_id, content, created_by, base_revision_id)
    values (board, content, auth.uid(), base) returning id into new_rev;
  update public.boards set current_revision_id = new_rev where id = board;
  return new_rev;
end;
$$;

notify pgrst, 'reload schema';
