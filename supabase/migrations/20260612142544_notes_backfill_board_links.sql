-- Notes own their board links: a note's `boards` blocks are now the one source of truth for which
-- boards it references, and the client no longer reads or writes boards.topic_id. Before that column
-- goes dark, preserve every existing membership it still encodes: any board filed in a topic but not
-- yet referenced by one of its blocks gets appended in one trailing board-group block, ordered
-- newest-edited first to match the old member order. Soft-deleted boards are included on purpose: an
-- unresolvable id is dropped at render, and an admin restore puts the board straight back into its
-- note. The column itself stays for now (unread, unwritten) and can be dropped in a later cleanup.

with members as (
  select t.id as topic_id, b.id as board_id, b.updated_at
  from public.topics t
  join public.boards b on b.topic_id = t.id
  where not exists (
    select 1
    from jsonb_array_elements(t.blocks) blk
    where blk->>'kind' = 'boards'
      and blk->'boardIds' ? b.id::text
  )
),
grouped as (
  select topic_id, jsonb_agg(to_jsonb(board_id::text) order by updated_at desc) as ids
  from members
  group by topic_id
)
update public.topics t
set blocks = t.blocks || jsonb_build_array(
  jsonb_build_object('id', 'backfill-' || t.id::text, 'kind', 'boards', 'boardIds', g.ids)
)
from grouped g
where g.topic_id = t.id;
