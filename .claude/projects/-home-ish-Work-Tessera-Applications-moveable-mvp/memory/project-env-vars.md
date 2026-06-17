---
name: project-env-vars
description: Supabase env var names used in this project (non-standard naming)
metadata:
  type: project
---

This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not the more common `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

**Why:** Matches the `.env.example` file committed to the repo.

**How to apply:** Always use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` when referencing the Supabase client key in any new file. Never write `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Required env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
