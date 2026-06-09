-- Human-readable URL slugs for teams and topics. Minted once at creation (client-side from the title)
-- and stable across renames; this migration backfills existing rows with a SQL slugify, de-duplicated
-- with a window function. Boards keep their uuid and gain no slug.
-- No new grant or policy: slug rides on the existing full-row grants and RLS policies of both tables.

alter table public.teams add column slug text;
alter table public.topics add column slug text;

-- Mirrors src/routing/slug.ts: lowercase, fold common accents, hyphenate non-alphanumeric runs,
-- trim hyphens, fall back to 'untitled'.
create function pg_temp.slugify(input text) returns text
language sql immutable as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        lower(translate(input,
          'àáâäãåāèéêëēìíîïīòóôöõøōùúûüūçñýÿžšđ',
          'aaaaaaaeeeeeiiiiiooooooouuuuucnyyzsd')),
        '[^a-z0-9]+', '-', 'g')),
      ''),
    'untitled');
$$;

-- Teams: slugs are globally unique, so de-duplicate across the whole table.
with ranked as (
  select id, pg_temp.slugify(name) as base,
         row_number() over (partition by pg_temp.slugify(name) order by created_at, id) as rn
  from public.teams
)
update public.teams t
set slug = case when ranked.rn = 1 then ranked.base else ranked.base || '-' || ranked.rn end
from ranked
where t.id = ranked.id;

-- Topics: slugs are unique per space, so partition team topics by team and personal topics by owner.
with ranked as (
  select id, pg_temp.slugify(title) as base,
         row_number() over (
           partition by scope, coalesce(team_id, owner), pg_temp.slugify(title)
           order by created_at, id
         ) as rn
  from public.topics
)
update public.topics t
set slug = case when ranked.rn = 1 then ranked.base else ranked.base || '-' || ranked.rn end
from ranked
where t.id = ranked.id;

alter table public.teams alter column slug set not null;
alter table public.topics alter column slug set not null;

create unique index teams_slug_key on public.teams (slug);
create unique index topics_team_slug_key on public.topics (team_id, slug) where scope = 'team';
create unique index topics_personal_slug_key on public.topics (owner, slug) where scope = 'personal';

notify pgrst, 'reload schema';
