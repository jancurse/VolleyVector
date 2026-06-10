-- Account deletion as a soft-delete with a 3-month recovery window.
-- Deleting an account no longer hard-deletes the auth user. The delete-account Edge Function bans the user
-- (so they cannot log in) and flags the profile; an admin can restore within the window (restore-account
-- Edge Function un-bans and clears the flag); a scheduled purge (purge-expired Edge Function) hard-deletes
-- afterwards. Team content the user authored is detached to the team at deletion time (owner -> null) and is
-- never part of the recovery window. This migration adds the profile flag and simplifies delete_team.

alter table public.profiles
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

create index profiles_deleted_idx on public.profiles (deleted_at) where deleted_at is not null;

-- A deleted profile stays readable by admins (god-mode) for the recovery list; the existing profiles_select
-- policy covers it. Restoring (clearing deleted_at) and un-banning run in the restore-account Edge Function
-- under the service role, so no new client grant or policy is needed.

-- delete_team now flags only the team. Its boards and topics stay intact (deleted_at stays null) but are
-- unreachable because the team drops out of the space switcher; restoring the team brings them back with no
-- per-row work, and purging the team cascade-removes them (boards/topics FK team_id -> teams on delete
-- cascade). This keeps the admin recovery list of grace-archived boards/topics limited to items an owner or
-- coach deleted individually, instead of the hundreds a team removal would otherwise stamp.
create or replace function public.delete_team(team uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin may delete a team';
  end if;
  update public.teams set deleted_at = now() where id = team;
end;
$$;

notify pgrst, 'reload schema';
