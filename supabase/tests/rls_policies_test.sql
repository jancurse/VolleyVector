-- Row-level security tests for VolleyCoach.
--
-- Verifies the access boundary at the policy level, not just in the UI: team isolation, player
-- read-only access, the author lock on team boards, and admin override. Self-contained: it creates
-- throwaway users, teams, and boards, asserts each rule while impersonating each user, then rolls back,
-- so it leaves no trace. Run it in the Supabase SQL Editor.
--
-- Result: a single row "ALL RLS TESTS PASSED" means every policy holds; an error beginning "FAIL ..."
-- names the rule that is broken.
--
-- Impersonation: each section sets the role to `authenticated` and a JWT `sub` claim, so auth.uid() and
-- the policies behave exactly as they do for that signed-in user.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures (created as the table owner, which bypasses RLS).
-- Inserting into auth.users fires on_auth_user_created, which creates each profile.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-admin@test.local',  '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-coachA@test.local', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rls-coachA2@test.local','', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rls-playerA@test.local','', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'rls-coachB@test.local', '', now(), now(), now(), '', '', '', '');

-- admin: the global flag, and deliberately no team membership (so god-mode is tested without a team).
update public.profiles set is_admin = true where id = 'a0000000-0000-0000-0000-000000000001';

insert into public.teams (id, name) values
  ('b0000000-0000-0000-0000-00000000000a', 'RLS Team A'),
  ('b0000000-0000-0000-0000-00000000000b', 'RLS Team B');

insert into public.memberships (team_id, user_id, role) values
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', 'coach'),  -- coachA
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000003', 'coach'),  -- coachA2
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000004', 'player'), -- playerA
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000005', 'coach');  -- coachB

insert into public.boards (id, owner, scope, team_id, title, author_locked) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'team', 'b0000000-0000-0000-0000-00000000000a', 'Board A',        false),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'team', 'b0000000-0000-0000-0000-00000000000a', 'Board A locked', true),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 'team', 'b0000000-0000-0000-0000-00000000000b', 'Board B',        false);

-- ---------------------------------------------------------------------------
-- 1. Team isolation: a coach of team B can neither read nor write team A's boards.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
do $$
declare n int; denied boolean := false;
begin
  select count(*) into n from public.boards where team_id = 'b0000000-0000-0000-0000-00000000000a';
  if n <> 0 then raise exception 'FAIL team isolation (read): coach B saw % team A board(s), expected 0', n; end if;

  begin
    insert into public.boards (owner, scope, team_id, title)
    values ('a0000000-0000-0000-0000-000000000005', 'team', 'b0000000-0000-0000-0000-00000000000a', 'intruder');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'FAIL team isolation (write): coach B inserted a board into team A'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 2. Player read-only: a player reads their team's boards but cannot update or insert them.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
declare n int; updated int; denied boolean := false;
begin
  select count(*) into n from public.boards where team_id = 'b0000000-0000-0000-0000-00000000000a';
  if n < 2 then raise exception 'FAIL player read: player saw % team A board(s), expected >= 2', n; end if;

  update public.boards set title = 'player edit' where id = 'c0000000-0000-0000-0000-000000000001';
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'FAIL player write: player updated % team board(s)', updated; end if;

  begin
    insert into public.boards (owner, scope, team_id, title)
    values ('a0000000-0000-0000-0000-000000000004', 'team', 'b0000000-0000-0000-0000-00000000000a', 'player board');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'FAIL player write: player inserted a team board'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 3. Author lock: another coach cannot edit a locked board (but can edit an unlocked one), and cannot
--    seize it by setting the lock; the author can edit their own locked board.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
do $$
declare updated int; blocked boolean := false;
begin
  update public.boards set title = 'other coach edit' where id = 'c0000000-0000-0000-0000-000000000002';
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'FAIL author lock: another coach updated a locked board'; end if;

  update public.boards set title = 'other coach edit' where id = 'c0000000-0000-0000-0000-000000000001';
  get diagnostics updated = row_count;
  if updated <> 1 then raise exception 'FAIL coach edit: a coach could not update an unlocked team board (% rows)', updated; end if;

  begin
    update public.boards set author_locked = true where id = 'c0000000-0000-0000-0000-000000000001';
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL author lock: a non-author coach changed the author lock'; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
declare updated int;
begin
  update public.boards set title = 'author edit' where id = 'c0000000-0000-0000-0000-000000000002';
  get diagnostics updated = row_count;
  if updated <> 1 then raise exception 'FAIL author lock: the author could not edit their own locked board'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 4. Admin god-mode: an admin with no membership reads every team and edits a locked board.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare na int; nb int; updated int;
begin
  select count(*) into na from public.boards where team_id = 'b0000000-0000-0000-0000-00000000000a';
  select count(*) into nb from public.boards where team_id = 'b0000000-0000-0000-0000-00000000000b';
  if na < 2 or nb < 1 then raise exception 'FAIL admin read: admin saw A=%, B=% (expected all)', na, nb; end if;

  update public.boards set title = 'admin edit' where id = 'c0000000-0000-0000-0000-000000000002';
  get diagnostics updated = row_count;
  if updated <> 1 then raise exception 'FAIL admin write: admin could not edit a locked board'; end if;
end $$;
reset role;

select 'ALL RLS TESTS PASSED' as result;

rollback;
