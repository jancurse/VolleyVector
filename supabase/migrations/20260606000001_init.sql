-- VolleyCoach Phase 2 — schema.
-- Boards and topics move out of localStorage into Supabase. Accounts are organised into teams; every
-- board and topic lives in exactly one space: a team's shared library, or a user's personal workspace.
-- This migration creates the tables, the triggers that keep them honest, and the API grants. Row-level
-- security (the access boundary) lives in the next migration; nothing here is reachable until it runs.

create extension if not exists pgcrypto with schema extensions;

-- One row per auth user. `is_admin` is the global-admin flag, orthogonal to team membership. It is
-- never settable through the Data API (no column grant below); it is bootstrapped by hand and changed
-- only via the admin-only set_admin() RPC, so a user can never escalate themselves.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The single source of truth for who is in a team and as what. A user has at most one role per team.
create table public.memberships (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('coach', 'player')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- A topic: one node in the organising tree, carrying a document of blocks. `scope` + `team_id` place it
-- in a space. A team topic names its team; a personal topic does not. Membership of a board in a topic
-- lives on the board (topic_id), exactly as in Phase 1.
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles (id) on delete cascade,
  scope text not null check (scope in ('team', 'personal')),
  team_id uuid references public.teams (id) on delete cascade,
  title text not null default 'New topic',
  blocks jsonb not null default '[]'::jsonb,
  parent_id uuid references public.topics (id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topics_team_scope check (scope <> 'team' or team_id is not null)
);

-- A board: the Phase 1 Board with markers and steps as JSON, plus the placement and access columns.
-- `team_id` is the owning team for a team board, or the share target for a shared personal board.
-- `shared` and `share_token` drive Stage 2 sharing; `author_locked` is the per-board author lock.
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles (id) on delete cascade,
  scope text not null check (scope in ('team', 'personal')),
  team_id uuid references public.teams (id) on delete cascade,
  title text not null default 'Untitled board',
  description text not null default '',
  mode text not null default 'positions' check (mode in ('positions', 'basic')),
  markers jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  topic_id uuid references public.topics (id) on delete set null,
  shared boolean not null default false,
  author_locked boolean not null default false,
  share_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boards_team_scope check (scope <> 'team' or team_id is not null)
);

create index memberships_user_idx on public.memberships (user_id);
create index topics_team_idx on public.topics (team_id);
create index topics_owner_idx on public.topics (owner);
create index topics_parent_idx on public.topics (parent_id);
create index boards_team_idx on public.boards (team_id);
create index boards_owner_idx on public.boards (owner);
create index boards_topic_idx on public.boards (topic_id);

-- A profile is created automatically for every new auth user (invites included), so the app never has
-- to. SECURITY DEFINER with an empty search_path: it runs as the table owner and qualifies every name.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep updated_at authoritative on the server, so newest-edited ordering does not depend on the client.
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teams_updated_at before update on public.teams
for each row execute function public.set_updated_at();
create trigger topics_updated_at before update on public.topics
for each row execute function public.set_updated_at();
create trigger boards_updated_at before update on public.boards
for each row execute function public.set_updated_at();

-- Every board carries an unguessable share token, minted server-side so a client can neither choose nor
-- predict it. SECURITY DEFINER to reach pgcrypto regardless of the inserting role's privileges.
create function public.set_share_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.share_token is null then
    new.share_token := encode(extensions.gen_random_bytes(16), 'hex');
  end if;
  return new;
end;
$$;

create trigger boards_share_token before insert on public.boards
for each row execute function public.set_share_token();

-- The Data API role gets table access; row visibility is then governed entirely by RLS in the next
-- migration. "Automatically expose new tables" is off, so access is granted deliberately, here.
-- profiles is read-only to clients except display_name, so is_admin can never be set through the API.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.boards to authenticated;
grant select, insert, update, delete on public.topics to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

notify pgrst, 'reload schema';
