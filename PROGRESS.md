# Project Progress

This file tracks what has been built. Read it before starting any work so you know the current state of the codebase and don't duplicate or contradict existing implementations.

---

## Phase 1 — Foundation (Complete)

**Completed:** 2026-06-17  
**Spec:** `docs/01-FOUNDATION.md`

### What was built

**Design System**
- `app/globals.css` — Tailwind v4 `@theme inline` with all DESIGN.md tokens: 14 color variables, 3 shadow tokens, 3 border-radius tokens, Inter font stack as `--font-sans`. Light-only (no dark mode). Safe-area and hide-scrollbar utilities included.

**TypeScript Types & Constants**
- `lib/types.ts` — `UserRole`, `Profile`, `SessionTemplate`, `Exercise`, `SessionExecution`, `Video`, `Message`
- `lib/constants.ts` — `APP_NAME`, `APP_DESCRIPTION`, `MAX_CONTAINER_WIDTH`, `ROUTES`

**Supabase Clients**
- `lib/supabase/client.ts` — Browser client via `createBrowserClient` (`"use client"`)
- `lib/supabase/server.ts` — Server client via `createServerClient`, `await cookies()` (Next.js 16 async API)
- Env vars: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`)

**Auth Routing**
- `proxy.ts` — Next.js 16 auth proxy (replaces `middleware.ts`). Redirects unauthenticated users to `/login`; redirects authenticated users on `/login`/`/register` to their role-specific dashboard. Gracefully bypasses if env vars are not set.

**UI Primitives** (`components/ui/`)
- `Button` — 4 variants (primary, secondary, ghost, danger), 3 sizes, loading spinner, disabled state
- `Card` — with `Card.Header`, `Card.Body`, `Card.Footer` sub-components
- `Input` — label, error, hint slots; accessible via `useId`
- `Badge` — 5 variants (default, success, warning, error, info)
- `Avatar` — image → initials → SVG fallback, 3 sizes
- `LoadingSpinner` — 3 sizes, optional full-page overlay
- `EmptyState` — icon, title, description, action slots
- `Modal` — Escape + overlay close, focus management, ARIA dialog, 3 sizes
- `Toast` + `useToast` hook — context-based queue, slide-up animation, 3s auto-dismiss
- `index.ts` — barrel export for all primitives

**App Shell & Routes**
- `app/layout.tsx` — Inter font via `next/font`, `ToastProvider`, PWA metadata, separate `viewport` export (Next.js 16)
- `app/page.tsx` — immediate `redirect("/login")`
- `app/(auth)/login/page.tsx` — Supabase `signInWithPassword`, `router.refresh()` on success (proxy handles role routing)
- `app/(auth)/register/page.tsx` — `signUp` + profile upsert with role selection
- `app/(dashboard)/layout.tsx` — server-side `getUser()` + profile fetch, renders `BottomTabBar`
- `app/(dashboard)/provider/page.tsx` — placeholder
- `app/(dashboard)/patient/page.tsx` — placeholder
- `components/shared/BottomTabBar.tsx` — role-aware (provider/patient), 4 tabs each, `usePathname` for active state, inline SVGs, safe-area padding
- `public/manifest.json` — PWA manifest

### Known gaps / next steps
- No `hooks/` directory yet (add as hooks are needed)
- Dashboard pages are placeholders — Phase 2 (Authentication) and Phase 3+ build on top of them
- No icon set installed — current components use inline SVGs
- Supabase `profiles` table schema not yet created in the database (needed for role-based routing to work)

---

---

## Phase 2 — Authentication & Data Layer (Complete)

**Completed:** 2026-06-17
**Spec:** `docs/02-AUTHENTICATION.md`

### What was built

**Database Schema**
- `supabase/migrations/20260617000000_phase2_schema.sql` — Full schema for all 7 tables: `users`, `invitation_codes`, `sessions_template`, `exercises`, `session_executions`, `videos`, `messages`; enums `user_role` and `execution_status`; all indexes; RLS enabled on every table; `authenticated` role GRANTs; all RLS policies with `WITH CHECK` clauses
- **Apply this migration manually** via the Supabase Dashboard SQL Editor or CLI

**Server Actions**
- `lib/actions/auth.ts` — `registerProvider(email, password)` and `registerPatient(email, password, code)`. Patient registration validates the code exists, is unconsumed, and unexpired before creating the auth user and inserting into `public.users`.
- `lib/actions/invitation.ts` — `generateInvitationCode()`. Provider-only server action that generates a 12-char base64url code via `crypto.randomBytes`, inserts it into `invitation_codes`, and returns the code.

**Auth Flows**
- `app/(auth)/register/page.tsx` — Rewritten as a three-state page:
  - Default (`/register`): role picker (Provider vs Patient)
  - `/register?role=provider`: provider email/password form
  - `/register?role=patient` or `/register?code=XXXX`: patient form with invitation code field (code pre-filled when passed via URL)

**Routing & Auth Guard**
- `proxy.ts` — Updated to use `getUser()` (secure, verifies with auth server) instead of `getSession()`. Changed `profiles` table reference to `users`.
- `app/(dashboard)/layout.tsx` — Changed `profiles` table reference to `users`.

**Provider Dashboard Widget**
- `app/(dashboard)/provider/InvitationCodeWidget.tsx` — Client component with "Generate invitation code" button. Shows the generated code with a one-click copy button. Calls `generateInvitationCode` server action.
- `app/(dashboard)/provider/page.tsx` — Now renders `InvitationCodeWidget`.

**Types**
- `lib/types.ts` — Added `InvitationCode` interface.

### Known gaps / next steps
- The SQL migration must be applied manually to the Supabase project (no CLI configured)
- `public.users` table shadows `auth.users` name in different schemas — this is intentional per spec; all app queries use `public.users`
- Email confirmation flow: Supabase by default sends a confirmation email; for local dev, disable "Confirm email" in Auth settings or use inbucket
- No test suite yet for invitation code uniqueness (U1) or consumption flow (I2)

---

## Phase 4 — Patient Interface & Gamification (Complete)

**Completed:** 2026-06-17
**Spec:** `docs/04-PATIENT-INTERFACE.md`

### What was built

**Server Actions**
- `lib/actions/executions.ts` — `completeSession(sessionTemplateId, easeScore, painScore, timezone)` writes to `session_executions`, calculates streak using timezone-aware date grouping, and returns `{ streak, totalCompleted }`. `getPatientStats(timezone)` aggregates all stats (30-day history, pain/ease scores, streak) for the progress and dashboard pages.

**Types**
- `lib/types.ts` — Added `PatientStats` interface.

**Patient Dashboard** (`/patient`)
- `app/(dashboard)/patient/page.tsx` — Server component with `Suspense` skeleton fallback. Fetches most recent session template and exercises alongside stats in parallel.
- `components/patient/StreakBanner.tsx` — Full-width gradient hero (blue→teal) with 56px bold streak count, motivational copy, and total sessions.
- `components/patient/ActiveSessionCard.tsx` — Client component with `@dnd-kit/sortable` drag-and-drop exercise reordering. Passes final order as URL param to session page. No network calls during reorder.
- `components/patient/ProgressPreview.tsx` — 7-bar mini chart (green/gray) showing last 7 days of completions.

**Session Execution** (`/patient/session/[sessionId]`)
- `app/(dashboard)/patient/session/[sessionId]/page.tsx` — Server page that fetches and applies URL-param exercise ordering.
- `components/patient/ExerciseExecutor.tsx` — Client component managing all session state: current exercise index, completed sets per exercise, progress bar, dot navigation. Set completion circles animate on mark (CSS `setComplete` keyframe). Finish button appears when all exercises complete.
- `app/globals.css` — Added `@keyframes setComplete` with `prefers-reduced-motion` support.

**Feedback** (`/patient/session/[sessionId]/feedback`)
- `app/(dashboard)/patient/session/[sessionId]/feedback/page.tsx` — Server page.
- `components/patient/FeedbackForm.tsx` — Client component with emoji rating buttons for ease (1–5) and pain (1–5). Calls `completeSession` server action, shows streak toast on success, navigates to `/patient/progress`.

**Profile** (`/patient/profile`)
- `app/(dashboard)/patient/profile/page.tsx` — Server component showing avatar, email, member-since, provider notes (per session), full exercise list, and provider info card.

**Progress** (`/patient/progress`)
- `app/(dashboard)/patient/progress/page.tsx` — Server page with Suspense skeleton.
- `components/patient/ProgressCharts.tsx` — Client component using recharts `BarChart` (30-day completions) and two `LineChart`s (pain and ease trends). Summary stat tiles (streak, total, 30-day compliance %).

**Navigation**
- `app/(dashboard)/patient/exercises/page.tsx` — Redirects to `/patient/profile`.

**Dependencies added**
- `recharts@^3.8.1` — Chart library for progress page.

### Known gaps / next steps
- Timezone is hardcoded to `"UTC"` server-side; client should send `Intl.DateTimeFormat().resolvedOptions().timeZone` (done in `FeedbackForm` but dashboard load uses UTC).
- MessageBadge on dashboard skipped — Phase 6 (Realtime Chat).
- "Record My Form" button in session execution skipped — Phase 5 (Multimedia).
- No automated test suite for streak calculation (U2) or drag-and-drop client-only assertion (U3).
- Patient profile shows no phone/address — these columns don't exist in the current schema.

---

## Phases Remaining

| Phase | Spec | Status |
|---|---|---|
| 3 — Provider Interface | `docs/03-PROVIDER-INTERFACE.md` | Not started |
| 4 — Patient Interface | `docs/04-PATIENT-INTERFACE.md` | Complete |
| 5 — Multimedia | `docs/05-MULTIMEDIA.md` | Not started |
| 6 — Realtime Chat | `docs/06-REALTIME-CHAT.md` | Not started |
| 7 — Document Export | `docs/07-DOCUMENT-EXPORT.md` | Not started |
