-- VolleyVector — multi-use invite links.
-- An invite link was usable exactly once, so onboarding a whole team meant minting one link per player.
-- A link now carries a use count: `max_uses` redemptions, `uses` of them spent. Single use is just
-- max_uses = 1, the default, so every existing link and the email-invite path behave as before.
--
-- Quota accounting follows the same reserve-then-settle shape as before, scaled to the count. A live
-- account-creation link reserves all of its uses; once it expires (or runs out) it charges only the
-- accounts it actually created, so unused capacity is released with no counter to refund. A quota grant
-- on a link applies per redemption: each person who signs up through it receives it.
--
-- Redemption moves from a PostgREST update to `claim_invite`, because an atomic claim is now an
-- increment rather than a flag flip. The claim, its release, and the created-account tally are the only
-- writes to `uses`/`created_accounts`, all service-role-only, so a client can neither reopen a spent
-- link nor forge a redemption.

-- ---------------------------------------------------------------------------
-- Schema: the use counters replace the single-use flags.
-- ---------------------------------------------------------------------------

alter table public.invites
  add column max_uses int not null default 1 check (max_uses between 1 and 1000),
  add column uses int not null default 0,
  add column created_accounts int not null default 0;

update public.invites
set uses = 1, created_accounts = case when created_account then 1 else 0 end
where used_at is not null;

alter table public.invites
  drop column used_at,
  drop column used_by,
  drop column created_account,
  add constraint invites_uses check (uses between 0 and max_uses),
  add constraint invites_created_accounts check (created_accounts between 0 and uses);

-- ---------------------------------------------------------------------------
-- Quota: reserve every use of a live link, charge only the accounts a spent one created.
-- ---------------------------------------------------------------------------

-- Availability stays derived from the invites table, so expiry releases unused capacity on its own. A
-- link still redeemable reserves its whole `max_uses`; one that has expired or run out charges the
-- accounts it created, which is what it actually spent.
create or replace function public.invite_available(target uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select invite_quota from public.profiles where id = target), 0)
    - coalesce(
        (select sum(case
                      when i.uses < i.max_uses and i.expires_at > now() then i.max_uses
                      else i.created_accounts
                    end)
         from public.invites i
         where i.created_by = target and i.allows_new_account),
        0)::int;
$$;

-- The mint guard now costs a link its whole use count, and owns the counters outright: a client may pass
-- neither, so an insert can never mint a link that starts out spent (and so charges nothing).
create or replace function public.enforce_invite_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.uses := 0;
  new.created_accounts := 0;

  if public.is_admin() then
    return new;
  end if;
  if new.grant_quota > 0 then
    raise exception 'only an admin may grant invite quota';
  end if;
  if new.allows_new_account and public.invite_available(new.created_by) < new.max_uses then
    raise exception 'no invite quota available';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Redemption: claim, release, and tally, all service-role-only.
-- ---------------------------------------------------------------------------

-- Claim one use atomically. Two people racing the last use of a link serialize on the row, and the loser
-- re-reads `uses` after the winner commits, so the claim returns no row and exactly one wins. Returning
-- the whole row keeps the redeem function reading the same fields as the update it replaces.
create function public.claim_invite(invite_token text) returns setof public.invites
language sql security definer set search_path = '' as $$
  update public.invites i set uses = i.uses + 1
  where i.token = invite_token and i.uses < i.max_uses and i.expires_at > now()
  returning i.*;
$$;

-- Give a claimed use back when a redemption rolls back, so a failed attempt costs the link nothing. The
-- floor is the accounts already created, which each hold a use of their own and must keep it.
create function public.release_invite(invite_token text) returns void
language sql security definer set search_path = '' as $$
  update public.invites set uses = greatest(uses - 1, created_accounts) where token = invite_token;
$$;

-- Record that a redemption created an account, which is what a spent link ultimately charges its minter.
create function public.record_invite_account(invite_token text) returns void
language sql security definer set search_path = '' as $$
  update public.invites set created_accounts = created_accounts + 1 where token = invite_token;
$$;

revoke all on function public.claim_invite(text) from public;
revoke all on function public.release_invite(text) from public;
revoke all on function public.record_invite_account(text) from public;
grant execute on function public.claim_invite(text) to service_role;
grant execute on function public.release_invite(text) to service_role;
grant execute on function public.record_invite_account(text) to service_role;

-- A link previews as valid while it has a use left and has not expired; the rights it reveals are
-- unchanged. Replaced in place, since only the validity test moves from the spent flag to the counter.
create or replace function public.invite_preview(invite_token text)
returns table (allows_new_account boolean, grant_quota int, team_name text, role text)
language sql stable security definer set search_path = '' as $$
  select i.allows_new_account, i.grant_quota, t.name, i.role
  from public.invites i
  left join public.teams t on t.id = i.team_id
  where i.token = invite_token
    and i.uses < i.max_uses
    and i.expires_at > now();
$$;

notify pgrst, 'reload schema';
