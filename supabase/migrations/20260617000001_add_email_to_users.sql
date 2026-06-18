-- Add email column to public.users so the app can display patient/provider emails
-- without querying auth.users (which is inaccessible via the normal client).
-- Apply via Supabase Dashboard SQL Editor or CLI.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
