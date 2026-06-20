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

---

## Phase 3 — Provider Interface (Complete)

**Completed:** 2026-06-17
**Spec:** `docs/03-PROVIDER-INTERFACE.md`

### What was built

**Server Actions**
- `lib/actions/sessions.ts` — `createSessionTemplate`, `updateSessionTemplate`, `deleteSessionTemplate`; all require provider role via `requireRole`, validate name/patient, call `revalidatePath`
- `lib/actions/exercises.ts` — `addExercise`, `updateExercise`, `deleteExercise`, `reorderExercises`; validates name/sets/reps
- `lib/actions/patients.ts` — `removePatient`; sets `provider_id: null` on the patient row, enforces caller owns the patient

**Provider Dashboard** (`app/(dashboard)/provider/page.tsx`)
- Fully replaced placeholder; Server Component fetches patients + session_executions in parallel
- `StatsOverview` — 3-stat grid: total patients, sessions this week, avg compliance rate
- `PatientRosterCard` — tap-through list with Avatar, streak, last-active, color-coded compliance Badge
- `RecentActivity` — last 10 completed sessions with teal dot indicator
- `InvitationCodeWidget` + "Create Session Template" quick-action button

**Patient Pages**
- `app/(dashboard)/provider/patients/page.tsx` — Roster list (EmptyState when none)
- `app/(dashboard)/provider/patients/[patientId]/page.tsx` — Detail: profile header, assigned session with exercise list, session history with ease/pain scores, remove button
- `app/(dashboard)/provider/patients/[patientId]/RemovePatientButton.tsx` — Client component with confirmation Modal

**Session Templates**
- `app/(dashboard)/provider/templates/page.tsx` — Lists all templates with exercise count and assigned patient; links to edit
- `app/(dashboard)/provider/sessions/new/page.tsx` — Create form (accepts `?patientId` pre-fill)
- `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx` — Edit form with pre-loaded data
- `app/(dashboard)/provider/sessions/SessionForm.tsx` — Client component; handles create/edit/delete flow with `useTransition`
- `app/(dashboard)/provider/sessions/ExerciseList.tsx` — `@dnd-kit/sortable` drag-and-drop; inline name/sets/reps/patient_notes per row; lock icon on provider notes section

**Library**
- `app/(dashboard)/provider/library/page.tsx` — Exercise list (joined via sessions_template); Videos section placeholder

**Constants**
- `lib/constants.ts` — Added `providerPatients`, `providerTemplates`, `providerLibrary`, `providerSessionNew` routes

### Known gaps / next steps
- Library page videos section is a placeholder (Phase 5)
- Chat button on patient detail page links to Phase 6
- Export button on patient detail page links to Phase 7
- Compliance rate is a simple heuristic (completions / 7 days × 100); a more sophisticated calculation can replace it later

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

---

## Phase 5 — Multimedia (Complete)

**Completed:** 2026-06-18
**Spec:** `docs/05-MULTIMEDIA.md`
**Implementation plan:** `docs/superpowers/plans/2026-06-17-phase5-multimedia.md`

### Scoping decisions (locked)
- Both instructional videos (provider → exercise) and form-check videos (patient → exercise) in scope
- Fail-fast upload error handling — no retry, no offline queue
- Patient form-check videos surface as a dedicated "Videos" section at the bottom of the provider's patient detail page
- Provider instructional videos are inline on each exercise row in the session template form (edit mode only; new unsaved exercises show a "save first" message)
- Provider library Videos tab shows all provider-uploaded videos with exercise name labels
- Session-level video attacher (`SessionVideoAttacher`) **skipped for MVP**

### What was built

**Database**
- `supabase/migrations/20260617000002_phase5_multimedia.sql` — `ALTER TABLE exercises ADD COLUMN video_id uuid REFERENCES videos(id) ON DELETE SET NULL`; Supabase Storage bucket `exercise-videos` (private); RLS policies granting providers upload/read on their own videos and patients read on videos linked to their exercises
- **Apply this migration manually** via the Supabase Dashboard SQL Editor or CLI
- **Storage bucket must also be created manually** in the Supabase Dashboard (Storage → New bucket, name: `exercise-videos`, public: off)

**Server Actions**
- `lib/actions/videos.ts` — `getUploadUrl(filename, contentType)` returns a signed upload URL; `saveVideoMetadata(storagePath, exerciseId?)` inserts a row into `videos`; `getSignedPlaybackUrl(storagePath)` returns a short-lived signed URL for playback; `attachInstructionalVideo(exerciseId, videoId)` sets `exercises.video_id`; `getProviderVideos()` returns all videos uploaded by the current provider joined to exercise name; `getPatientFormVideos(patientId)` returns form-check videos for a given patient

**Shared Components**
- `components/shared/RecordVideo.tsx` — Client component using the `MediaRecorder` API; camera/mic permission request, record/stop/retake/confirm flow, uploads via signed URL, calls `saveVideoMetadata` on confirm; shows inline error on permission denial or upload failure
- `components/shared/VideoPlayer.tsx` — Server-compatible client component; fetches a signed playback URL via `getSignedPlaybackUrl` on mount, renders a native `<video>` element with controls; accepts `storagePath` and optional `label`

**Provider Components**
- `components/provider/ExerciseVideoAttacher.tsx` — Client component rendered per exercise row in edit mode; shows camera button when no video is attached, renders `VideoPlayer` inline when a video is attached; new (unsaved) exercises display "Save the exercise first to attach an instructional video."
- `app/(dashboard)/provider/sessions/ExerciseList.tsx` — Updated `ExerciseFormItem` to include `video_id` and `video_storage_path`; renders `ExerciseVideoAttacher` below each exercise's fields
- `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx` — Updated exercise fetch to include `video_id` and `videos(storage_path)`

**Patient Components**
- `components/patient/PatientFormRecord.tsx` — Client component with a "Record my form" button per exercise; opens `RecordVideo` inline; shows success confirmation after upload
- `components/patient/ExerciseExecutor.tsx` — Updated to render `PatientFormRecord` below each exercise's set-completion UI

**Provider Patient Detail**
- `app/(dashboard)/provider/patients/[patientId]/page.tsx` — Added "Form-check videos" section at the bottom; calls `getPatientFormVideos(patientId)` and renders each via `VideoPlayer`

**Provider Library**
- `app/(dashboard)/provider/library/page.tsx` — Replaced "Video library coming soon" placeholder with a live list; calls `getProviderVideos()` in parallel with the exercises query; renders each video via `VideoPlayer` with exercise name label and upload date; shows `EmptyState` when none

### Known gaps
- DB migration must be applied manually (no CLI configured)
- **Storage bucket `exercise-videos` MUST be created manually** in the Supabase Dashboard (Storage → New bucket, name: `exercise-videos`, public: off). If the bucket does not exist, every video upload attempt — both provider instructional videos and patient form-check recordings — will fail with "The related resource does not exist". This is a deployment prerequisite, not a code issue.
- `MediaRecorder` codec support varies by browser; Safari on iOS uses `video/mp4` while Chrome uses `video/webm` — the upload URL `contentType` is derived from the recorder's `mimeType` at runtime, so playback depends on the browser supporting the recorded format
- No automated tests for video upload/playback flow

---

## Phase 7 — Document Export (Complete)

**Completed:** 2026-06-18
**Spec:** `docs/07-DOCUMENT-EXPORT.md`
**Implementation plan:** `docs/superpowers/plans/2026-06-18-phase7-document-export.md`

### What was built

**API Route Handler**
- `app/api/export/patient-stats/route.ts` — `GET /api/export/patient-stats?patientId=UUID&from=YYYY-MM-DD&to=YYYY-MM-DD`. Authenticates the requesting provider via `supabase.auth.getUser()`, verifies provider-patient ownership (`users.provider_id`), aggregates stats for the date range, generates a PDF buffer via PDFKit, and returns it with `Content-Type: application/pdf` and `Content-Disposition: attachment`. Unauthenticated requests → 401; unauthorized provider → 403; missing params → 400.

**Data Aggregation** (inline in route handler)
- `getExportStats(supabase, patientId, from, to)` — queries `session_executions` for the date range; computes `totalCompleted`, `avgEase`, `avgPain`, `complianceRate` (sessions / days in range), `streak` (all-time, UTC), and the 10 most recent sessions for the session log.

**PDF Generation** (inline in route handler)
- `generatePdf(patient, stats, from, to)` — builds a PDFKit document in memory (Buffer via stream events). Sections: header with title + generation date; patient info (email, report period, member since); summary metrics (total sessions, streak, compliance %); patient-reported scores (avg ease + avg pain); recent sessions log (up to 10 rows with date, ease, pain).

**Provider UI**
- `app/(dashboard)/provider/patients/[patientId]/ExportButton.tsx` — Client component with a "Export Statistics to PDF" button. On click, fetches the route handler, creates a blob URL, triggers a browser download (`patient-<id>-stats.pdf`), and revokes the URL. Shows an error toast on failure.
- `app/(dashboard)/provider/patients/[patientId]/page.tsx` — Updated to render `ExportButton` above the existing `RemovePatientButton`.

**Dependencies added**
- `pdfkit@^0.19.1` — Server-side PDF generation
- `@types/pdfkit@^0.17.6` (devDependency) — TypeScript types for PDFKit

### Known gaps
- No export_logs / audit trail table (spec marks this optional for MVP)
- Date range is hardcoded on the client to `2024-01-01 → today`; a future iteration could expose a date picker
- Streak in the export is always calculated in UTC (no patient timezone available server-side for provider-initiated exports)
- No automated tests for PDF output (spec E2E test E2 deferred)

---

## Phase 6 — Realtime Chat (Complete)

**Completed:** 2026-06-18
**Spec:** `docs/06-REALTIME-CHAT.md`
**Design:** `docs/superpowers/specs/2026-06-18-phase6-realtime-chat-design.md`
**Plan:** `docs/superpowers/plans/2026-06-18-phase6-realtime-chat.md`

### Scoping decisions (locked)
- Text-only — no media attachments
- Routes: `/provider/chat` and `/patient/chat`; old `/messages` paths redirect
- Unread badge in scope; typing indicator + presence in scope
- Media attachments deferred to a future phase

### What was built

**Database**
- `supabase/migrations/20260618000000_phase6_chat.sql` — `is_read BOOLEAN NOT NULL DEFAULT false` column on `messages`; `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages`; `messages_mark_read` UPDATE policy for receivers; `idx_messages_unread` partial index

**Server Actions**
- `lib/actions/messages.ts` — `sendMessage`, `getMessages` (cursor-paginated), `getConversations` (groups by other participant), `markMessagesRead` (returns `void | { error: string }`), `getUnreadCount`

**Context**
- `components/chat/UnreadCountProvider.tsx` — React context bridging server-fetched unread count to the fixed BottomTabBar and ChatWindow

**Layout**
- `app/(dashboard)/layout.tsx` — fetches unread count in parallel with profile; wraps both `<main>` and `<BottomTabBar>` in `UnreadCountProvider`

**Components** (`components/chat/`)
- `UnreadBadge.tsx` — reads from context; red dot on Messages tab
- `PresenceDot.tsx` — green/gray online indicator
- `TypingIndicator.tsx` — "Name is typing…" with 2s timeout
- `MessageBubble.tsx` — sent/received styling, optimistic status, retry button
- `MessageInput.tsx` — textarea + send, 300ms debounced typing broadcast, timer cleanup on unmount
- `MessageList.tsx` — auto-scroll, scroll-position-preserving pagination, end-of-history marker; `useRef` guard prevents loadingMore race; `scrollTop <= 1` for high-DPI; prepend suppresses auto-scroll
- `ChatWindow.tsx` — Supabase Realtime channel (Postgres Changes + Broadcast + Presence), optimistic sends, reconnecting banner; server-side filter on postgres_changes; per-conversation badge decrement; runtime payload field guards
- `ChatList.tsx` — provider conversation list with unread counts

**Tab Bar**
- `components/shared/BottomTabBar.tsx` — routes updated to `/provider/chat` and `/patient/chat`; Messages tab shows `UnreadBadge`

**Pages**
- `app/(dashboard)/provider/chat/page.tsx` — conversation list
- `app/(dashboard)/provider/chat/[patientId]/page.tsx` — active chat
- `app/(dashboard)/patient/chat/page.tsx` — patient's single conversation
- `app/(dashboard)/provider/messages/page.tsx` — redirect
- `app/(dashboard)/patient/messages/page.tsx` — redirect

### Known gaps
- DB migration must be applied manually
- `messages.is_read` defaults to `false` for all pre-existing rows (treated as unread-legacy)
- Display name is patient/provider email (no separate name column in `users`)
- No automated tests for Realtime delivery (requires two live WebSocket clients)
- Media attachments not implemented
- `getConversations()` fetches all messages with no LIMIT — tracked in [GitHub issue #3](https://github.com/Tessera-Studios/Moveable-MVP/issues/3); defer fix until pre-scale

---

## Account Deletion + Audit Fixes (Complete)

**Completed:** 2026-06-18
**Plan:** `docs/superpowers/plans/2026-06-18-account-deletion.md`
**Audit:** `docs/SYSTEM-AUDIT-2026-06-18.md`

### What was built

**Account deletion**
- `supabase/migrations/20260618000001_account_deletion.sql` — drops `check_patient_has_provider`; drops/re-adds `users_id_fkey` without `ON DELETE CASCADE` so `public.users` (and all referencing rows) survive auth deletion. **Apply manually.**
- `lib/actions/account.ts` — `deletePatientAccount` (auth-delete first as the gate, then best-effort video purge) and `deleteProviderAccount` (blocked while patients are still linked). Both take no parameters and derive the user from the session, so there is no cross-account deletion path.
- `components/shared/DeleteAccountButton.tsx` — shared confirmation-modal button, wired into the patient profile and provider dashboard.

**Audit fixes** (see audit Resolution Log)
- **Confidentiality:** removed `sessions_template.provider_notes` from all patient-side queries (spec 03 — provider notes are provider-only).
- **PWA:** `public/icons/` (192/512 PNG + SVG) generated from `move-able.svg`; wired into manifest + metadata.
- **Timezone:** `components/shared/TimezoneSync.tsx` + `lib/timezone.ts` relay the client TZ via cookie; patient dashboard/progress streaks now use the local day.
- **Stats correctness:** export compliance rate uses distinct completed days; `completeSession` dedupes per local day.

**Testing**
- Vitest added (`npm test`). Pure stats/timezone logic extracted to `lib/stats.ts` and covered by `lib/stats.test.ts` + `lib/timezone.test.ts` (15 tests).

### Known gaps
- Migration applied manually (no CLI configured).
- I2 (patient profile name/phone/address + video history) needs new `users` columns + product decision — deferred.
- Integration tests (RLS, provider-notes-hidden, realtime) need a live test DB — not yet written.

---

## ISSUES.md Round — Video-first exercise add + patient session fix (Complete)

**Completed:** 2026-06-20

### What was fixed

**Patient session showed no exercises** (`app/(dashboard)/patient/session/[sessionId]/page.tsx`)
- The exercises query used an embedded PostgREST join `videos(storage_path)`, which can fail to resolve and null the entire result — so the patient saw no exercises even though the dashboard (which omits the join) listed them. Replaced with base-column fetch + a separate, fault-tolerant `videos` lookup by `video_id` (mirrors the edit page pattern).

**Video-first "Add exercise" flow that works before the session exists**
- `components/provider/VideoCaptureField.tsx` — NEW. Records + uploads an instructional video to Storage **without** writing to the DB. For not-yet-persisted exercises; the `videos` row + `exercises.video_id` link are wired when the exercise is saved.
- `components/provider/AddExerciseModal.tsx` — NEW. Modal with the instructional video as the primary top section, followed by name/sets/reps/notes. Returns the new exercise (incl. uploaded video storage path) to the form.
- `app/(dashboard)/provider/sessions/SessionForm.tsx` — "Add exercise" buttons now open `AddExerciseModal` (both create and edit mode). New `wirePendingVideo()` helper calls `saveVideoMetadata` + `attachInstructionalVideo` after each new exercise is persisted, on submit. Removed the edit-mode "instant persist on add" hack (no longer needed now that videos upload to Storage independently).
- `app/(dashboard)/provider/sessions/ExerciseList.tsx` — unpersisted rows (`new-` id) now render `VideoCaptureField` instead of the old "Save the exercise first…" message; persisted rows keep `ExerciseVideoAttacher`.
- No schema change required — `videos.exercise_id` is nullable and the videos RLS insert check only requires `uploader_id = auth.uid()`.

---

## Phases Remaining

| Phase | Spec | Status |
|---|---|---|
| 6 — Realtime Chat | `docs/06-REALTIME-CHAT.md` | Complete |
| 7 — Document Export | `docs/07-DOCUMENT-EXPORT.md` | Complete |
