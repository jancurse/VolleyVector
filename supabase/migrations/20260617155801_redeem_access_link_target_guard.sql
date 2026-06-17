-- VolleyCoach — guard grant-link redemption against a deleted or missing target.
-- redeem_access_link claimed the single-use link and wrote the grant without checking the target board or
-- note still exists and is not archived, mirroring its access_link_preview sibling. A link minted before
-- the owner deletes the content could still be consumed, leaving a stray grant that an admin restore within
-- the 3-month window would silently revive. Reject the redeem when the target is missing or grace-archived;
-- the raised exception rolls back the claiming update, so used_at stays null and the link is still
-- redeemable if the target is later restored. The return shape is unchanged.
create or replace function public.redeem_access_link(link_token text)
returns table (board_id uuid, topic_id uuid)
language plpgsql security definer set search_path = '' as $$
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
      on conflict do nothing;
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
      on conflict do nothing;
  end if;

  return query select claimed.board_id, claimed.topic_id;
end;
$$;

notify pgrst, 'reload schema';
