-- VolleyCoach — local development seed (local-only fixtures, never applied to production).
-- A production migration push runs migrations only, never this file, so nothing production relies on may
-- live here. `supabase start` and `supabase db reset` run it after the migrations, so a fresh local
-- database opens ready to use.
--
-- Sign-in accounts (password for all three: "password"):
--   admin@volleycoach.test  — global admin (god-mode across every space)
--   coach@volleycoach.test  — coach of the demo team, owner of a personal board
--   player@volleycoach.test — player on the demo team (read-only on its library)
--
-- Plus a "Demo Team" with the coach and player as members, two team boards, one personal board, and a
-- team note linking the team boards. Idempotent: fixed ids and on-conflict-do-nothing.

-- 1. The three accounts. Inserting into auth.users fires on_auth_user_created, which creates each profile.
--    A matching auth.identities row is what GoTrue checks for email/password sign-in.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'admin@volleycoach.test', extensions.crypt('password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c2222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'coach@volleycoach.test', extensions.crypt('password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '93333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'player@volleycoach.test', extensions.crypt('password', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  ('a1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
   '{"sub":"a1111111-1111-1111-1111-111111111111","email":"admin@volleycoach.test","email_verified":true}', 'email', now(), now(), now()),
  ('c2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222',
   '{"sub":"c2222222-2222-2222-2222-222222222222","email":"coach@volleycoach.test","email_verified":true}', 'email', now(), now(), now()),
  ('93333333-3333-3333-3333-333333333333', '93333333-3333-3333-3333-333333333333',
   '{"sub":"93333333-3333-3333-3333-333333333333","email":"player@volleycoach.test","email_verified":true}', 'email', now(), now(), now())
on conflict (provider_id, provider) do nothing;

-- 2. Display names (so the first-run name gate is skipped) and the global-admin flag.
update public.profiles set display_name = 'Admin',  is_admin = true where id = 'a1111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'Coach'  where id = 'c2222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'Player' where id = '93333333-3333-3333-3333-333333333333';

-- 3. The demo team, with the coach and player as members.
insert into public.teams (id, name, slug) values
  ('70000000-0000-0000-0000-000000000001', 'Demo Team', 'demo-team')
on conflict (id) do nothing;

insert into public.memberships (team_id, user_id, role) values
  ('70000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', 'coach'),
  ('70000000-0000-0000-0000-000000000001', '93333333-3333-3333-3333-333333333333', 'player')
on conflict (team_id, user_id) do nothing;

-- 4. Boards. The two samples are team boards (a team owner grant: coaches manage, players view); the third
--    is the coach's personal board (a single user owner grant). share_token is minted by the insert trigger.
insert into public.boards (id, created_by, title, description, mode, markers, steps, tags) values
  (
    '50000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222',
    'Sample Position (Base Defence)',
    $md$**Perimeter defence** against an outside attack.

- Cross Block
- **Setter:** Foot on side-line. Main target is hard line hit. Ready for tips.
- **OH2:** Deep inside the block. Main target: Everything high off the block and long line shots
- **Lib:** Just outside the block shadow. Main target is the cross power hit.
- **OH1:** Defending sharp hits and/or tips to middle of court$md$,
    'positions',
    $json$[{"id":"opp","role":"opposite","label":"OPP"},{"id":"mb1","role":"middle","label":"MB1"},{"id":"oh1","role":"outside","label":"OH1"},{"id":"s","role":"setter","label":"S"},{"id":"l","role":"libero","label":"L"},{"id":"oh2","role":"outside","label":"OH2"},{"id":"ball","role":"ball"}]$json$::jsonb,
    $json$[{"id":"step-1","instruction":"","positions":{"opp":{"x":0.89,"y":0.05},"mb1":{"x":0.82,"y":0.05},"oh1":{"x":0.14,"y":0.31},"s":{"x":0.95,"y":0.6},"l":{"x":0.18,"y":0.72},"oh2":{"x":0.72,"y":0.92},"ball":{"x":0.95,"y":-0.09}}}]$json$::jsonb,
    array['sample', 'defense']
  ),
  (
    '50000000-0000-0000-0000-000000000002', 'c2222222-2222-2222-2222-222222222222',
    'Sample Drill (Serve Receive & Sideout)',
    $md$### Serve Reception & Sideout$md$,
    'positions',
    $json$[{"id":"s","role":"setter","label":"S"},{"id":"mb1","role":"middle","label":"MB1"},{"id":"oh1","role":"outside","label":"OH1"},{"id":"oh2","role":"outside","label":"OH2"},{"id":"l","role":"libero","label":"L"},{"id":"ball","role":"ball"}]$json$::jsonb,
    $json$[{"id":"step-1","instruction":"- Serve receive\n- L and OH2 each cover 40% of the court\n- OH1 covers the remaining 20%","positions":{"s":{"x":0.72,"y":0.18},"mb1":{"x":0.4,"y":0.15},"oh1":{"x":0.1,"y":0.66},"oh2":{"x":0.8,"y":0.72},"l":{"x":0.4,"y":0.72},"ball":{"x":0.6,"y":-0.09}}},{"id":"step-2","instruction":"- Pass to the middle, close to the net\n- OH1 kicks out wide for the approach","positions":{"s":{"x":0.52,"y":0.13},"mb1":{"x":0.42,"y":0.15},"oh1":{"x":0.0,"y":0.48},"oh2":{"x":0.78,"y":0.62},"l":{"x":0.58,"y":0.72},"ball":{"x":0.6,"y":0.72}}},{"id":"step-3","instruction":"- Set to the antenna\n- MB1 jumps with the set","positions":{"s":{"x":0.5,"y":0.11},"mb1":{"x":0.38,"y":0.06},"oh1":{"x":-0.1,"y":0.3},"oh2":{"x":0.5,"y":0.6},"l":{"x":0.35,"y":0.52},"ball":{"x":0.5,"y":0.13}}},{"id":"step-4","instruction":"- OH1 attacks\n- Everyone covers: libero, MB1 and setter tight, OH2 deep in the middle","positions":{"s":{"x":0.45,"y":0.15},"mb1":{"x":0.25,"y":0.12},"oh1":{"x":0.06,"y":0.13},"oh2":{"x":0.45,"y":0.55},"l":{"x":0.1,"y":0.3},"ball":{"x":0.06,"y":0.05}}}]$json$::jsonb,
    array['sample', 'reception']
  ),
  (
    '50000000-0000-0000-0000-000000000003', 'c2222222-2222-2222-2222-222222222222',
    'Coach''s Scratch Board',
    $md$A personal board only the coach can see — handy for trying an idea before sharing it.$md$,
    'basic',
    $json$[{"id":"p1","role":"player","label":"1"},{"id":"p2","role":"player","label":"2"},{"id":"ball","role":"ball"}]$json$::jsonb,
    $json$[{"id":"step-1","instruction":"","positions":{"p1":{"x":0.35,"y":0.6},"p2":{"x":0.65,"y":0.6},"ball":{"x":0.5,"y":0.4}}}]$json$::jsonb,
    array['personal']
  )
on conflict (id) do nothing;

insert into public.board_access (board_id, team_id, capability) values
  ('50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'owner'),
  ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'owner')
on conflict (board_id, team_id) where team_id is not null do nothing;

insert into public.board_access (board_id, user_id, capability) values
  ('50000000-0000-0000-0000-000000000003', 'c2222222-2222-2222-2222-222222222222', 'owner')
on conflict (board_id, user_id) where user_id is not null do nothing;

-- 5. A team note linking the two team boards. team_id is the home anchor (slug uniqueness); a team owner
--    grant places it in the team's library.
insert into public.topics (id, created_by, team_id, title, slug, blocks, parent_id, sort_order) values
  (
    '40000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222',
    '70000000-0000-0000-0000-000000000001', 'Team Playbook', 'team-playbook',
    $json$[{"id":"blk-intro","kind":"markdown","text":"Our base **defence** and a serve-receive sideout drill."},{"id":"blk-boards","kind":"boards","boardIds":["50000000-0000-0000-0000-000000000001","50000000-0000-0000-0000-000000000002"]}]$json$::jsonb,
    null, 0
  )
on conflict (id) do nothing;

insert into public.topic_access (topic_id, team_id, capability) values
  ('40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'owner')
on conflict (topic_id, team_id) where team_id is not null do nothing;
