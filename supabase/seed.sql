-- VolleyCoach Phase 2 — first-run seed.
-- Run ONCE, AFTER applying the migrations and bootstrapping your admin account (create the account,
-- then `update public.profiles set is_admin = true where email = '<you>';`). It creates the first team,
-- makes you its coach, and fills its library with the Phase 1 samples so the app opens with content.
-- Idempotent: re-running it changes nothing (fixed ids, on-conflict-do-nothing).

do $$
declare
  v_admin uuid;
  v_team uuid := '11111111-1111-1111-1111-111111111111';
begin
  select id into v_admin from public.profiles where is_admin order by created_at limit 1;
  if v_admin is null then
    raise exception 'No admin profile found. Create your account and set is_admin = true before seeding.';
  end if;

  insert into public.teams (id, name) values (v_team, 'My Team')
  on conflict (id) do nothing;

  insert into public.memberships (team_id, user_id, role) values (v_team, v_admin, 'coach')
  on conflict (team_id, user_id) do nothing;

  insert into public.topics (id, owner, scope, team_id, title, blocks, parent_id, sort_order) values
    (
      '22222222-2222-2222-2222-222222222201', v_admin, 'team', v_team, 'Rotations',
      $json$[{"id":"topic-rotations-intro","kind":"markdown","text":"How we line up and rotate — serve-receive and base positions through each rotation."}]$json$::jsonb,
      null, 0
    ),
    (
      '22222222-2222-2222-2222-222222222202', v_admin, 'team', v_team, 'Defense',
      $json$[{"id":"topic-defense-intro","kind":"markdown","text":"Our base defence and how we read the attack — who takes the line, who digs cross-court."}]$json$::jsonb,
      null, 1
    ),
    (
      '22222222-2222-2222-2222-222222222203', v_admin, 'team', v_team, 'Drills',
      $json$[{"id":"topic-drills-intro","kind":"markdown","text":"Repeatable **drills** for training: serve receive, transition, and out-of-system reps."}]$json$::jsonb,
      null, 2
    )
  on conflict (id) do nothing;

  insert into public.boards (id, owner, scope, team_id, title, description, mode, markers, steps, tags, topic_id) values
    (
      '33333333-3333-3333-3333-333333333301', v_admin, 'team', v_team,
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
      array['sample', 'defense'],
      '22222222-2222-2222-2222-222222222202'
    ),
    (
      '33333333-3333-3333-3333-333333333302', v_admin, 'team', v_team,
      'Sample Drill (Serve Receive & Sideout)',
      $md$### Serve Reception & Sideout$md$,
      'positions',
      $json$[{"id":"s","role":"setter","label":"S"},{"id":"mb1","role":"middle","label":"MB1"},{"id":"oh1","role":"outside","label":"OH1"},{"id":"oh2","role":"outside","label":"OH2"},{"id":"l","role":"libero","label":"L"},{"id":"ball","role":"ball"}]$json$::jsonb,
      $json$[{"id":"step-1","instruction":"- Serve receive\n- L and OH2 each cover 40% of the court\n- OH1 covers the remaining 20%","positions":{"s":{"x":0.72,"y":0.18},"mb1":{"x":0.4,"y":0.15},"oh1":{"x":0.1,"y":0.66},"oh2":{"x":0.8,"y":0.72},"l":{"x":0.4,"y":0.72},"ball":{"x":0.6,"y":-0.09}}},{"id":"step-2","instruction":"- Pass to the middle, close to the net\n- OH1 kicks out wide for the approach","positions":{"s":{"x":0.52,"y":0.13},"mb1":{"x":0.42,"y":0.15},"oh1":{"x":0.0,"y":0.48},"oh2":{"x":0.78,"y":0.62},"l":{"x":0.58,"y":0.72},"ball":{"x":0.6,"y":0.72}}},{"id":"step-3","instruction":"- Set to the antenna\n- MB1 jumps with the set","positions":{"s":{"x":0.5,"y":0.11},"mb1":{"x":0.38,"y":0.06},"oh1":{"x":-0.1,"y":0.3},"oh2":{"x":0.5,"y":0.6},"l":{"x":0.35,"y":0.52},"ball":{"x":0.5,"y":0.13}}},{"id":"step-4","instruction":"- OH1 attacks\n- Everyone covers: libero, MB1 and setter tight, OH2 deep in the middle","positions":{"s":{"x":0.45,"y":0.15},"mb1":{"x":0.25,"y":0.12},"oh1":{"x":0.06,"y":0.13},"oh2":{"x":0.45,"y":0.55},"l":{"x":0.1,"y":0.3},"ball":{"x":0.06,"y":0.05}}}]$json$::jsonb,
      array['sample', 'reception'],
      '22222222-2222-2222-2222-222222222203'
    )
  on conflict (id) do nothing;
end $$;
