-- migration 024: DB-level trigger to keep public.users in sync with auth.users
--
-- PURPOSE
-- -------
-- Ensures every future Supabase Auth signup automatically creates a
-- corresponding public.users row with the SAME UUID.  This is the
-- safety net below the application layer: even if app code fails to
-- call upsert after signUp(), the row is still created with the correct id.
--
-- WHAT IT DOES
-- ------------
-- After any INSERT into auth.users (i.e. every new signup, OAuth, magic-link,
-- or admin-created user), the trigger calls handle_new_auth_user() which
-- upserts public.users using new.id.
--
--   ON CONFLICT (id) DO UPDATE SET email = excluded.email
--     → if app code already inserted the row correctly, just refreshes email.
--
-- The function uses ON CONFLICT DO NOTHING for the whole insert if there is
-- any other uniqueness violation (e.g. a legacy duplicate-email row) so the
-- trigger never hard-errors on signup — the app code's login mismatch check
-- is the second line of defence for those pre-existing rows.
--
-- DOES NOT FIX existing mismatched rows: this trigger only prevents new ones.
-- To repair existing mismatches, run a targeted one-time fix script separately.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name',     split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
exception
  -- Suppress any other uniqueness violation (e.g. duplicate email from a
  -- legacy row with a different UUID).  The app-layer login mismatch check
  -- will surface the problem clearly to the user on their next login attempt.
  when unique_violation then
    return new;
end;
$$;

-- Drop and recreate so re-running the migration is idempotent.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
