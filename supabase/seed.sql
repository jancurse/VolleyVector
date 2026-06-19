-- VolleyCoach — local development seed (local-only fixtures, never applied to production).
-- A production migration push runs migrations only, never this file, so nothing production relies on may
-- live here. `supabase start` and `supabase db reset` run it after the migrations, so a fresh local
-- database opens ready to use.
--
-- Sign-in accounts (password for all three: "password"):
--   admin@volleycoach.test  — global admin (god-mode across every space)
--   coach@volleycoach.test  — coach of the demo team
--   player@volleycoach.test — player on the demo team (read-only on its library)
--
-- Plus a "Demo Team" (coach + player). The coach owns two boards (granted to the coach and the team) and
-- a team note linking them, plus a personal scratch board. The admin owns a 5-1 rotation board and a
-- "Rotations" note in the Inspiration showcase (granted to the admin and the showcase team, so every
-- account may browse and copy them). Idempotent: fixed ids and on-conflict-do-nothing.

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

-- 4. Boards. The two samples are the coach's, in both the coach's space and the Demo Team library; the
--    scratch board is personal to the coach; the 5-1 rotation is an admin showcase board (auto-arrows
--    off — each step is a standalone rotation snapshot, not a movement). share_token is minted by the
--    insert trigger.
insert into public.boards (id, created_by, title, description, mode, markers, steps, tags, auto_arrows) values
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
    array['sample', 'defense'], true
  ),
  (
    '50000000-0000-0000-0000-000000000002', 'c2222222-2222-2222-2222-222222222222',
    'Sample Drill (Serve Receive & Sideout)',
    $md$### Serve Reception & Sideout$md$,
    'positions',
    $json$[{"id":"s","role":"setter","label":"S"},{"id":"mb1","role":"middle","label":"MB1"},{"id":"oh1","role":"outside","label":"OH1"},{"id":"oh2","role":"outside","label":"OH2"},{"id":"l","role":"libero","label":"L"},{"id":"ball","role":"ball"}]$json$::jsonb,
    $json$[{"id":"step-1","instruction":"- Serve receive\n- L and OH2 each cover 40% of the court\n- OH1 covers the remaining 20%","positions":{"s":{"x":0.72,"y":0.18},"mb1":{"x":0.4,"y":0.15},"oh1":{"x":0.1,"y":0.66},"oh2":{"x":0.8,"y":0.72},"l":{"x":0.4,"y":0.72},"ball":{"x":0.6,"y":-0.09}}},{"id":"step-2","instruction":"- Pass to the middle, close to the net\n- OH1 kicks out wide for the approach","positions":{"s":{"x":0.52,"y":0.13},"mb1":{"x":0.42,"y":0.15},"oh1":{"x":0.0,"y":0.48},"oh2":{"x":0.78,"y":0.62},"l":{"x":0.58,"y":0.72},"ball":{"x":0.6,"y":0.72}}},{"id":"step-3","instruction":"- Set to the antenna\n- MB1 jumps with the set","positions":{"s":{"x":0.5,"y":0.11},"mb1":{"x":0.38,"y":0.06},"oh1":{"x":-0.1,"y":0.3},"oh2":{"x":0.5,"y":0.6},"l":{"x":0.35,"y":0.52},"ball":{"x":0.5,"y":0.13}}},{"id":"step-4","instruction":"- OH1 attacks\n- Everyone covers: libero, MB1 and setter tight, OH2 deep in the middle","positions":{"s":{"x":0.45,"y":0.15},"mb1":{"x":0.25,"y":0.12},"oh1":{"x":0.06,"y":0.13},"oh2":{"x":0.45,"y":0.55},"l":{"x":0.1,"y":0.3},"ball":{"x":0.06,"y":0.05}}}]$json$::jsonb,
    array['sample', 'reception'], true
  ),
  (
    '50000000-0000-0000-0000-000000000003', 'c2222222-2222-2222-2222-222222222222',
    'Coach''s Scratch Board',
    $md$A personal board only the coach can see — handy for trying an idea before sharing it.$md$,
    'basic',
    $json$[{"id":"p1","role":"player","label":"1"},{"id":"p2","role":"player","label":"2"},{"id":"ball","role":"ball"}]$json$::jsonb,
    $json$[{"id":"step-1","instruction":"","positions":{"p1":{"x":0.35,"y":0.6},"p2":{"x":0.65,"y":0.6},"ball":{"x":0.5,"y":0.4}}}]$json$::jsonb,
    array['personal'], true
  ),
  (
    '1d578c51-32c5-4e74-911e-feeba88cad71', 'a1111111-1111-1111-1111-111111111111',
    '5-1 Rotation',
    $md$Serve receive for a 5-1, one step per setter location.$md$,
    'positions',
    $json$[{"id":"s","role":"setter"},{"id":"oh1","role":"outside","label":"OH1"},{"id":"oh2","role":"outside","label":"OH2"},{"id":"mb","role":"middle","label":"MB"},{"id":"opp","role":"opposite"},{"id":"lib","role":"libero"},{"id":"ball","role":"ball"}]$json$::jsonb,
    $json$[{"id":"step-1","instruction":"Setter in zone 1, tucked in the right-back corner out of the passing lane with a clear lane to the net. Receive line: OH2 (left), libero (middle), OH1 (right). MB waits at the net, OPP at the front-left attack line.","positions":{"s":{"x":0.91,"y":0.82},"mb":{"x":0.52,"y":0.08},"lib":{"x":0.52,"y":0.76},"oh1":{"x":0.83,"y":0.7},"oh2":{"x":0.21,"y":0.76},"opp":{"x":0.08,"y":0.25},"ball":{"x":0.5,"y":-0.05}},"rotation":{"kind":"preset","rotation":1}},{"id":"step-2","instruction":"Setter in zone 6, up at the net behind OPP. Receive line: OH2 (left), libero (middle), OH1 (right). MB on the right at zone 2, OPP at the net center.","positions":{"s":{"x":0.63,"y":0.13},"mb":{"x":0.94,"y":0.25},"lib":{"x":0.52,"y":0.76},"oh1":{"x":0.83,"y":0.76},"oh2":{"x":0.21,"y":0.7},"opp":{"x":0.63,"y":0.05},"ball":{"x":0.5,"y":-0.05}},"rotation":{"kind":"preset","rotation":6}},{"id":"step-3","instruction":"Setter in zone 5, stepping up the left side to release to the net. Receive line: OH2 (left), OH1 (middle), libero (right). MB front-left, OPP wide at zone 2.","positions":{"s":{"x":0.12,"y":0.25},"mb":{"x":0.08,"y":0.16},"lib":{"x":0.83,"y":0.76},"oh1":{"x":0.52,"y":0.76},"oh2":{"x":0.21,"y":0.7},"opp":{"x":0.96,"y":0.25},"ball":{"x":0.5,"y":-0.05}},"rotation":{"kind":"preset","rotation":5}},{"id":"step-4","instruction":"Setter in zone 4, at the left-front net. Receive line: OH2 (left), OH1 (middle), libero (right). MB beside the setter, OPP deep in the right-back corner.","positions":{"s":{"x":0.09,"y":0.05},"mb":{"x":0.15,"y":0.13},"lib":{"x":0.83,"y":0.76},"oh1":{"x":0.52,"y":0.76},"oh2":{"x":0.21,"y":0.7},"opp":{"x":0.91,"y":0.93},"ball":{"x":0.5,"y":-0.05}},"rotation":{"kind":"preset","rotation":4}},{"id":"step-5","instruction":"Setter in zone 3, at the net center-right to set. Receive line: OH1 (left), libero (middle), OH2 (right). MB on the right at zone 2, OPP tucked back-middle behind the line.","positions":{"s":{"x":0.63,"y":0.05},"mb":{"x":0.94,"y":0.25},"lib":{"x":0.52,"y":0.76},"oh1":{"x":0.21,"y":0.7},"oh2":{"x":0.83,"y":0.76},"opp":{"x":0.69,"y":0.93},"ball":{"x":0.5,"y":-0.05}},"rotation":{"kind":"preset","rotation":3}},{"id":"step-6","instruction":"Setter in zone 2, already at the right-front net to set. Receive line: OH1 (left), OH2 (middle), libero (right). MB at the front-left, OPP hidden back-left out of the serve.","positions":{"s":{"x":0.63,"y":0.05},"mb":{"x":0.08,"y":0.25},"lib":{"x":0.83,"y":0.76},"oh1":{"x":0.21,"y":0.7},"oh2":{"x":0.52,"y":0.76},"opp":{"x":0.35,"y":0.93},"ball":{"x":0.5,"y":-0.05}},"rotation":{"kind":"preset","rotation":2}}]$json$::jsonb,
    array['serve receive', '5-1', 'reception'], false
  )
on conflict (id) do nothing;

-- Team grants: the two samples to the Demo Team, the rotation board to the Inspiration showcase team (a
-- showcase grant reads as viewer for every account). User grants: each coach board (the two samples and
-- the scratch board) to the coach, and the rotation board to the admin, so they also sit in those
-- personal spaces.
insert into public.board_access (board_id, team_id, capability) values
  ('50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'owner'),
  ('50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'owner'),
  ('1d578c51-32c5-4e74-911e-feeba88cad71', '44444444-4444-4444-4444-444444444444', 'owner')
on conflict (board_id, team_id) where team_id is not null do nothing;

insert into public.board_access (board_id, user_id, capability) values
  ('50000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', 'owner'),
  ('50000000-0000-0000-0000-000000000002', 'c2222222-2222-2222-2222-222222222222', 'owner'),
  ('50000000-0000-0000-0000-000000000003', 'c2222222-2222-2222-2222-222222222222', 'owner'),
  ('1d578c51-32c5-4e74-911e-feeba88cad71', 'a1111111-1111-1111-1111-111111111111', 'owner')
on conflict (board_id, user_id) where user_id is not null do nothing;

-- 5. Notes. team_id is the home anchor (slug uniqueness); a team owner grant places a note in that team's
--    library, and a coach user grant also puts the Team Playbook in the coach's space. The Team Playbook
--    links the two team boards; the Rotations note (Inspiration showcase) links the 5-1 rotation board.
insert into public.topics (id, created_by, team_id, title, slug, blocks, parent_id, sort_order) values
  (
    '40000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222',
    '70000000-0000-0000-0000-000000000001', 'Team Playbook', 'team-playbook',
    $json$[{"id":"blk-intro","kind":"markdown","text":"Our base **defence** and a serve-receive sideout drill."},{"id":"blk-boards","kind":"boards","boardIds":["50000000-0000-0000-0000-000000000001","50000000-0000-0000-0000-000000000002"]}]$json$::jsonb,
    null, 0
  ),
  (
    '22222222-2222-2222-2222-222222222201', 'a1111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444', 'Rotations', 'rotations',
    $json$[{"id":"blk-overview","kind":"markdown","text":"## Overview\n\nThe court is divided into 6 zones (3 front and 3 back) and each starting player is assigned a zone at the beginning of the game. Players then rotate clockwise whenever they win the serve back.\n\n[Show rotation slips of 6 zones and the 6 rotations] \n\n## Rotation Rules\n\n### Out of Rotation\n\nA team is out of rotation if the following rules are not satisfied:\n\n- Every front-court player must not stand behind the player directly behind them in the rotation and every back-court player must not stand in front of the back-court player directly behind them (these rules only involve the following pairs 4&5, 3&6, 2&1).\n- Every player must not stand to the left of the player immediately left of them in the rotation (if any) and must not stand to the right of the player immediately right of them in the rotation (if any). This means players in 3&6 must watch left and right, while the other 4 players must only watch in one direction.\n   \n[Show rotation slip with the important connections that matter]\n\nNote that for a fault to occur both feet of one player must be out of rotation with both feet of the other player. Players are allowed to stack (feet overlapping).\n\n### Rotation Fault\n\nA *rotation fault* is committed when the receiving team is *out of rotation* the moment the server releases the board. Note that:\n- The rule only applies during the serve, and only the receiving team has to follow it (according to FIVB/LVA Rules since 2025)\n- The rule applies the exact moment the ball is released from the servers hand, i.e. when the ball is thrown, not served (again according to FIVB/LVA Rules since 2025)\n\n### Other Faults\n\nRotations also determine a few back-court/front-court related rules:\n\n- A back-court player must not commit a block\n- A back-court player must have both feet behind the 3m line when attacking the ball (if they jump, the take-off location matters)\n- A Libero may only swap for back-court players\n"},{"id":"blk-51","kind":"markdown","text":"## 5-1 Rotation\n\n5-1 Rotation is the most common "},{"id":"blk-boards","kind":"boards","boardIds":["1d578c51-32c5-4e74-911e-feeba88cad71"]}]$json$::jsonb,
    null, 0
  )
on conflict (id) do nothing;

insert into public.topic_access (topic_id, team_id, capability) values
  ('40000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'owner'),
  ('22222222-2222-2222-2222-222222222201', '44444444-4444-4444-4444-444444444444', 'owner')
on conflict (topic_id, team_id) where team_id is not null do nothing;

insert into public.topic_access (topic_id, user_id, capability) values
  ('40000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', 'owner'),
  ('22222222-2222-2222-2222-222222222201', 'a1111111-1111-1111-1111-111111111111', 'owner')
on conflict (topic_id, user_id) where user_id is not null do nothing;
