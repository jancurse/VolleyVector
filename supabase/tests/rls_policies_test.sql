-- Row-level security tests for VolleyVector, the access-list model.
--
-- Verifies the access boundary at the policy level, not just in the UI. A board has a `created_by` label
-- and an access list of (principal, capability) grants; the caller's effective capability is the highest
-- grant they hold (admin → owner; a direct user grant counts as itself; a team grant counts as its
-- capability for a coach and viewer for any member; a showcase grant is viewer for everyone). This file
-- exercises each capability path, the team-role cap, the leave-vs-manage split, the showcase widening,
-- admin god-mode, the share-token rule, the bootstrap-and-coach insert guard, the archive-on-empty
-- reference-count trigger, and the commit compare-and-swap. (`topic_access` mirrors `board_access` policy
-- for policy; only the board path is tested.)
--
-- Self-contained: it creates throwaway users, teams, boards, and grants as the table owner (which bypasses
-- RLS), asserts each rule while impersonating each user, then rolls back, so it leaves no trace. Run it in
-- the Supabase SQL Editor.
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

insert into public.teams (id, name, slug) values
  ('b0000000-0000-0000-0000-00000000000a', 'RLS Team A', 'rls-team-a'),
  ('b0000000-0000-0000-0000-00000000000b', 'RLS Team B', 'rls-team-b');

-- The showcase team is global and unique (a partial index allows only one), so reuse the existing one
-- rather than creating a second. It must exist for the showcase test below; in production the setup seed
-- has created it.
do $$
begin
  if not exists (select 1 from public.teams where is_showcase) then
    raise exception 'FIXTURE: no showcase team exists; cannot test the showcase widening';
  end if;
end $$;

insert into public.memberships (team_id, user_id, role) values
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', 'coach'),  -- coachA
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000003', 'coach'),  -- coachA2
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000004', 'player'), -- playerA
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000005', 'coach');  -- coachB

-- Boards carry only a creator label now; placement and access are the grants below. share_token is minted
-- by the insert trigger.
insert into public.boards (id, created_by, title) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Team A owner board'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'Team A editor board'),  -- creator outside team A, so the editor grant is the only path in
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Team A viewer board'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005', 'Team B owner board'),
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Coach A personal'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Coach A co-edited'),
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Showcase board'),
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Reference-count board');

-- The grants. A team grant maps the team's roles capped by its capability; a direct user grant counts as
-- itself.
insert into public.board_access (board_id, team_id, capability) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000a', 'owner'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', 'editor'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000a', 'viewer'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-00000000000b', 'owner'),
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000a', 'viewer'); -- one of two grants
-- Grant the showcase board to the existing global showcase team (looked up, since it is unique).
insert into public.board_access (board_id, team_id, capability)
  select 'e0000000-0000-0000-0000-000000000001', id, 'owner' from public.teams where is_showcase limit 1;
insert into public.board_access (board_id, user_id, capability) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'owner'),  -- private to coachA
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'owner'),  -- co-edited: owner
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'editor'), -- co-edited: coachA2
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'owner');  -- the other grant

-- A note coachA owns, anchored to and granted to team A, used by the access-UPDATE guard test.
insert into public.topics (id, created_by, team_id, title, slug) values
  ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', 'Team A note', 'team-a-note');
insert into public.topic_access (topic_id, team_id, capability) values
  ('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000a', 'owner');
insert into public.topic_access (topic_id, user_id, capability) values
  ('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'owner');

-- A note anchored to and granted to team A, then shared out to coachB. When team A is purged it must
-- survive on the out-of-team grant alone, so its only other grant is coachB's (no coachA grant here).
insert into public.topics (id, created_by, team_id, title, slug) values
  ('70000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', 'Shared-out note', 'shared-out-note');
insert into public.topic_access (topic_id, team_id, capability) values
  ('70000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', 'owner');
insert into public.topic_access (topic_id, user_id, capability) values
  ('70000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'editor'); -- coachB, outside team A

-- A board coachA owns and already shares with coachB at viewer, plus an editor link coachA minted on it.
-- Used by the upgrade-or-grant test: redeeming as coachB must raise viewer to editor, not no-op.
insert into public.boards (id, created_by, title) values
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Coach A upgrade board');
insert into public.board_access (board_id, user_id, capability) values
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'owner'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 'viewer'); -- coachB holds viewer
insert into public.access_links (token, board_id, capability, created_by) values
  ('11111111111111111111111111111111', 'd0000000-0000-0000-0000-000000000003', 'editor', 'a0000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- 1. Team owner grant: a coach gets the grant's capability (owner), a player gets viewer, an outside coach
--    gets nothing.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA
do $$
declare updated int;
begin
  if public.board_capability('c0000000-0000-0000-0000-000000000001') is distinct from 'owner' then
    raise exception 'FAIL team owner: a coach is not owner of a team-owner board';
  end if;
  update public.boards set title = 'coach owner edit' where id = 'c0000000-0000-0000-0000-000000000001';
  get diagnostics updated = row_count;
  if updated <> 1 then raise exception 'FAIL team owner: a coach could not edit a team-owner board'; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}'; -- playerA
do $$
declare n int; updated int;
begin
  select count(*) into n from public.boards where id = 'c0000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'FAIL team owner: a player could not read a team-owner board'; end if;
  update public.boards set title = 'player edit' where id = 'c0000000-0000-0000-0000-000000000001';
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'FAIL team owner: a player edited a team-owner board (% rows)', updated; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}'; -- coachB
do $$
declare n int;
begin
  select count(*) into n from public.boards where id = 'c0000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FAIL team isolation: an outside coach read another team''s board'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 2. Team editor grant: a coach may edit but not manage the access list; a player still only reads.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA
do $$
declare updated int; blocked boolean := false;
begin
  if public.board_capability('c0000000-0000-0000-0000-000000000002') is distinct from 'editor' then
    raise exception 'FAIL team editor: a coach is not editor of a team-editor board';
  end if;
  update public.boards set title = 'coach editor edit' where id = 'c0000000-0000-0000-0000-000000000002';
  get diagnostics updated = row_count;
  if updated <> 1 then raise exception 'FAIL team editor: a coach could not edit a team-editor board'; end if;

  begin
    insert into public.board_access (board_id, user_id, capability)
    values ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'viewer');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL editor cannot manage: an editor added a grant'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 3. Team viewer grant: even a coach is capped at viewer, so they read but cannot edit.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA
do $$
declare n int; updated int;
begin
  if public.board_capability('c0000000-0000-0000-0000-000000000003') is distinct from 'viewer' then
    raise exception 'FAIL team viewer: a coach is not capped at viewer on a team-viewer board';
  end if;
  select count(*) into n from public.boards where id = 'c0000000-0000-0000-0000-000000000003';
  if n <> 1 then raise exception 'FAIL team viewer: a coach could not read a team-viewer board'; end if;
  update public.boards set title = 'coach viewer edit' where id = 'c0000000-0000-0000-0000-000000000003';
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'FAIL team viewer: a coach edited a team-viewer board (% rows)', updated; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 4. Direct user grant (co-editing): the grantee edits as their own capability, cannot manage the list,
--    but may always remove their own grant (leave).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}'; -- coachA2
do $$
declare updated int; deleted int; blocked boolean := false;
begin
  if public.board_capability('d0000000-0000-0000-0000-000000000002') is distinct from 'editor' then
    raise exception 'FAIL user grant: a directly-granted editor is not editor';
  end if;
  update public.boards set title = 'co-editor edit' where id = 'd0000000-0000-0000-0000-000000000002';
  get diagnostics updated = row_count;
  if updated <> 1 then raise exception 'FAIL user grant: a co-editor could not edit'; end if;

  begin
    insert into public.board_access (board_id, team_id, capability)
    values ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', 'viewer');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL user grant: a non-owner co-editor managed the access list'; end if;

  delete from public.board_access
    where board_id = 'd0000000-0000-0000-0000-000000000002' and user_id = 'a0000000-0000-0000-0000-000000000003';
  get diagnostics deleted = row_count;
  if deleted <> 1 then raise exception 'FAIL leave: a co-editor could not remove their own grant'; end if;
end $$;
reset role;

-- The leave test above removed coachA2's grant from d0...002. Restore it (as the fixture owner, bypassing
-- RLS) so the user-shared share-token check in section 9 still has a board shared with a non-creator user.
insert into public.board_access (board_id, user_id, capability)
  values ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'editor');

-- ---------------------------------------------------------------------------
-- 5. Personal privacy: a board with only its creator's grant is the creator's alone.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}'; -- coachA2 (teammate)
do $$
declare n int;
begin
  select count(*) into n from public.boards where id = 'd0000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FAIL personal privacy: a teammate read a private personal board'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 6. Owner manages the access list: an owner adds and removes grants; the bootstrap+coach insert guard
--    blocks a team grant for a team the caller does not coach.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA (owner of team A board)
do $$
declare blocked boolean := false;
begin
  insert into public.board_access (board_id, user_id, capability)
  values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'editor');

  begin
    insert into public.board_access (board_id, team_id, capability)
    values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'viewer');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL insert guard: an owner granted a team they do not coach'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 7. Showcase widening: a showcase-team grant reads as viewer for any authenticated user (no membership),
--    who may read but not edit.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}'; -- coachB (not a showcase member)
do $$
declare n int; updated int;
begin
  if public.board_capability('e0000000-0000-0000-0000-000000000001') is distinct from 'viewer' then
    raise exception 'FAIL showcase: an outsider is not viewer of a showcase board';
  end if;
  select count(*) into n from public.boards where id = 'e0000000-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'FAIL showcase: an outsider could not read a showcase board'; end if;
  update public.boards set title = 'showcase edit' where id = 'e0000000-0000-0000-0000-000000000001';
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'FAIL showcase: an outsider edited a showcase board (% rows)', updated; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 8. Admin god-mode: an admin with no membership reads every board and edits one held only at viewer.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}'; -- admin
do $$
declare n int; updated int;
begin
  select count(*) into n from public.boards
    where id in ('c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001');
  if n <> 3 then raise exception 'FAIL admin read: admin saw % of 3 boards', n; end if;

  update public.boards set title = 'admin edit' where id = 'c0000000-0000-0000-0000-000000000003';
  get diagnostics updated = row_count;
  if updated <> 1 then raise exception 'FAIL admin write: admin could not edit a viewer-only board'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 9. Share-token resolution: a team-granted board and a user-shared board resolve by exact token for an
--    anonymous visitor; a board with only its creator's grant never resolves.
-- ---------------------------------------------------------------------------
do $$
declare tok_team text; tok_shared text; tok_private text; n int;
begin
  select share_token into tok_team    from public.boards where id = 'c0000000-0000-0000-0000-000000000001';
  select share_token into tok_shared  from public.boards where id = 'd0000000-0000-0000-0000-000000000002';
  select share_token into tok_private from public.boards where id = 'd0000000-0000-0000-0000-000000000001';

  set local role anon;

  select count(*) into n from public.board_by_token(tok_team);
  if n <> 1 then raise exception 'FAIL token: a team board did not resolve by token'; end if;

  select count(*) into n from public.board_by_token(tok_shared);
  if n <> 1 then raise exception 'FAIL token: a user-shared board did not resolve by token'; end if;

  select count(*) into n from public.board_by_token(tok_private);
  if n <> 0 then raise exception 'FAIL token: a private personal board resolved by token'; end if;

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Reference-count archive: removing a grant leaves a board that still has one alone; removing the last
--     grant grace-archives the row.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA (owner)
do $$
declare archived timestamptz;
begin
  -- Remove the team grant; the owner grant remains, so the board still reads to coachA and is not archived.
  delete from public.board_access
    where board_id = 'f0000000-0000-0000-0000-000000000001' and team_id = 'b0000000-0000-0000-0000-00000000000a';
  select deleted_at into archived from public.boards where id = 'f0000000-0000-0000-0000-000000000001';
  if archived is not null then raise exception 'FAIL reference count: a board archived while a grant remained'; end if;

  -- Leave (remove own last grant); the board now has no grants, so coachA can no longer read it.
  delete from public.board_access
    where board_id = 'f0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000002';
end $$;
reset role;

-- The board is archived now; verify as the fixture owner, since no one holds a grant to read it through RLS.
do $$
declare archived timestamptz;
begin
  select deleted_at into archived from public.boards where id = 'f0000000-0000-0000-0000-000000000001';
  if archived is null then raise exception 'FAIL reference count: a board did not archive when its last grant went'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Commit compare-and-swap: a commit on the current base advances the revision; a commit on a stale base
--     returns null (the conflict the client resolves).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA (owner)
do $$
declare content jsonb; rev1 uuid; rev2 uuid;
begin
  content := jsonb_build_object('title', 'committed', 'description', '', 'mode', 'positions',
    'markers', '[]'::jsonb, 'steps', '[]'::jsonb, 'tags', '[]'::jsonb, 'auto_arrows', true, 'rotation_strict', false);

  -- The board was inserted directly, so its current revision is null; committing on a null base seeds it.
  rev1 := public.commit_board('c0000000-0000-0000-0000-000000000001', content, null);
  if rev1 is null then raise exception 'FAIL commit: a fresh commit on the current base was rejected'; end if;

  -- Re-committing on the same (now stale) null base must conflict.
  rev2 := public.commit_board('c0000000-0000-0000-0000-000000000001', content, null);
  if rev2 is not null then raise exception 'FAIL commit: a commit on a stale base was not rejected'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 12. Invite quota: account creation is the only quota-gated grant. A non-admin spends from a quota an
--     admin granted, can never grant quota, and cannot mint over quota; an admin is unlimited. Availability
--     is derived from the invites table, so a reserved link counts, a spent one counts, and an
--     account-creation link redeemed by an existing account releases its slot. A multi-use link reserves
--     every one of its uses at mint and charges only the accounts it created once it is spent.
-- ---------------------------------------------------------------------------

-- Give coachA a quota of 2 (the effect of the admin-only set_invite_quota write).
update public.profiles set invite_quota = 2 where id = 'a0000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA
do $$
declare blocked boolean;
begin
  if public.invite_availability() <> 2 then raise exception 'FAIL quota: fresh availability is not the full quota'; end if;

  -- A non-admin cannot grant quota on a link.
  blocked := false;
  begin
    insert into public.invites (created_by, allows_new_account, grant_quota)
      values ('a0000000-0000-0000-0000-000000000002', false, 5);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL quota: a non-admin granted quota on a link'; end if;

  -- A non-admin cannot set anyone's quota.
  blocked := false;
  begin
    perform public.set_invite_quota('a0000000-0000-0000-0000-000000000002', 99);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL quota: a non-admin set an invite quota'; end if;

  -- Two team-less account-creation links each reserve a slot, so availability drops to zero.
  insert into public.invites (created_by, allows_new_account) values ('a0000000-0000-0000-0000-000000000002', true);
  insert into public.invites (created_by, allows_new_account) values ('a0000000-0000-0000-0000-000000000002', true);
  if public.invite_availability() <> 0 then raise exception 'FAIL quota: two reserved links did not zero availability'; end if;

  -- A third account-creation link is over quota and rejected; an existing-user link is always free.
  blocked := false;
  begin
    insert into public.invites (created_by, allows_new_account) values ('a0000000-0000-0000-0000-000000000002', true);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL quota: a non-admin minted an account link over quota'; end if;

  insert into public.invites (created_by, allows_new_account, team_id, role)
    values ('a0000000-0000-0000-0000-000000000002', false, 'b0000000-0000-0000-0000-00000000000a', 'player');
end $$;
reset role;

-- A multi-use link costs a slot per use, so it needs the whole count free at mint. With the quota raised to
-- 5 and 2 already reserved, a 4-use link is over quota and a 3-use one exactly fills it.
update public.profiles set invite_quota = 5 where id = 'a0000000-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA
do $$
declare blocked boolean := false;
begin
  if public.invite_availability() <> 3 then raise exception 'FAIL quota: the raised quota did not free slots'; end if;

  begin
    insert into public.invites (created_by, allows_new_account, max_uses)
      values ('a0000000-0000-0000-0000-000000000002', true, 4);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL quota: a 4-use link minted with 3 slots left'; end if;

  -- A client may not mint a link that starts out spent (which would reserve nothing).
  insert into public.invites (created_by, allows_new_account, max_uses, uses, created_accounts)
    values ('a0000000-0000-0000-0000-000000000002', true, 3, 3, 0);
  if public.invite_availability() <> 0 then
    raise exception 'FAIL quota: a 3-use link did not reserve all three slots';
  end if;
end $$;
reset role;

-- Redeeming that multi-use link: two uses are claimed, one creating an account. While it still has a use
-- left it reserves all three; once it runs out it charges only the account it created, releasing the rest.
do $$
declare multi text;
begin
  select token into multi
  from public.invites
  where created_by = 'a0000000-0000-0000-0000-000000000002' and max_uses = 3;

  if (select count(*) from public.claim_invite(multi)) <> 1 then raise exception 'FAIL claim: no use claimed'; end if;
  perform public.record_invite_account(multi);
  if (select count(*) from public.claim_invite(multi)) <> 1 then raise exception 'FAIL claim: no second use'; end if;
  if public.invite_available('a0000000-0000-0000-0000-000000000002') <> 0 then
    raise exception 'FAIL quota: a link with a use left stopped reserving its full count';
  end if;

  if (select count(*) from public.claim_invite(multi)) <> 1 then raise exception 'FAIL claim: no third use'; end if;
  if (select count(*) from public.claim_invite(multi)) <> 0 then
    raise exception 'FAIL claim: a spent link was claimed again';
  end if;
  if public.invite_available('a0000000-0000-0000-0000-000000000002') <> 2 then
    raise exception 'FAIL quota: a spent link did not release its unused slots';
  end if;

  -- A released claim gives its use back, so a rolled-back redemption costs the link nothing.
  perform public.release_invite(multi);
  if (select count(*) from public.claim_invite(multi)) <> 1 then
    raise exception 'FAIL claim: a released use was not reclaimable';
  end if;
end $$;

-- Put the quota back where the accounting below expects it: the 3-use link is spent with one account
-- created, so dropping the quota to 3 leaves the two single-use links of the original run to settle.
update public.profiles set invite_quota = 3 where id = 'a0000000-0000-0000-0000-000000000002';

-- The release accounting the redeem function persists (run as the owner, since clients never update an
-- invite): of the two single-use links, the one redeemed by an existing account (no account created) frees
-- its slot, while the one that created an account is spent. With the spent multi-use link above also
-- charging its one account, availability reads 1 (quota 3 − 2 spent).
with acct as (
  select token, row_number() over (order by token) as rn
  from public.invites
  where created_by = 'a0000000-0000-0000-0000-000000000002' and allows_new_account and max_uses = 1
)
update public.invites i set uses = 1 from acct where i.token = acct.token and acct.rn = 1;

with acct as (
  select token, row_number() over (order by token) as rn
  from public.invites
  where created_by = 'a0000000-0000-0000-0000-000000000002' and allows_new_account and max_uses = 1
)
update public.invites i set uses = 1, created_accounts = 1 from acct where i.token = acct.token and acct.rn = 2;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA
do $$
begin
  if public.invite_availability() <> 1 then
    raise exception 'FAIL quota: a released slot was not freed (or a spent slot was)';
  end if;
end $$;
reset role;

-- An admin is unlimited: availability is null, and they may mint a quota-granting account link regardless.
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}'; -- admin
do $$
begin
  if public.invite_availability() is not null then raise exception 'FAIL quota: an admin is not unlimited'; end if;
  insert into public.invites (created_by, allows_new_account, grant_quota)
    values ('a0000000-0000-0000-0000-000000000001', true, 10);
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 13. Open team creation: any account creates a team through create_team and lands on it as a coach, even
--     a player who coaches nothing.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}'; -- playerA
do $$
declare new_team uuid; n int;
begin
  new_team := public.create_team('Player Team', 'player-team');
  select count(*) into n from public.memberships
    where team_id = new_team and user_id = 'a0000000-0000-0000-0000-000000000004' and role = 'coach';
  if n <> 1 then raise exception 'FAIL create_team: the creator is not a coach of the new team'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 14. Access-list UPDATE coach guard: an owner may not repoint a grant onto a team they do not coach, and
--     a non-coach (player, outside coach) may not update the grant at all. (board_access and topic_access.)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA, owner of c0...001 and 70...001
do $$
declare blocked boolean; updated int;
begin
  -- coachA owns the board (team A owner grant) but does not coach team B, so repointing onto team B is blocked.
  blocked := false;
  begin
    update public.board_access set team_id = 'b0000000-0000-0000-0000-00000000000b'
      where board_id = 'c0000000-0000-0000-0000-000000000001' and team_id = 'b0000000-0000-0000-0000-00000000000a';
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL access update: an owner repointed a board grant onto a team they do not coach'; end if;

  -- The same on topic_access.
  blocked := false;
  begin
    update public.topic_access set team_id = 'b0000000-0000-0000-0000-00000000000b'
      where topic_id = '70000000-0000-0000-0000-000000000001' and team_id = 'b0000000-0000-0000-0000-00000000000a';
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL access update: an owner repointed a note grant onto a team they do not coach'; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}'; -- playerA, no manage rights
do $$
declare updated int;
begin
  update public.board_access set team_id = 'b0000000-0000-0000-0000-00000000000a'
    where board_id = 'c0000000-0000-0000-0000-000000000001' and team_id = 'b0000000-0000-0000-0000-00000000000a';
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'FAIL access update: a player updated a board grant (% rows)', updated; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}'; -- coachB, coaches another team
do $$
declare updated int;
begin
  update public.board_access set team_id = 'b0000000-0000-0000-0000-00000000000b'
    where board_id = 'c0000000-0000-0000-0000-000000000001' and team_id = 'b0000000-0000-0000-0000-00000000000a';
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'FAIL access update: an outside coach updated a board grant (% rows)', updated; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 15. Team-purge note survival: a note shared out of team A survives team A's purge. The team-A grant
--     cascades away, archive_orphaned_topic leaves the note alive because the coachB grant remains, and the
--     note row is not hard-deleted. (Run as the fixture owner; purge_expired is service_role only.)
-- ---------------------------------------------------------------------------
do $$
declare archived timestamptz; team_grants int; other_grant int; n int;
begin
  -- Grace-archive and age team A past the 3-month purge window.
  update public.teams set deleted_at = now() - interval '4 months' where id = 'b0000000-0000-0000-0000-00000000000a';
  set local role service_role;
  perform public.purge_expired();
  reset role;

  -- The team is gone; its grant on the shared-out note cascaded; the note and coachB's grant remain.
  select count(*) into n from public.topics where id = '70000000-0000-0000-0000-000000000002';
  if n <> 1 then raise exception 'FAIL purge survival: a shared-out note was hard-deleted with its team'; end if;
  select deleted_at into archived from public.topics where id = '70000000-0000-0000-0000-000000000002';
  if archived is not null then raise exception 'FAIL purge survival: a shared-out note was archived though a grant remained'; end if;
  select count(*) into team_grants from public.topic_access
    where topic_id = '70000000-0000-0000-0000-000000000002' and team_id = 'b0000000-0000-0000-0000-00000000000a';
  if team_grants <> 0 then raise exception 'FAIL purge survival: the purged team grant did not cascade off the note'; end if;
  select count(*) into other_grant from public.topic_access
    where topic_id = '70000000-0000-0000-0000-000000000002' and user_id = 'a0000000-0000-0000-0000-000000000005';
  if other_grant <> 1 then raise exception 'FAIL purge survival: the out-of-team grant did not survive the purge'; end if;
end $$;

-- Team A and its memberships are gone now. The remaining sections target only out-of-team principals
-- (coachA, coachB) and content not anchored to team A, so they are unaffected.

-- ---------------------------------------------------------------------------
-- 16. Upgrade-or-grant: redeeming a link for a recipient who already holds a lower grant raises the
--     capability rather than reporting success while leaving the grant unchanged. The grant_board_by_email
--     path upgrades the same way.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}'; -- coachB, holds viewer on d0...003
do $$
declare cap text;
begin
  perform public.redeem_access_link('11111111111111111111111111111111'); -- the link carries editor
  select capability into cap from public.board_access
    where board_id = 'd0000000-0000-0000-0000-000000000003' and user_id = 'a0000000-0000-0000-0000-000000000005';
  if cap is distinct from 'editor' then raise exception 'FAIL upgrade: redeeming a link did not raise a lower grant (got %)', cap; end if;
end $$;
reset role;

-- An email grant from coachA (owner) upgrades coachB from editor to owner; a lower-or-equal email grant is a no-op.
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA, owner of d0...003
do $$
declare cap text;
begin
  perform public.grant_board_by_email('d0000000-0000-0000-0000-000000000003', 'rls-coachB@test.local', 'owner');
  select capability into cap from public.board_access
    where board_id = 'd0000000-0000-0000-0000-000000000003' and user_id = 'a0000000-0000-0000-0000-000000000005';
  if cap is distinct from 'owner' then raise exception 'FAIL upgrade: an email grant did not raise a lower grant (got %)', cap; end if;

  perform public.grant_board_by_email('d0000000-0000-0000-0000-000000000003', 'rls-coachB@test.local', 'viewer');
  select capability into cap from public.board_access
    where board_id = 'd0000000-0000-0000-0000-000000000003' and user_id = 'a0000000-0000-0000-0000-000000000005';
  if cap is distinct from 'owner' then raise exception 'FAIL upgrade: a lower email grant downgraded an existing grant (got %)', cap; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 17. Email grant is no oracle: it returns nothing for both a matching and a non-matching address, and the
--     owner check runs before and independent of the lookup (a non-owner is rejected for any address).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA, owner of d0...003
do $$
declare hit_rows int; miss_rows int;
begin
  -- The RPC returns void, so a hit and a miss are indistinguishable to the caller: both succeed silently and
  -- yield no row. Calling it as a table source, both return a single void row and never a result value.
  select count(*) into hit_rows from public.grant_board_by_email('d0000000-0000-0000-0000-000000000003', 'rls-coachB@test.local', 'viewer');
  select count(*) into miss_rows from public.grant_board_by_email('d0000000-0000-0000-0000-000000000003', 'nobody@test.local', 'viewer');
  if hit_rows is distinct from miss_rows then
    raise exception 'FAIL oracle: a matching and a non-matching email grant differ (% vs %)', hit_rows, miss_rows;
  end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}'; -- coachB, holds nothing on d0...002
do $$
declare blocked boolean := false;
begin
  -- The owner check fires regardless of whether the address resolves: a non-owner is rejected even for a real account.
  begin
    perform public.grant_board_by_email('d0000000-0000-0000-0000-000000000002', 'rls-coachA@test.local', 'viewer');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL oracle: a non-owner granted by email'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 18. Link is single-use and binds to its redeemer; admin_list_profiles is admin-only and the only path
--     that returns email.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}'; -- coachB redeemed link 1111... in section 16
do $$
declare used_by_id uuid; blocked boolean := false;
begin
  -- The first redemption (section 16) marked the link used and stamped used_by as coachB.
  select used_by into used_by_id from public.access_links where token = '11111111111111111111111111111111';
  if used_by_id is distinct from 'a0000000-0000-0000-0000-000000000005' then
    raise exception 'FAIL single-use: the link did not bind to its redeemer';
  end if;
  -- A second redemption of the spent link is rejected.
  begin
    perform public.redeem_access_link('11111111111111111111111111111111');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL single-use: a spent link was redeemed again'; end if;

  -- A non-admin gets nothing from admin_list_profiles (no rows, no email leak).
  if exists (select 1 from public.admin_list_profiles()) then
    raise exception 'FAIL email: admin_list_profiles returned rows for a non-admin';
  end if;
  -- A non-admin cannot select email off the profiles table either (the column is not in their grant).
  blocked := false;
  begin
    perform email from public.profiles where id = 'a0000000-0000-0000-0000-000000000002';
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL email: a non-admin selected the email column'; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}'; -- admin
do $$
declare n int;
begin
  select count(*) into n from public.admin_list_profiles() where email is not null;
  if n < 1 then raise exception 'FAIL email: admin_list_profiles returned no emails for an admin'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 19. Invite insert guard: a non-coach cannot mint an invite for a team they do not coach. (coachB coaches
--     team B only; team A is purged, so coachA no longer coaches any team and is rejected for team B too.)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA, coaches no surviving team
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.invites (created_by, allows_new_account, team_id, role)
      values ('a0000000-0000-0000-0000-000000000002', false, 'b0000000-0000-0000-0000-00000000000b', 'player');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL invite guard: a non-coach minted an invite for a team they do not coach'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 20. accept_terms stamps the caller's own profile (server time + version) and touches no other row.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA
select public.accept_terms('2026-06-23');
reset role;
-- Verify as the table owner: the new columns are deliberately not in the authenticated select grant.
do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000002' and terms_accepted_at is not null and terms_version = '2026-06-23'
  ) then
    raise exception 'FAIL accept_terms: the caller''s acceptance was not recorded';
  end if;
  if exists (
    select 1 from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000004' and terms_accepted_at is not null
  ) then
    raise exception 'FAIL accept_terms: it stamped another account''s row';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 21. Access requests: the row is written only by the server (service role), and only an admin may read
--     or update it. An ordinary client can neither read, insert, nor update a request.
-- ---------------------------------------------------------------------------
-- Seeded as the table owner, standing in for the Edge Function's service-role insert (which bypasses RLS).
insert into public.access_requests (email, message) values ('hopeful@example.com', 'Please let me in');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA (non-admin)
do $$
declare n int; updated int; blocked boolean := false;
begin
  select count(*) into n from public.access_requests;
  if n <> 0 then raise exception 'FAIL access requests: a non-admin read an access request'; end if;

  begin
    insert into public.access_requests (email) values ('sneak@example.com');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL access requests: a non-admin inserted an access request'; end if;

  update public.access_requests set handled_at = now();
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'FAIL access requests: a non-admin updated an access request (% rows)', updated; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}'; -- admin
do $$
declare n int; handled int; dismissed int;
begin
  select count(*) into n from public.access_requests;
  if n <> 1 then raise exception 'FAIL access requests: an admin could not read the request'; end if;

  update public.access_requests set handled_at = now() where email = 'hopeful@example.com';
  get diagnostics handled = row_count;
  if handled <> 1 then raise exception 'FAIL access requests: an admin could not mark a request handled'; end if;

  update public.access_requests set deleted_at = now() where email = 'hopeful@example.com';
  get diagnostics dismissed = row_count;
  if dismissed <> 1 then raise exception 'FAIL access requests: an admin could not dismiss a request'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- 22. Feedback: the row is written only by the server (service role), and only an admin may read or update
--     it. An ordinary client can neither read, insert, nor update a report.
-- ---------------------------------------------------------------------------
-- Seeded as the table owner, standing in for the Edge Function's service-role insert (which bypasses RLS).
insert into public.feedback (reporter, type, message)
values ('a0000000-0000-0000-0000-000000000002', 'bug', 'The court overlaps the net');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}'; -- coachA (non-admin)
do $$
declare n int; updated int; blocked boolean := false;
begin
  select count(*) into n from public.feedback;
  if n <> 0 then raise exception 'FAIL feedback: a non-admin read a report'; end if;

  begin
    insert into public.feedback (reporter, type, message)
    values ('a0000000-0000-0000-0000-000000000002', 'feature', 'sneaky');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAIL feedback: a non-admin inserted a report'; end if;

  update public.feedback set handled_at = now();
  get diagnostics updated = row_count;
  if updated <> 0 then raise exception 'FAIL feedback: a non-admin updated a report (% rows)', updated; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}'; -- admin
do $$
declare n int; handled int; dismissed int;
begin
  select count(*) into n from public.feedback;
  if n <> 1 then raise exception 'FAIL feedback: an admin could not read the report'; end if;

  update public.feedback set handled_at = now() where type = 'bug';
  get diagnostics handled = row_count;
  if handled <> 1 then raise exception 'FAIL feedback: an admin could not mark a report handled'; end if;

  update public.feedback set deleted_at = now() where type = 'bug';
  get diagnostics dismissed = row_count;
  if dismissed <> 1 then raise exception 'FAIL feedback: an admin could not dismiss a report'; end if;
end $$;
reset role;

select 'ALL RLS TESTS PASSED' as result;

rollback;
