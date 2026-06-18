# Account Deletion Design

**Date:** 2026-06-18

---

## Overview

Both providers and patients can delete their accounts. Deletion is a soft operation: the Supabase auth account is removed (preventing login) but the `public.users` row and all historical data are preserved so FK references from `session_executions`, `messages`, and `sessions_template` remain intact.

---

## DB Migration

File: `supabase/migrations/20260618000001_account_deletion.sql`

Two changes:

1. **Drop `check_patient_has_provider`** — the CHECK constraint `(role != 'patient' OR provider_id IS NOT NULL)` is dropped. Required for both codeless patient registration (Issue 3, where `provider_id` starts as null) and account deletion (anonymization sets `provider_id` back to null).

2. **Replace CASCADE FK on `public.users.id → auth.users.id`** — drop and re-add without `ON DELETE CASCADE`. This allows the `public.users` row to survive after the auth user is deleted, preserving all referencing data.

---

## Patient Deletion

### Server action: `deletePatientAccount()` (`lib/actions/account.ts`)

1. Assert authenticated caller has role `patient`
2. Fetch all videos uploaded by the patient (`videos WHERE uploader_id = userId`)
3. Delete each from Supabase Storage (`exercise-videos` bucket)
4. Delete the `videos` rows from the DB
5. Set `public.users.provider_id = null` — unlinks the patient from their provider's roster
6. Call `supabase.auth.admin.deleteUser(userId)` — auth account gone, `public.users` row stays

Returns `{ error: string }` on any failure, redirects to `/login` on success.

### Data outcome

| Table | Outcome |
|---|---|
| `auth.users` | Deleted |
| `public.users` | Stays (provider_id nulled) |
| `videos` | Deleted (storage + DB rows) |
| `session_executions` | Kept |
| `messages` | Kept |

### UI: `DeleteAccountButton`

Client component added at the bottom of `app/(dashboard)/patient/profile/page.tsx`, below `LogoutButton`.

On click: opens a confirmation modal with copy — *"This will permanently delete your account and your recorded videos. Your session history will be kept. This cannot be undone."* On confirm: calls `deletePatientAccount`, redirects to `/login` on success, shows inline error on failure.

---

## Provider Deletion

### Server action: `deleteProviderAccount()` (`lib/actions/account.ts`)

1. Assert authenticated caller has role `provider`
2. Count patients: `SELECT COUNT(*) FROM users WHERE provider_id = userId` — if > 0, return `{ error: "Remove all your patients before deleting your account." }`
3. Call `supabase.auth.admin.deleteUser(userId)` — auth account gone, `public.users` row stays

All provider data (session templates, exercises, instructional videos, invitation codes, messages) is preserved for patients' historical records.

Returns `{ error: string }` on any failure, redirects to `/login` on success.

### Data outcome

| Table | Outcome |
|---|---|
| `auth.users` | Deleted |
| `public.users` | Stays |
| `session_executions` | Kept |
| `sessions_template` | Kept |
| `exercises` | Kept |
| `videos` | Kept |
| `invitation_codes` | Kept |
| `messages` | Kept |

### UI: `DeleteAccountButton`

Added at the bottom of `app/(dashboard)/provider/page.tsx` in a "Danger Zone" section, below all other dashboard content.

On click: opens a confirmation modal with copy — *"This will permanently delete your account. Your patients' session history will be kept. This cannot be undone."* If the patient count check fails, the error is shown inline (not in the modal). On confirm: calls `deleteProviderAccount`, redirects to `/login` on success.

---

## Shared component: `DeleteAccountButton`

Single client component (`components/shared/DeleteAccountButton.tsx`) parameterised by role. Accepts the appropriate server action as a prop and renders the correct confirmation copy per role. Internally manages modal open state and pending/error UI.

---

## Known gaps

- No audit log for account deletions (acceptable for MVP)
- Provider instructional videos are kept even after provider deletion; a future cleanup job could purge orphaned storage objects
- `public.users` rows for deleted accounts are true orphans once auth is removed — no `deleted_at` flag; identifying them requires a JOIN against `auth.users` via the admin API
