# MVP Issue Fixes — Design Spec

**Date:** 2026-06-20  
**Issues:** ISSUES.md items 1–6  
**Status:** Approved for planning

---

## Overview

Six pre-launch issues covering auth form UX, profile navigation, session editing bugs,
and exercise visibility. They are grouped into four independent work streams that can
run in parallel. A shared-dependency map is listed first so agents know which files
they own exclusively.

---

## Shared Dependency Map

| File | Owner group | Notes |
|---|---|---|
| `app/(auth)/register/page.tsx` | **Group A** | Issues 1 + 2 both touch this file — must be one agent |
| `app/(auth)/login/page.tsx` | **Group A** | Issue 2 only |
| `components/shared/BottomTabBar.tsx` | **Group B** | Tab changes for both roles |
| `app/(dashboard)/provider/page.tsx` | **Group B** | Message icon added to greeting row; LogoutButton + DangerZone removed |
| `app/(dashboard)/provider/profile/` | **Group B** | New file — no conflict |
| `app/(dashboard)/patient/page.tsx` | **Group B** | Message icon added near StreakBanner |
| `app/(dashboard)/patient/profile/page.tsx` | **Group B** | Stripped to account-only |
| `app/(dashboard)/patient/exercises/page.tsx` | **Group B** | Converted from redirect to real page |
| `app/(dashboard)/provider/sessions/SessionForm.tsx` | **Group C** | Issues 4 + 5 both touch this |
| `app/(dashboard)/provider/sessions/ExerciseList.tsx` | **Group C** | Issue 4 touches this |
| `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx` | **Group C** | Issue 4 — possible error boundary |

No file is shared across groups. All four groups may run in parallel.

---

## Group A — Auth Form UX (Issues 1 + 2)

**Files touched:** `app/(auth)/register/page.tsx`, `app/(auth)/login/page.tsx`

### Issue 1: Invitation code field — reorder + label

**Change:** In `PatientSignup`, move the invitation code `<Field>` block to after
the Confirm Password field (last position in the form). Change the `<Field>` label
from `"Invitation code"` to `"Invitation code (optional)"`. Remove `"(optional)"` from
the placeholder text; the placeholder can simply be `"XXXXXXXXXXXX"` or `"Paste your code"`.

**Why last:** New patients encounter the code field first even though most of the
time they fill it from a shared link. Putting it last makes the critical path
(email → password → confirm) uninterrupted and frames the code as a bonus step.

### Issue 2: Password show/hide toggle

**Scope:** All `type="password"` inputs across `register/page.tsx` (3 inputs:
password + confirm × 2 forms) and `login/page.tsx` (1 input).

**Implementation:** Add a `PasswordField` component inline in `register/page.tsx`
(not a new shared file — login already has its own inline structure). The component:

- Wraps the `<input>` in a `relative` div
- Renders an absolutely-positioned `<button type="button">` on the right with the
  label "Show" / "Hide" (text, not icon, for clarity on small screens)
- Toggles between `type="password"` and `type="text"` via local `useState<boolean>`
- The button has `aria-label="Show password"` / `"Hide password"` for accessibility
- Input gets `pr-16` to avoid text running under the button

For `login/page.tsx`: since the form uses `state` directly (not the `Field` wrapper),
inline the same toggle pattern around the existing password `<div>`.

**No shared component file** — the pattern is two instances and the pages have
different structures; a shared abstraction would overcomplicate a two-line fix.

---

## Group B — Profile Screens & Navigation (Issue 3)

**Files touched:** `BottomTabBar.tsx`, `provider/page.tsx`,
`provider/profile/page.tsx` (new), `patient/page.tsx`, `patient/profile/page.tsx`,
`patient/exercises/page.tsx`

### BottomTabBar changes

**Provider tabs** (was: Home, Patients, Templates, Messages):
→ **Home, Patients, Templates, Profile**

- Remove the Messages entry from `PROVIDER_TABS`
- Add `{ label: "Profile", path: "/provider/profile", icon: <IconUser /> }` in slot 4
- Add an `IconUser` inline SVG (person silhouette, same style as existing icons)

**Patient tabs** (was: Home, Exercises → /patient/profile, Progress, Messages):
→ **Home, Exercises → /patient/exercises, Progress, Profile → /patient/profile**

- Change the Exercises tab `path` from `"/patient/profile"` to `"/patient/exercises"`
- Change the Messages tab to `{ label: "Profile", path: "/patient/profile", ... }` with `IconUser`
- Remove `showBadge` from the old Messages slot

### Message icon on Home pages

**Provider home** (`app/(dashboard)/provider/page.tsx`):  
In the greeting `<div>` at the top, replace the plain `<h1>` row with a flex row:
```
[h1: greeting text]   [icon button → /provider/chat]
```
The message icon button is a `<Link>` wrapping `<IconMessageCircle>` (reuse the same
SVG), with `relative` positioning so an `<UnreadBadge />` can overlay it (import
from `components/chat/UnreadBadge`). Also remove `<LogoutButton />` and the
Danger Zone block from this page — they move to the profile page.

**Patient home** (`app/(dashboard)/patient/page.tsx`):  
The home page is dominated by `<StreakBanner>` which fills full width. Add the
message icon as an absolute-positioned overlay in the top-right corner of the
streak banner area, or as a small icon row above the banner. Simplest approach:
add a `<div className="flex justify-end px-5 pt-4">` row above `<StreakBanner>`,
containing a `<Link href="/patient/chat">` with `<IconMessageCircle>` and
`<UnreadBadge />` overlay. This keeps the banner untouched.

### Provider profile page (new)

**Route:** `app/(dashboard)/provider/profile/page.tsx`

Server component. Fetches the authenticated user (`supabase.auth.getUser()`) and
their `public.users` row for the role. Renders:

1. **Profile header card** — avatar initials, email, role badge ("Provider"), member since
2. **Sign out** — `<LogoutButton />` (already shared)
3. **Danger zone card** — `<DeleteAccountButton>` with the same props as currently on `provider/page.tsx`

Move `<LogoutButton />` and the Danger Zone block out of `provider/page.tsx` entirely
and into this new page. `provider/page.tsx` should not import or render either after
this change.

### Patient profile page — stripped

**Route:** `app/(dashboard)/patient/profile/page.tsx` (existing, modify)

Remove the "Your Exercises" card section entirely (exercises move to the exercises page).
Retain:
- Profile header card (avatar, email, member since, role)
- `<ConnectProviderWidget />` (or provider info card if linked)
- `<LogoutButton />`
- Danger zone card

### Patient exercises page — new real page

**Route:** `app/(dashboard)/patient/exercises/page.tsx` (currently a redirect, replace)

Server component. Fetches sessions + exercises exactly as the current profile page
does. Renders only the "Your Exercises" card. No account controls, no logout.

If no exercises: show `<EmptyState>` with title "No exercises assigned yet" and
description "Your physical therapist will assign exercises once you're connected."

---

## Group C — Session Editing (Issues 4 + 5)

**Files touched:** `SessionForm.tsx`, `ExerciseList.tsx`,
`provider/sessions/[sessionId]/edit/page.tsx`

### Issue 4: Blank edit page

**Root cause (suspected):** `ExerciseList` uses `@dnd-kit/core`'s `DndContext`, which
is known to cause hydration mismatches in Next.js when rendered server-side. If the
component throws during hydration without an error boundary, the entire route goes
blank with no visible error. A secondary suspect is a crash inside `ExerciseVideoAttacher`
when it attempts to render a `VideoPlayer` during the initial render.

**Fix approach:**

1. Wrap `<ExerciseList>` in `SessionForm.tsx` in a `dynamic()` import with
   `{ ssr: false }` to eliminate any SSR/hydration mismatch from dnd-kit:
   ```tsx
   const ExerciseList = dynamic(() => import("./ExerciseList").then(m => m.ExerciseList), { ssr: false });
   ```
   This is the correct Next.js pattern for client-only drag-and-drop.

2. Add a React error boundary around the `<SessionForm>` in the edit page so that
   if a crash still occurs it surfaces as a readable error instead of a blank page.
   Use a simple inline `ErrorBoundary` class component in the edit page file.

3. If the dynamic import alone fixes the blank page, the error boundary can stay as
   a permanent safety net — remove the boundary only if instructed.

**Verify:** After fix, navigate to `/provider/sessions/[id]/edit` for a session with
at least one exercise and confirm the form renders.

### Issue 5: No way to save an exercise without saving the session

**Context:** In edit mode, new exercises start as `isNew: true` with a temp ID. The
`ExerciseVideoAttacher` detects `isNew` and shows "Save the exercise first to attach
a video." The only path to a real ID is saving the entire session.

**Fix:** In **edit mode only**, when the user clicks "+ Add exercise" in `SessionForm`,
immediately call `addExercise(sessionId, {...})` server action to persist the exercise
and get a real UUID back. Replace the temp entry in local state with the returned ID.
The exercise is then no longer `isNew`, and video attachment works immediately.

**Detail:**
- `addNewExercise()` in `SessionForm` currently just does `setExercises(...)` with a
  temp ID. In edit mode, change it to an async function that calls `addExercise` and
  updates state with the real ID on success.
- If `addExercise` fails (e.g., blank name), fall back to the current local-only
  behavior and show an inline error; the user can still fill in the name and save the
  full session.
- Create mode is unchanged — exercises batch-save with the session.

**Also fix:** In edit mode `handleSubmit`, the `await Promise.all([...toAdd, ...toUpdate, ...toDelete])` 
call currently discards all return values. Add error checking: collect any `{ error }` 
results and surface them via `setError`. This prevents silent exercise-save failures 
that cause issue 6.

---

## Group D — Patient Can't See Exercises (Issue 6)

**Files touched:** `app/(dashboard)/provider/sessions/SessionForm.tsx` (same fix as
Group C issue 5 handles the silent failure) **and** possibly
`app/(dashboard)/patient/session/[sessionId]/page.tsx`.

**Root cause:** The RLS policy `exercises_patient` exists and is structurally correct
(verified in migration `20260617000000_phase2_schema.sql`). The actual gap is in
`SessionForm` edit mode: `Promise.all([...toAdd.map(addExercise)])` does not check
return values, so exercises with empty names (or other validation failures) silently
fail to persist. The session template is updated but the exercises table stays empty.

**Fix (Group C already covers it):** Adding error-result checks to the edit-mode
`handleSubmit` (Group C Issue 5 fix) resolves this. Group D is therefore dependent
on Group C completing first, but requires no additional file changes beyond what
Group C produces.

**Secondary check:** The patient session execution page
`app/(dashboard)/patient/session/[sessionId]/page.tsx` should also be verified — if
the exercises array is empty it may render incorrectly (a blank exercise list instead
of an empty state). Add an `EmptyState` guard if the exercises array is empty.

---

## Non-goals

- No new database migrations required for any of these fixes.
- No changes to Supabase RLS policies.
- No changes to the chat or messaging logic — only tab/icon routing changes.
- No design system additions — reuse existing `EmptyState`, `Button`, `LogoutButton`,
  `DeleteAccountButton`, `UnreadBadge` components.

---

## Success criteria

| # | Criterion |
|---|---|
| 1 | Patient signup form shows email → password → confirm → invitation code (last, labeled optional) |
| 2 | All password fields on login and register have a Show/Hide toggle that reveals the typed password |
| 3 | Provider has a Profile tab leading to a page with email, role, sign out, danger zone; no logout/danger on the Home dashboard |
| 3 | Patient has an Exercises tab (exercises-only list) and a Profile tab (email, role, connect provider, sign out, danger zone) |
| 3 | Both home pages have a message icon in the header area linking to the chat route |
| 4 | Navigating to `/provider/sessions/[id]/edit` renders the session form — no blank page |
| 5 | In edit mode, clicking "+ Add exercise" saves the exercise to the DB immediately; video can be attached without a full session save |
| 6 | After a provider creates a session with exercises, the patient sees those exercises on their Home and session pages |
