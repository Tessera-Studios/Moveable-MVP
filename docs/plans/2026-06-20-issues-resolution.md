# ISSUES.md Resolution Plan

**Date:** 2026-06-20
**Issues:** `ISSUES.md`

## Priority ordering

| Pri | # | Issue | Type |
|-----|---|-------|------|
| P0  | 1 | Last-7-days completed day not highlighted | Bug |
| P0  | 2 | Patient form-check videos not visible to provider | Bug |
| P0  | 3 | Cross-role URL access (patient sees provider dashboard) | Bug |
| P0  | 4 | PDF export broken (error toast) | Bug |
| P1  | 5 | Video max 15MB / 20s duration limits | Feature |
| P1  | 6 | Provider records form-check video for patients | Feature |
| P2  | 7 | Provider categorize patients by focus area | Feature |
| P2  | 8 | Bulk export patients by focus area | Feature |
| P3  | 9 | Templates structure-only, sessions clone from templates | Architectural |

---

## P0-1 — Last-7-days completed day not highlighted

**Root cause hypothesis:** `getPatientStats()` in `lib/actions/executions.ts:106-108` generates date strings for "today" through "29 days ago" using `Date.now() - i * 86_400_000` converted to the patient's timezone. The `completed_at` timestamps are `toLocalDate()`'d with the same timezone. The `TimezoneSync` component refreshes the page once on mount, but the *first* server render uses the fallback `"UTC"` timezone from the cookie. If the patient's local day differs from UTC (e.g., 11pm local = 3am UTC next day), the dates won't align.

**Fix:**
1. Add diagnostics in `getPatientStats()`: compute both `"UTC"` and the patient's timezone date for today, log the mismatch.
2. If confirmed: ensure the `completeSession` dedup and `getPatientStats` date generation use identical UTC-midnight logic. The fix may also involve reading the timezone cookie properly in the `completeSession` server action (currently defaults to `"UTC"` in the function signature but the caller already passes it).

**Files to modify:**
- `lib/actions/executions.ts` — add diagnostics, fix date generation if needed

**Edge cases:**
- Patient near the International Date Line (±12h from UTC) — midnight crossover
- Patient changes timezone mid-treatment (DST transition, travel)

**Verification:** Complete a session, navigate to dashboard — the bar for today should be green immediately. The second load (after TimezoneSync refreshes) should also show green.

---

## P0-2 — Patient form-check videos not visible to provider

**Root cause confirmed:** `getPatientVideosForProvider()` in `lib/actions/videos.ts:149` uses an admin client with `.select("id, storage_path, created_at, exercises(name)")`. The embedded PostgREST join `exercises(name)` silently excludes rows where `exercise_id` is `NULL` (exercises deleted with `ON DELETE SET NULL` from the Phase 5 migration).

**Fix:**
Replace the embedded join with a two-phase fetch:
1. Query `videos` with base columns only (`id, storage_path, created_at, exercise_id`).
2. Extract distinct non-null `exercise_id` values and fetch their names in a second query (`exercises(id, name)`).
3. Map exercise names onto video rows by `exercise_id`.

This mirrors the pattern already established in `app/(dashboard)/patient/session/[sessionId]/page.tsx:50-63`.

**Files to modify:**
- `lib/actions/videos.ts` — `getPatientVideosForProvider`: remove embedded join, add two-phase fetch
- Update `PatientVideoRow` interface if needed (add `exercise_id`)

**Verification:**
1. Patient records a form-check video during a session.
2. Provider opens the patient detail page — video appears in "Form-check videos" section.
3. Delete the exercise that the video was linked to — video still appears (with null exercise name).
4. Video plays correctly via `VideoPlayer`.

---

## P0-3 — Cross-role URL access (patient sees provider dashboard)

**Root cause confirmed:** `app/(dashboard)/layout.tsx` fetches `profile.role` but never validates the URL path segment matches it. Any authenticated user can navigate to any dashboard URL by typing it.

**Fix:**
After fetching the profile (line 33), read `pathname` and compare the first segment against `profile.role`. If they don't match, redirect:

```ts
import { headers } from "next/headers";

// In the layout component:
const headersList = await headers();
const pathname = headersList.get("x-url") ?? "/patient";
// Or use the request URL from the headers
```

Actually, Server Components don't have direct access to `pathname`. Use `headers().get("next-url")` or read from the `x-invoke-path` header. Alternative: use the `cookies()` or parse the referrer. Simplest safe approach:

```ts
const segments = (headersList.get("next-url") ?? "").split("/").filter(Boolean);
const dashboardRole = segments[0] ?? "";
if (dashboardRole === "provider" && profile?.role !== "provider") redirect("/patient");
if (dashboardRole === "patient" && profile?.role !== "patient") redirect("/provider");
```

**Files to modify:**
- `app/(dashboard)/layout.tsx` — import `headers`, add role-path validation before the return

**Edge cases:**
- `profile` is `null` (user record missing) — redirect to `/login` instead of guessing
- Path is `/` (unlikely since proxy redirects, but safe-guard)
- Unknown path segment (e.g., `/admin`) — default to `/patient`

**Verification:** Log in as patient, type `/provider` in URL → redirected to `/patient`. Log in as provider, type `/patient` → redirected to `/provider`.

---

## P0-4 — PDF export broken (error toast)

**Root cause:** Unknown — route code and pdfkit dependency are present but the fetch returns a non-2xx status, triggering the error toast.

**Diagnostic step:**
Update `ExportButton.tsx` to display the HTTP status code in the toast error message:

```ts
if (!response.ok) throw new Error(`Export failed (${response.status})`);
```

Then trigger the export and check the status code.

**Likely fixes (by status):**
- **401:** Auth cookie not reaching the Route Handler. Fix: ensure `createClient()` in `app/api/export/patient-stats/route.ts` correctly reads cookies from the `NextRequest`.
- **403:** Provider does not own this patient. Fix: check `provider_id` in `users` table matches. The query already does this — verify the session user's ID is correct.
- **500:** pdfkit runtime error. Fix: add `export const runtime = "nodejs"` to the route file to ensure Node.js APIs are available.

**Files to modify:**
- `app/(dashboard)/provider/patients/[patientId]/ExportButton.tsx` — show status code in error message
- `app/api/export/patient-stats/route.ts` — add runtime export if needed, fix auth/query

**Verification:** Export downloads a valid PDF with patient stats.

---

## P1-5 — Video max 15MB / 20s duration limits

**Root cause:**
- `RecordVideo.tsx:34` defaults `maxDuration` to 120s
- Supabase Storage bucket configured at 100MB (must be changed in Dashboard)
- No client-side file-size validation before upload
- Upload callers (`ExerciseVideoAttacher.tsx`, `VideoCaptureField.tsx`) don't pass or use the `maxDuration` prop

**Fix:**

1. **Duration:**
   - Change `RecordVideo.tsx` default from `120` to `20`
   - Update all callers to pass `maxDuration={20}` explicitly (consistency): `PatientFormRecord.tsx`, `ExerciseVideoAttacher.tsx`, `VideoCaptureField.tsx`

2. **File size:**
   - In `RecordVideo.tsx`, after recording stops, check `blob.size > 15 * 1024 * 1024`. If exceeded, show inline error and prevent "Use This Video" flow.
   - In the Supabase Dashboard: change the `exercise-videos` bucket file size limit from 100MB to 15MB.

3. **Optional (server-side):**
   - Add `contentLength` parameter to `getUploadUrl()` signed URL creation to enforce on the Storage side.

**Files to modify:**
- `components/shared/RecordVideo.tsx` — change default, add size validation
- `components/patient/PatientFormRecord.tsx` — pass `maxDuration={20}`
- `components/provider/ExerciseVideoAttacher.tsx` — pass `maxDuration={20}`
- `components/provider/VideoCaptureField.tsx` — pass `maxDuration={20}`
- `lib/actions/videos.ts` — optional signed URL content-length enforcement

**Verification:**
- Recording stops at 20 seconds.
- Attempting to upload a 16MB video shows an inline error "Video exceeds 15MB limit."
- Supabase Storage rejects oversized files (if server-side enforcement added).
- Existing videos under 15MB continue to upload successfully.

---

## P1-6 — Provider records form-check video for patients

**Current state:** Only patients can record form-check videos. Providers can record *instructional* videos per exercise, but those are linked to the exercise, not a specific patient.

**Design decision:** Use a `video_type` column or rely on `uploader_id` + fetch convention?

**Recommendation:** Keep it simple — no schema change. A provider-recorded video for a patient's form check can use the existing `videos` table with the provider as `uploader_id` and the patient's exercise's `exercise_id`. The distinction is maintained by *where* the video is recorded (provider patient detail page) and *how* it's fetched (separate query).

**Fix:**

1. New server action: `saveProviderFormCheckVideo(patientId: string, exerciseId: string, storagePath: string)` — inserts a video row tagged with the provider's `uploader_id` and linked to the exercise. Provider authorization checked via `requireRole("provider")`.

2. New query: `getProviderFormCheckVideos(patientId: string)` — returns videos uploaded by the patient's provider for exercises in the patient's session.

3. New component: `ProviderFormRecord.tsx` — similar to `PatientFormRecord.tsx`, rendered on the provider's patient detail page, per exercise in the assigned session. Opens `RecordVideo`, uploads, saves metadata.

4. Patient display: Add a section in the patient's session page to show provider-recorded form-check videos alongside instructional videos.

**Files to create/modify:**
- `lib/actions/videos.ts` — new server action + query
- `components/provider/ProviderFormRecord.tsx` — new component
- `app/(dashboard)/provider/patients/[patientId]/page.tsx` — render `ProviderFormRecord` per exercise
- `app/(dashboard)/patient/session/[sessionId]/page.tsx` — show provider form-check videos

**Verification:** Provider records a form-check video for a patient's exercise. Patient sees it during their session execution.

---

## P2-7 — Provider categorize patients by focus area

**Schema change:**
- Migration: `ALTER TABLE public.users ADD COLUMN focus_area TEXT;`
- Type: add `focus_area?: string` to `Profile` in `lib/types.ts`

**Server action:**
- `updatePatientFocusArea(patientId: string, focusArea: string)` — validates provider owns patient, updates `focus_area`

**UI:**

1. **Patient detail page**: Show current focus area. Edit button opens an inline combobox.
2. **Combobox**: Text input + dropdown. Default options: "Shoulder", "Back", "Legs", "Core", "Arms", "Other". User can type a custom value not in the list.
3. **Patient list page**: Add a filter dropdown at the top. Selecting a focus area filters the patient roster to only patients with that value. "All" option clears the filter.

**Files to create/modify:**
- `supabase/migrations/20260620000000_focus_area.sql`
- `lib/types.ts` — `focus_area` on `Profile`
- `lib/actions/patients.ts` — `updatePatientFocusArea`
- `app/(dashboard)/provider/patients/page.tsx` — add filter UI + query parameter
- `app/(dashboard)/provider/patients/[patientId]/page.tsx` — show/edit focus area

**Verification:**
- Provider assigns focus area to a patient.
- Filtering by focus area shows only matching patients.
- Custom (non-default) focus areas can be entered.
- Focus area persists across page reloads.

---

## P2-8 — Bulk export patients by focus area

**API:**
- New route: `POST /api/export/bulk` accepting `{ patientIds: string[], focusArea?: string }`
- Returns a ZIP archive of individual patient PDFs
- Uses `archiver` npm package for ZIP generation (or manual Buffer concatenation)
- Each PDF is generated using the same pattern as the single-patient export route

**UI:**
- Patient list page: add checkboxes next to each patient
- "Export Selected (N)" button appears when ≥1 patient is checked
- Optional: "Export All" button with optional focus area filter
- On click: POST to bulk endpoint, download the ZIP

**Files to create/modify:**
- `app/api/export/bulk/route.ts` — new route handler
- `package.json` — add `archiver` dependency
- `app/(dashboard)/provider/patients/page.tsx` — add selection state + export button

**Verification:**
- Select 3 patients → export → downloads ZIP containing 3 PDFs.
- Each PDF is a valid patient stats report.
- Unauthorized access returns 401/403.

---

## P3-9 — Templates structure-only, sessions clone from templates

**Scope:** This is an architectural change. The current `sessions_template` table doubles as both a reusable template and an assigned session. Videos and provider notes live on the session/exercise directly.

**Minimal approach (defer detailed design):**

The user rated this "important but not blocking." For MVP launch, the current architecture works. The concrete issues mentioned ("Templates should not include any videos, nor provider notes, just the structure") can be addressed incrementally:

1. **Short-term fix:** Add a UI hint in the session creation form that videos and provider notes are per-patient, not part of the reusable structure. The current code already handles this correctly at the data level — the issue is UX clarity.

2. **Medium-term (post-launch):**
   - New `templates` table: `id, provider_id, name, created_at`
   - New `template_exercises` table: `id, template_id, name, sets, reps, patient_notes, sort_order` (no video_id)
   - Modify `sessions_template` to become `assigned_sessions`: `id, template_id (nullable), patient_id, provider_notes, created_at`
   - Modify `exercises` to become `assigned_exercises`: `id, assigned_session_id, name, sets, reps, patient_notes, sort_order, video_id`
   - Clone action: `template → assigned_session`, copying exercises, stripping videos and provider notes
   - Data migration: seed templates from existing sessions_template rows
   - UI: separate "Templates" (structure-only) from "Assigned Sessions" (patient-specific)

**Deferred to post-launch** unless the current behavior is causing data loss or patient data exposure (it is not — provider_notes are already excluded from patient queries, and videos are properly scoped).

---

## Diagnostic step for P0-4

Before implementing any other fixes, update the ExportButton to expose the HTTP status code:

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="edit">
<｜｜DSML｜｜parameter name="filePath" string="true">/home/ish/Work/Tessera/Applications/moveable-mvp/app/(dashboard)/provider/patients/[patientId]/ExportButton.tsx