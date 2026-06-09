-- Board-level toggle for the derived movement arrows.
-- Auto arrows become an on/off switch (default on, matching the prior always-on behaviour) so a coach can
-- hide them and rely on manual arrow annotations instead. Annotations themselves need no migration: they
-- nest in the existing steps jsonb. No new grant or policy is required, because the table-level grants
-- already cover new columns and no RLS rule references this column; the boards guard trigger only checks
-- owner/author_locked, so the column trips nothing.

alter table public.boards add column auto_arrows boolean not null default true;

notify pgrst, 'reload schema';
