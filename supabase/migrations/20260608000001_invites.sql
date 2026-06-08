-- VolleyCoach Phase 2 — single-use invite links.
-- The existing invite path creates an account from an email and emails it. This adds a second path: a
-- coach mints an unguessable link, shares it however they like (WhatsApp, etc.), and the recipient signs
-- up with their own email and lands in the team. A link works exactly once and expires after 7 days.
--
-- The link is a row in `invites`. A coach or admin of the team creates and revokes them (RLS). The link
-- is redeemed server-side in the `redeem-invite` Edge Function under the secret key: it creates the
-- account (global sign-up stays disabled) and adds the membership, the same privileged work the `invite`
-- function already does. The only client-readable view of a token is `invite_preview`, which reveals the
-- team and role for a still-valid token and nothing for a spent or expired one.

create table public.invites (
  token text primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  role text not null check (role in ('coach', 'player')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id)
);

create index invites_team_idx on public.invites (team_id);

-- Mint the token server-side so a client can neither choose nor predict it, mirroring set_share_token.
-- SECURITY DEFINER to reach pgcrypto regardless of the inserting role's privileges; the BEFORE INSERT
-- timing fills the primary key before the not-null check.
create function public.set_invite_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.token is null or new.token = '' then
    new.token := encode(extensions.gen_random_bytes(16), 'hex');
  end if;
  return new;
end;
$$;

create trigger invites_token before insert on public.invites
for each row execute function public.set_invite_token();

-- Preview a link for a visitor with no account: the team name and role, but only while the link is still
-- valid (unused and unexpired). A spent or expired token returns no row, so it reveals nothing and the
-- collection cannot be enumerated — the same shape as board_by_token.
create or replace function public.invite_preview(invite_token text)
returns table (team_name text, role text)
language sql stable security definer set search_path = '' as $$
  select t.name, i.role
  from public.invites i
  join public.teams t on t.id = i.team_id
  where i.token = invite_token
    and i.used_at is null
    and i.expires_at > now();
$$;

grant execute on function public.invite_preview(text) to anon, authenticated;

-- The Data API role manages a team's links; the service role (the Edge Function) redeems them. Redeeming
-- is a privileged server action, so authenticated never updates an invite directly.
grant select, insert, delete on public.invites to authenticated;
grant select, insert, update, delete on public.invites to service_role;

-- invites: a coach of the team (or an admin) creates, lists, and revokes its links. Redemption marks the
-- row used under the secret key, which bypasses RLS. There is no authenticated update path, so a member
-- can never reset or reuse a spent link.
alter table public.invites enable row level security;

create policy invites_select on public.invites for select to authenticated
using (public.is_team_coach(team_id) or public.is_admin());

create policy invites_insert on public.invites for insert to authenticated
with check ((public.is_team_coach(team_id) or public.is_admin()) and created_by = auth.uid());

create policy invites_delete on public.invites for delete to authenticated
using (public.is_team_coach(team_id) or public.is_admin());

notify pgrst, 'reload schema';
