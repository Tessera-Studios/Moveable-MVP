# Issues Fixes Design

**Date:** 2026-06-18  
**Issues:** ISSUES.md — PWA manifest, app name, codeless patient registration

---

## Issue 1 — PWA Manifest

**Root cause:** `public/manifest.json` references `/icons/icon-192.png` and `/icons/icon-512.png`. These files do not exist in `public/`, causing browsers to report manifest errors. The JSON itself is syntactically valid.

**Fix:** The icon files will be added manually by the developer. No code change required beyond the name update in Issue 2. Once the PNGs land in `public/icons/`, the PWA errors resolve automatically.

**Icon purposes:**
- 192×192 — Android/Chrome home screen icon
- 512×512 — PWA splash screen and required for Chrome's "Add to Home Screen" install prompt

---

## Issue 2 — App Name: "Move Able"

Replace all occurrences of `"Moveable"` with `"Move Able"` in six files:

| File | Location |
|---|---|
| `lib/constants.ts` | Line 1 — `APP_NAME` constant |
| `app/layout.tsx` | Lines 12, 15 — `title` and `appleWebApp.title` |
| `app/(auth)/login/page.tsx` | Line 58 — heading |
| `app/(auth)/register/page.tsx` | Lines 34, 121, 202 — headings in all three signup views |
| `public/manifest.json` | Lines 2, 3 — `name` and `short_name` |

`app/api/export/patient-stats/route.ts` already uses `"Move Able"` — no change needed.

---

## Issue 3 — Codeless Patient Registration

### Goal

Allow patients to create an account without an invitation code, then enter the code later from their profile page. Once linked to a provider, the code entry is locked — the patient must be removed by the provider (existing `removePatient` action sets `provider_id: null`) before re-linking is possible.

### Changes

#### `lib/actions/auth.ts` — `registerPatient`

Make the `code` parameter optional at the action level. If `code.trim()` is empty, skip all invitation code validation and insert the user row with `provider_id: null`. Non-empty codes continue through the full existing validation path (exists, unconsumed, unexpired) unchanged.

```
if (code.trim() === "") {
  // insert user with provider_id: null, skip code validation
} else {
  // existing validation + consume flow
}
```

#### `app/(auth)/register/page.tsx` — `PatientSignup`

- Remove `required` from the invitation code `<input>`
- Update placeholder to `"XXXXXXXXXXXX (optional)"`
- No other changes — empty string is passed to the action as-is

#### `lib/actions/invitation.ts` — new `claimInvitationCode(code: string)`

Authenticated server action, patient role only.

Steps:
1. Assert caller is authenticated with role `patient` (via `requireRole`)
2. Look up code via admin client: must exist, `is_consumed: false`, `expires_at` not past
3. Assert caller's `provider_id` is currently `null` — if not, return `{ error: "You are already linked to a provider." }`
4. Update `users.provider_id` to `invite.provider_id`
5. Mark `invitation_codes.is_consumed = true`
6. Call `revalidatePath("/patient/profile")`
7. Return `void` on success, `{ error: string }` on any failure

#### `components/patient/ConnectProviderWidget.tsx` — new client component

Rendered only when `profile.provider_id` is null.

UI: a card with heading "Connect with your provider", a single code input, and a "Connect" submit button. Calls `claimInvitationCode`, shows inline error on failure. On success, `revalidatePath` causes the server component to re-render — the widget disappears and the "Your Therapist" provider card becomes visible.

#### `app/(dashboard)/patient/profile/page.tsx`

Add `ConnectProviderWidget` below the existing provider info card, conditionally rendered when `!profile?.provider_id`.

### Patient experience without a provider

The dashboard, session, and progress pages already handle `null` provider gracefully with empty states. No changes needed.

### Data integrity

- A patient with no code has `provider_id: null` in `public.users` — valid per existing schema
- `claimInvitationCode` uses the admin client for the code lookup (same as `registerPatient`) to bypass RLS
- Code consumption is not atomic with the `provider_id` update; if the update succeeds but consumption fails, the code remains consumable. Risk is low for MVP — can be wrapped in a Postgres function if needed later

---

## Out of Scope

- Creating PNG icon assets (developer task)
- Atomic code claim transaction (deferred to post-MVP)
- Allowing patients to switch providers without provider intervention
