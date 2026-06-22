# MVP Issue Fixes

**Date:** 2026-06-21
**Issues:** `ISSUES.md`

---

## Issue 1 — Make "Instruction video" title larger in exercise modal

**Root cause:** `AddExerciseModal.tsx:63` — the "Instructional video" heading uses `text-sm` (14px), making it hard to read against the rest of the modal's typography hierarchy.

**Fix:** Change `text-sm` to `text-base` on the `<h3>` element at line 63.

**File to modify:**
- `components/provider/AddExerciseModal.tsx` — `text-sm` → `text-base` on line 63

**Verification:** Visual — heading is noticeably larger than secondary labels, matching the "Exercises" section heading in `SessionForm.tsx`.

---

## Issue 2 — Mobile keyboard closes after each character typed, focus goes to "X" button

**Root cause:** `Modal.tsx:32-45` — the focus-trap `useEffect` depends on `[open, onClose]`. The `onClose` prop from `AddExerciseModal` is a plain function (not `useCallback`d), so every re-render creates a new function reference → the effect re-runs → `focusable?.[0]?.focus()` focuses the "X" close button (first focusable element in DOM order) → keyboard dismisses on mobile.

**Fix:** Remove `onClose` from the effect's dependency array. Focus only needs to be set when `open` transitions to `true`, not when the callback reference changes. This is the minimal, correct fix — the keyboard event listener still gets properly registered and torn down.

**File to modify:**
- `components/ui/Modal.tsx` — change `useEffect` deps from `[open, onClose]` to `[open]`

**Verification:** Open the add-exercise modal on a mobile device, type in the exercise name input — keyboard stays open after each keystroke.

**Edge cases:**
- Escape-key handler still works because it's bound inside the `useEffect` body which re-runs on `open` change.
- Any other modal using a non-memoized `onClose` with text inputs (e.g., edit exercise modal) benefits from the same fix.

---

## Issue 3 — FK violation on exercise delete: `videos_exercise_id_fkey`

**Root cause:** `supabase/migrations/20260617000000_phase2_schema.sql:75` — `videos.exercise_id` FK references `exercises(id)` with no `ON DELETE` clause (defaults to `NO ACTION`, which blocks deletes). `exercises.video_id` already has `ON DELETE SET NULL`, creating an asymmetry.

When a provider deletes an exercise that has a referencing video row, PostgreSQL raises:
```
update or delete on table 'exercises' violates foreign key constraint
"videos_exercise_id_fkey" on table 'videos'
```
This also blocks session template deletion (which cascades to exercises).

**Fix:** Create a new migration that alters the FK constraint to `ON DELETE SET NULL`, matching the convention already used on `exercises.video_id`:

```sql
ALTER TABLE public.videos
  DROP CONSTRAINT videos_exercise_id_fkey,
  ADD CONSTRAINT videos_exercise_id_fkey
    FOREIGN KEY (exercise_id)
    REFERENCES public.exercises(id)
    ON DELETE SET NULL;
```

**File to create:**
- `supabase/migrations/20260621000000_fix_videos_fk_cascade.sql`

**Verification:**
1. Create a session with an exercise that has an instructional video.
2. Edit the session and delete that exercise.
3. Confirm no FK error — exercise is deleted, video row's `exercise_id` is set to `NULL`.
4. Confirm the orphaned video row still exists (not cascade-deleted).
5. Delete a session template that contains exercises with videos — confirm no FK error.
