-- VolleyCoach — sharing with someone outside your teams.
-- Two owner-only paths grant access to a user who is not a teammate, neither enumerating accounts nor
-- revealing an email:
--   * a grant link: a single-use, expiring, revocable token carrying a board/note and a capability,
--     redeemed by the first signed-in user, who receives the grant on their own account;
--   * an exact-email grant: the owner names a full address and the server grants it to the one matching
--     account, if any, returning nothing either way so a miss is indistinguishable from a hit.
-- The link mechanics mirror invites (server-minted token, validity-gated preview, atomic single-use
-- claim). Redemption is a security-definer RPC rather than an Edge Function: the redeemer is already
-- signed in, so no account is created and the grant is written under the definer's rights.

create table public.access_links (
  token text primary key,
  board_id uuid references public.boards (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete cascade,
  capability text not null check (capability in ('viewer', 'editor', 'owner')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id),
  constraint access_links_one_target check ((board_id is null) <> (topic_id is null))
);

create index access_links_board_idx on public.access_links (board_id) where board_id is not null;
create index access_links_topic_idx on public.access_links (topic_id) where topic_id is not null;

-- Mint the token server-side, mirroring set_invite_token / set_share_token.
create function public.set_access_link_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.token is null or new.token = '' then
    new.token := encode(extensions.gen_random_bytes(16), 'hex');
  end if;
  return new;
end;
$$;

create trigger access_links_token before insert on public.access_links
for each row execute function public.set_access_link_token();

grant select, insert, delete on public.access_links to authenticated;
grant select, insert, update, delete on public.access_links to service_role;

-- Only an owner of the target content mints, lists, or revokes its links. There is no authenticated
-- update path, so a member can never reset or reuse a spent link; redemption marks it used through the
-- security-definer RPC below, which bypasses RLS.
alter table public.access_links enable row level security;

create policy access_links_select on public.access_links for select to authenticated
using (
  public.is_admin()
  or (board_id is not null and public.capability_rank(public.board_capability(board_id)) >= 3)
  or (topic_id is not null and public.capability_rank(public.topic_capability(topic_id)) >= 3)
);

create policy access_links_insert on public.access_links for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    (board_id is not null and public.capability_rank(public.board_capability(board_id)) >= 3)
    or (topic_id is not null and public.capability_rank(public.topic_capability(topic_id)) >= 3)
  )
);

create policy access_links_delete on public.access_links for delete to authenticated
using (
  public.is_admin()
  or (board_id is not null and public.capability_rank(public.board_capability(board_id)) >= 3)
  or (topic_id is not null and public.capability_rank(public.topic_capability(topic_id)) >= 3)
);

-- Preview a link for its holder before redeeming: the content kind, its title, and the capability, but
-- only while the link is still valid. A spent or expired token (or deleted content) returns no row, so
-- it reveals nothing and the collection cannot be enumerated — the same shape as invite_preview.
create function public.access_link_preview(link_token text)
returns table (kind text, title text, capability text)
language sql stable security definer set search_path = '' as $$
  select
    case when l.board_id is not null then 'board' else 'note' end,
    coalesce(b.title, t.title),
    l.capability
  from public.access_links l
  left join public.boards b on b.id = l.board_id and b.deleted_at is null
  left join public.topics t on t.id = l.topic_id and t.deleted_at is null
  where l.token = link_token
    and l.used_at is null
    and l.expires_at > now()
    and coalesce(b.id, t.id) is not null;
$$;

grant execute on function public.access_link_preview(text) to authenticated;

-- Redeem a link as the signed-in caller: claim it atomically (only a still-valid token flips to used,
-- and only one racing caller wins), then grant the caller the carried capability. A board grant is one
-- row; a note grant spans the subtree, one row per node, so reads stay non-recursive. An existing grant
-- is left as is. Returns the content the caller now holds, so the client can open it.
create function public.redeem_access_link(link_token text)
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
    insert into public.board_access (board_id, user_id, capability)
      values (claimed.board_id, uid, claimed.capability)
      on conflict do nothing;
  else
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

grant execute on function public.redeem_access_link(text) to authenticated;

-- Grant a board to the one account matching an exact email, if any. The owner check runs first and is
-- independent of whether the email resolves, so this is not an account-existence oracle: it returns
-- nothing whether it matched or not, and never the email. Self and existing grants fall to a no-op.
create function public.grant_board_by_email(board uuid, addr text, cap text) returns void
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
      on conflict do nothing;
  end if;
end;
$$;

create function public.grant_topic_by_email(root uuid, addr text, cap text) returns void
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
      on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.grant_board_by_email(uuid, text, text) to authenticated;
grant execute on function public.grant_topic_by_email(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
