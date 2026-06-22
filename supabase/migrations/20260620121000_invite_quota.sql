-- VolleyVector — invite quota and open team creation.
-- Separates account creation (the scarce, quota-gated resource) from team membership and team creation
-- (cheap, ungated). A per-account invite quota governs how many brand-new accounts an account may bring
-- into existence; invite links are typed at mint (may create an account, may grant quota, may join a
-- team) in any combination; and every account may create a team through a server RPC.
--
-- The core invariant: only an admin can expand total onboarding capacity. A non-admin only ever spends
-- from a quota an admin granted, and can never grant quota to anyone. Enforced server-side here (a mint
-- trigger and SECURITY DEFINER RPCs), never only in the client.

-- ---------------------------------------------------------------------------
-- Schema: the quota column and the typed-invite columns.
-- ---------------------------------------------------------------------------

-- How many new accounts this account may bring into existence (before subtracting its live and spent
-- links). Not in the authenticated column grant, so it is neither selectable nor settable through the
-- Data API: it is written only by the admin-only set_invite_quota() and read only through the RPCs below.
alter table public.profiles add column invite_quota int not null default 0;

-- A link now carries up to three independent grants. team_id/role go null for a team-less link (onboards
-- an account into its personal space only); allows_new_account is the only quota-consuming grant;
-- grant_quota is added to the redeemer's own quota at redemption; created_account records that a
-- redemption actually created an account, so that link spends the inviter's slot rather than releasing it.
alter table public.invites
  alter column team_id drop not null,
  alter column role drop not null,
  add column allows_new_account boolean not null default true,
  add column created_account boolean not null default false,
  add column grant_quota int not null default 0;

-- A team membership needs a role, and a team-less link carries neither.
alter table public.invites
  add constraint invites_team_role check ((team_id is null) = (role is null));

-- ---------------------------------------------------------------------------
-- Quota RPCs.
-- ---------------------------------------------------------------------------

-- Only an admin may set a quota, mirroring set_admin: quota is capacity created from nothing, so a
-- non-admin can never raise anyone's, their own included.
create function public.set_invite_quota(target uuid, value int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may set an invite quota';
  end if;
  update public.profiles set invite_quota = value where id = target;
end;
$$;

grant execute on function public.set_invite_quota(uuid, int) to authenticated;

-- An account's remaining invite slots, derived entirely from the invites table so release is automatic
-- (no stored counter to decrement or refund). available = invite_quota − used, where a used slot is an
-- account-creation link the account minted that is either live and unredeemed (reserved) or redeemed into
-- an actual account (spent). An account-creation link redeemed by someone who already has an account
-- (created_account stays false) counts as neither, so its slot is released. Restricted to the trusted
-- callers below, since otherwise it is a quota oracle on any account.
create function public.invite_available(target uuid) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select invite_quota from public.profiles where id = target), 0)
    - (select count(*)::int from public.invites
       where created_by = target and allows_new_account
         and (created_account or (used_at is null and expires_at > now())));
$$;

revoke all on function public.invite_available(uuid) from public;
grant execute on function public.invite_available(uuid) to service_role;

-- The caller's own remaining invites, for the invite dialog's quota display and account-creation toggle.
-- An admin is unlimited (null).
create function public.invite_availability() returns int
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then null else public.invite_available(auth.uid()) end;
$$;

grant execute on function public.invite_availability() to authenticated;

-- Add to an account's quota atomically (the additive grant a redeemed quota link applies). Restricted to
-- the service role (the redeem Edge Function), so no authenticated path can raise a quota except the
-- admin-only set_invite_quota above — the core invariant.
create function public.add_invite_quota(target uuid, amount int) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set invite_quota = invite_quota + amount where id = target;
$$;

revoke all on function public.add_invite_quota(uuid, int) from public;
grant execute on function public.add_invite_quota(uuid, int) to service_role;

-- The admin Accounts list gains each account's quota, read through this RPC since the column is not
-- selectable. Recreated rather than replaced, because the return signature changes.
drop function public.admin_list_profiles();
create function public.admin_list_profiles()
returns table (id uuid, email text, display_name text, is_admin boolean, invite_quota int, deleted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.email, p.display_name, p.is_admin, p.invite_quota, p.deleted_at
  from public.profiles p
  where public.is_admin();
$$;

grant execute on function public.admin_list_profiles() to authenticated;

-- ---------------------------------------------------------------------------
-- Typed invite links: the mint guard, the preview, and the policies.
-- ---------------------------------------------------------------------------

-- Quota and grant guard at mint, alongside set_invite_token. An admin is unlimited and is the only role
-- that may mint a quota-granting link; a non-admin may mint an account-creation link only with a slot to
-- spend. Runs before the row exists, so it never counts the link it is checking.
create function public.enforce_invite_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.grant_quota > 0 then
    raise exception 'only an admin may grant invite quota';
  end if;
  if new.allows_new_account and public.invite_available(new.created_by) < 1 then
    raise exception 'no invite quota available';
  end if;
  return new;
end;
$$;

create trigger invites_quota before insert on public.invites
for each row execute function public.enforce_invite_quota();

-- invite_preview now reveals every right a still-valid link carries (a nullable team, a quota grant,
-- account creation), so the accept screen can describe a team-less or quota-only link. Recreated for the
-- new return signature; the validity rules (unused, unexpired) are unchanged.
drop function public.invite_preview(text);
create function public.invite_preview(invite_token text)
returns table (allows_new_account boolean, grant_quota int, team_name text, role text)
language sql stable security definer set search_path = '' as $$
  select i.allows_new_account, i.grant_quota, t.name, i.role
  from public.invites i
  left join public.teams t on t.id = i.team_id
  where i.token = invite_token
    and i.used_at is null
    and i.expires_at > now();
$$;

grant execute on function public.invite_preview(text) to anon, authenticated;

-- A team-less link needs no team coaching; a team link still does. The creator and an admin list and
-- revoke their own links (a team coach also sees the team's). The quota and grant rules live in the
-- mint trigger above, not in this policy.
drop policy invites_insert on public.invites;
create policy invites_insert on public.invites for insert to authenticated
with check (
  created_by = auth.uid()
  and (team_id is null or public.is_team_coach(team_id) or public.is_admin())
);

drop policy invites_select on public.invites;
create policy invites_select on public.invites for select to authenticated
using (created_by = auth.uid() or public.is_team_coach(team_id) or public.is_admin());

drop policy invites_delete on public.invites;
create policy invites_delete on public.invites for delete to authenticated
using (created_by = auth.uid() or public.is_team_coach(team_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Open team creation.
-- ---------------------------------------------------------------------------

-- Every account creates teams through this one path: it inserts the team and the creator's coach
-- membership together, bypassing the admin-only teams_insert policy (this RPC is the creation path; that
-- policy is not, and stays as is). A slug collision retries with a short random suffix. Adding existing
-- accounts to a team stays a coach/admin action through the unchanged memberships policies.
create function public.create_team(name text, slug text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  creator uuid := auth.uid();
  candidate text := slug;
  attempt int := 0;
  new_id uuid;
begin
  if creator is null then
    raise exception 'must be signed in to create a team';
  end if;

  loop
    begin
      insert into public.teams (name, slug) values (name, candidate) returning id into new_id;
      exit;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 5 then raise; end if;
      candidate := slug || '-' || substr(md5(random()::text), 1, 4);
    end;
  end loop;

  insert into public.memberships (team_id, user_id, role) values (new_id, creator, 'coach');
  return new_id;
end;
$$;

grant execute on function public.create_team(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed.
-- ---------------------------------------------------------------------------

-- Grant a starting invite quota to two specific accounts (by profile id).
update public.profiles set invite_quota = 100
where id in ('780f72f3-e3bf-4f51-ad80-31e51eccc03e', '9acba3b8-5a8b-4ff5-9582-bc3de13fe426');

notify pgrst, 'reload schema';
