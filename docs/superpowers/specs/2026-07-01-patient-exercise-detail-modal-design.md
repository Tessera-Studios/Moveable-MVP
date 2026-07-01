# Patient exercise-detail modal — Design

**Date:** 2026-07-01
**Issue:** ISSUES.md — "Feature: Patients clicking on their 'Exercise' should show the exercise information including the video in a modal."

## Goal

On the patient-facing **"Your Exercises"** page (`/patient/exercises`), let a patient tap an exercise row to open a modal showing that exercise's information (name, sets, reps, patient-facing notes) and its instructional video.

## Scope

- **In scope:** the `/patient/exercises` list page only.
- **Out of scope:** the dashboard "Today's Session" card (rows are drag-to-reorder — a tap target would clash with the drag gesture) and the profile exercise list. The session executor already shows the instructional video inline and is unchanged.

## Approach

Keep the page a **Server Component** (preserving server-side auth + data fetch) and extract only the interactive list into a small client component. This matches the app's server-first pattern and keeps client JS minimal.

Rejected alternatives: making the whole page a client component with a server-action fetch (more client JS, diverges from the established pattern); a dedicated detail route (the issue explicitly asks for a modal).

## Data

The page's exercises query currently omits the video. Add `video_id` to the `select` and resolve the storage path with the same fault-tolerant two-phase fetch used in `app/(dashboard)/patient/session/[sessionId]/page.tsx`:

1. Fetch exercise base columns including `video_id`.
2. Collect non-null `video_id`s; if any, query `videos` (`id, storage_path`) `.in("id", videoIds)` and build an `id → storage_path` map.
3. Map each exercise to include `video_storage_path` (`null` when absent).

If the videos lookup returns nothing, exercises render with no video — no hard failure. No schema or type changes: `Exercise` already declares `video_id` and `video_storage_path?`.

## Components

### NEW `components/patient/PatientExercisesList.tsx` (client)
- Props: `{ exercises: Exercise[] }`.
- Renders the existing row markup (index badge, name, `sets · reps`), but each row is a full-width, left-aligned `<button>` with a subtle chevron affordance, opening the modal for that exercise.
- Holds `selectedExercise: Exercise | null` and derives `open` from it; `onClose` clears it.
- Renders one `<ExerciseDetailModal>` driven by that state.

### NEW `components/patient/ExerciseDetailModal.tsx` (client)
- Props: `{ exercise: Exercise | null; open: boolean; onClose: () => void }`.
- Wraps the existing `Modal` (`size="lg"`, `title={exercise.name}`).
- Body:
  - If `exercise.video_storage_path` → `<VideoPlayer storagePath={…} />`; else a muted "No video for this exercise yet."
  - `sets · reps` line.
  - `patient_notes` (labeled, only when present).
- **Confidentiality:** renders `patient_notes` only — never `provider_notes` (not fetched by this query, per the 2026-06-18 confidentiality audit).

### EDIT `app/(dashboard)/patient/exercises/page.tsx`
- Add `video_id` to the select + the two-phase storage-path resolution.
- Keep the page header, card wrapper, and `EmptyState`; replace the inline `.map()` with `<PatientExercisesList exercises={…} />`.

## Error handling

`VideoPlayer` already owns its own loading/error states. The video lookup is best-effort. No new failure modes.

## Testing

Consistent with the codebase, there is no component-test harness (only pure-logic vitest), and this feature introduces no new pure logic worth extracting. Verified via `tsc --noEmit`, ESLint on changed files, and a production build.
