-- Board-level rotation enforcement: strict clamps dragging at the legal boundary, loose (the
-- default) only flags violations. Per-step rotations need no migration: they nest in the existing
-- steps jsonb. No new grant or policy is required, because the table-level grants already cover new
-- columns and no RLS rule or trigger references this column.

alter table public.boards add column rotation_strict boolean not null default false;

notify pgrst, 'reload schema';
