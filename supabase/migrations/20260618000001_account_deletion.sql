-- Phase: Account Deletion & Codeless Registration
-- Apply via Supabase Dashboard SQL Editor or CLI.

-- 1. Drop the check that requires patients to always have a provider.
--    Needed for: codeless patient registration (provider_id starts as null)
--    and account deletion (anonymization sets provider_id back to null).
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS check_patient_has_provider;

-- 2. Replace the CASCADE foreign key on public.users.id → auth.users.id.
--    The original ON DELETE CASCADE would wipe the public.users row when the
--    auth user is deleted, defeating anonymized soft-deletion. Removing CASCADE
--    lets the public.users row (and all data referencing it) survive after the
--    auth account is gone.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id);
