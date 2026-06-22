# MVP Issue Fixes

**Date:** 2026-06-20
**Issues:** `ISSUES.md`

## Issue 1 — "Add another exercise" button at bottom of list

**Root cause:** `SessionForm.tsx:317-323` — the "+ Add exercise" button is only in the section header above `<ExerciseList>`. When there are many exercises, users must scroll back up to add another.

**Fix:** Add a duplicate "+ Add exercise" button below the `<ExerciseList>` component (after line 335), inside the `exercises.length > 0` branch.

**Files to modify:**
- `app/(dashboard)/provider/sessions/SessionForm.tsx` — add second button after `</ExerciseList>` in the ternary at line 334-336.

**Verification:** Visual — the button appears both above and below the exercise list.

---

## Issue 2 — Back camera toggle on mobile

**Root cause:** `RecordVideo.tsx:68` — `getUserMedia({ video: { facingMode: "user" } })` hardcodes the front camera.

**Fix:**
1. Add state variable to track current facing mode (`"user"` | `"environment"`).
2. Add a toggle button (camera flip icon) visible during `"idle"` recording state.
3. On toggle: stop all current stream tracks, then re-request `getUserMedia` with the opposite `facingMode`.
4. Re-start the camera preview on the same `<video>` element.

**Files to modify:**
- `components/shared/RecordVideo.tsx`

**Edge cases:**
- Devices with only one camera: the `getUserMedia` call with an unsupported facingMode will throw — catch this gracefully and show a toast/error message (do NOT toggle if the new facingMode isn't available).
- `prefers-reduced-motion`: no animation concerns.

**Verification:** On a device with front + back cameras, the toggle button switches between them. On single-camera devices, the button either does nothing or is hidden.

---

## Issue 3 — Patients can't see instructional videos

### 3a: Patient ExerciseExecutor doesn't display instructional videos

**Root cause:** `ExerciseExecutor.tsx` receives `exercises[]` with `video_id` but never renders any video playback UI. The provider's instructional recording is fetched but unused on the patient side.

**Fix:**
1. Add `video_storage_path?: string | null` to the `Exercise` type in `lib/types.ts`.
2. In the patient session page RSC (`app/(dashboard)/patient/session/[sessionId]/page.tsx`), update the exercises query to also select `videos(storage_path)` (Supabase FK join) so the storage path is resolved server-side, avoiding a client-side signed URL fetch.
3. Pass `video_storage_path` from the RSC to `ExerciseExecutor` via the `Exercise` type.
4. In `ExerciseExecutor.tsx`, conditionally render an instructional video player above `PatientFormRecord` when `exercise.video_storage_path` is non-null. Use a simple client-side component that calls `getSignedPlaybackUrl` on mount and renders `<video controls>`.

**Files to modify:**
- `lib/types.ts` — add `video_storage_path?: string | null` to `Exercise`
- `app/(dashboard)/patient/session/[sessionId]/page.tsx` — include `videos(storage_path)` in query
- `components/patient/ExerciseExecutor.tsx` — render instructional video

### 3b: Edit page shows "attach a video" prompt after save

**Root cause:** The `edit/page.tsx` fallback query (lines 63-80) strips all video data when the main Supabase join query errors. The main query uses `videos(storage_path)` which is a Supabase FK join. If the FK relationship (`exercises.video_id → videos.id`) is not properly introspected by Supabase (e.g., schema cache stale, FK missing), the join fails silently and the fallback activates, losing all video-related data.

**Fix:**
1. Replace the fallback approach with a two-phase fetch: first get the session + exercises without the join, then separately fetch video storage paths for any exercise with a non-null `video_id`.
2. This eliminates the single point of failure in the join query.

**Files to modify:**
- `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx` — two-phase fetch instead of fallback query

**Verification:** Record an instructional video on an exercise, save the session, reload the edit page — the video should still display.

---

## Issue 4 — Patient form-check videos not visible to provider

**Root cause:** The `getPatientVideosForProvider` function uses `requireRole("provider")` which returns a client authenticated as the provider. The RLS policy on `videos` allows reads when `uploader_id = auth.uid()` (the provider's own uploads) OR when the video's `exercise_id` links through `exercises.session_template_id → sessions_template.id` where `provider_id = auth.uid()`. In practice this EXISTS subquery join may fail due to:
- The `exercise_id` column being `NULL` on patient-uploaded videos
- The Supabase FK join not being properly resolved
- RLS policy evaluation ordering

**Fix:**
1. In `saveVideoMetadata`, verify `exerciseId` is always passed and non-null (currently `PatientFormRecord` does pass it, but add a guard).
2. Change `getPatientVideosForProvider` to use the admin/client (service role) to bypass RLS, since authorization is already handled by `requireRole("provider")`.

**Files to modify:**
- `lib/actions/videos.ts` — switch to admin client in `getPatientVideosForProvider`, add `exerciseId` validation in `saveVideoMetadata`
- `lib/supabase/admin.ts` — verify the admin client import path and export

**Verification:** As a provider, view a patient's detail page after the patient has recorded a form-check video during a session — the video should appear in the "Form-check videos" section.
