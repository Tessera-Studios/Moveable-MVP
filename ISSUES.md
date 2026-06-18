# Issues

This is a list of issues that need to be addressed before the MVP is ready for launch.

- [x] Patient Assignment: `public.users` had no `email` column; every provider query selecting `email` failed silently and returned null. Fixed by adding the column via migration `20260617000001_add_email_to_users.sql` and writing `email` on both `registerProvider` and `registerPatient` inserts. **Note: apply the migration in the Supabase Dashboard SQL Editor before testing.**
- [x] Exercises tab icon: The Exercises tab linked to `/patient/exercises`, which redirects to `/patient/profile`, so the active-state check never matched. Fixed by pointing the tab directly to `/patient/profile`.
