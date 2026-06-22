# Remaining Issues Fixes

**Date:** 2026-06-22
**Issues:** `ISSUES.md`, user-reported hydration error, PDF export crash, last-7-days highlight, RLS focus area update

---

## Issue 1 — Hydration mismatch on patient dashboard (`aria-describedby`)

**Root cause:** `components/patient/ActiveSessionCard.tsx:73` — `@dnd-kit` uses a module-level counter to generate `aria-describedby` accessibility IDs (e.g. `DndDescribedBy-2`). During SSR, other singletons may increment the counter first, so the server renders a different ID than the client (`DndDescribedBy-2` vs `DndDescribedBy-0`). React detects the mismatch during hydration and logs the error.

The redirect from `/provider` → `/patient` works correctly (proxy.ts), but the SSR'd HTML for `/patient` includes the DnD sortable content, which triggers the mismatch on hydration.

**Fix:** Add `suppressHydrationWarning` to the `<button>` in `SortableExerciseItem` that receives the `{...attributes}` spread from `useSortable`. This tells React not to diff HTML attributes on this element during hydration. The `aria-describedby` is an accessibility annotation — suppressing its hydration warning is safe.

**File to modify:**
- `components/patient/ActiveSessionCard.tsx` — add `suppressHydrationWarning` on line 73 to the `<button>` element

**Verification:** Navigate to `/provider` as a patient → observe middleware redirects to `/patient` → no hydration error in console.

---

## Issue 2 — PDF export crashes with `ENOENT: /ROOT/node_modules/pdfkit/js/data/Helvetica.afm`

**Root cause:** `app/api/export/lib.ts:93` — PDFKit resolves its font files internally via `__dirname + '/data/Helvetica.afm'`. When Next.js Turbopack bundles the API route handler, `__dirname` is rewritten to the virtual path `/ROOT` (Turbopack's internal root). The real files exist at `<project>/node_modules/pdfkit/js/data/`, so the path `/ROOT/node_modules/pdfkit/js/data/Helvetica.afm` doesn't resolve. The `export const runtime = "nodejs"` fix was applied but is insufficient — the bundler still rewrites `__dirname`.

**Fix:** Mark `pdfkit` as an external dependency in `next.config.ts` using `serverExternalPackages`. This prevents Turbopack from bundling PDFKit, preserving its native `__dirname` resolution.

**File to modify:**
- `next.config.ts` — add `serverExternalPackages: ["pdfkit"]` to the config object

**Verification:** Click "Export Statistics to PDF" on a provider's patient detail page → PDF downloads successfully. Also test bulk export on the patients page.

---

## Issue 3 — Last 7 days bar chart doesn't highlight today's completion

**Root cause:** `lib/actions/executions.ts:84` — `completeSession` calls `revalidatePath("/patient", "layout")` after writing to the DB. The `FeedbackForm` then calls `router.push("/patient/progress")`. When the user later navigates to `/patient` (dashboard) via the BottomTabBar, the **client-side router cache** may serve the old page data. Server Action revalidation is most reliable for the current page; the client router may not re-fetch for pages navigated to via `router.push` or `<Link>`.

**Fix (two changes):**

1. **`lib/actions/executions.ts:84`** — Change `revalidatePath("/patient", "layout")` to two targeted revalidations:
   - `revalidatePath("/patient")` (revalidates the dashboard page)
   - `revalidatePath("/patient/progress")` (revalidates the progress page)

2. **`components/patient/FeedbackForm.tsx:109`** — After `router.push("/patient/progress")`, the progress page should fetch fresh data. Add `router.refresh()` call or use `window.location.href` fallback. The simplest reliable approach: call `router.refresh()` before `router.push()` to bust the client cache for the current route tree.

   Actually, the better fix: change `router.push("/patient/progress")` to `window.location.href = "/patient/progress"` after the toast shows. This forces a full server navigation, guaranteeing fresh data. The tradeoff is a full page reload (acceptable for a post-session flow).

   Alternative (less disruptive): Keep `router.push` but add a `useEffect` in `DashboardContent` (or a client wrapper) that calls `router.refresh()` on mount when it detects the page is stale.

**Files to modify:**
- `lib/actions/executions.ts` — line 84: replace `revalidatePath("/patient", "layout")` with `revalidatePath("/patient")`; `revalidatePath("/patient/progress")`
- `components/patient/FeedbackForm.tsx` — line 109: after `toast(...)`, add `router.refresh()` then `router.push("/patient/progress")`

**Verification:** Complete a session via the feedback form → observe toast → navigate to dashboard → today's bar in "Last 7 Days" is green (`bg-success`).

---

## Issue 4 — RLS blocks provider from updating patient focus area

**Root cause:** `supabase/migrations/20260617000000_phase2_schema.sql:123-132` — The `users` table has two RLS policies:
- `users_own`: `FOR ALL` with `USING (auth.uid() = id)` — only the user themselves can modify their row
- `users_provider_reads_patients`: `FOR SELECT` with `USING (provider_id = auth.uid())` — providers can only **read** their patients

There is no `UPDATE` policy for providers on their patients. When `lib/actions/patients.ts:42-45` runs `auth.supabase.from("users").update({ focus_area }).eq("id", patientId)`, RLS blocks the write. The `requireRole("provider")` check passes, but the Supabase client is RLS-respecting, so the DB write fails.

**Fix:** Use `createAdminClient()` (service role) in `updatePatientFocusArea` to bypass RLS, since application-level authorization is already enforced by `requireRole`. This mirrors the pattern used in `lib/actions/videos.ts:171-183` (`saveProviderFormCheckVideo`) and `lib/actions/videos.ts:271-279` (`getPatientVideosForProvider`).

**File to modify:**
- `lib/actions/patients.ts` — import `createAdminClient` from `@/lib/supabase/admin`; replace `auth.supabase` with `admin` for the UPDATE, keeping the ownership-check query (`auth.supabase` for SELECT is fine or use admin for both)

**Verification:** Provider opens a patient detail page → edits the focus area → saves → page refreshes with the new focus area visible. Open Supabase Dashboard → `public.users` → confirmed the focus_area column was updated.

---

## Files changed summary

| File | Lines | Change |
|---|---|---|
| `components/patient/ActiveSessionCard.tsx` | 73 | `suppressHydrationWarning` on `<button>` |
| `next.config.ts` | 4 | `serverExternalPackages: ["pdfkit"]` |
| `lib/actions/executions.ts` | 84 | Two targeted `revalidatePath` calls |
| `components/patient/FeedbackForm.tsx` | 109 | `router.refresh()` before `router.push()` |
| `lib/actions/patients.ts` | 1 (import) + 42-45 | Use `createAdminClient()` for UPDATE |
| `ISSUES.md` | — | Mark completed and add new items |

## Verification steps

1. As a patient, type `/provider` in URL → redirected to `/patient` → no hydration error in console
2. Provider clicks "Export Statistics to PDF" on patient detail → PDF downloads
3. Provider clicks "Export Selected" on patients list → ZIP with PDFs downloads
4. Patient completes a session → navigates to dashboard → today's Last-7-days bar is green
5. Provider edits patient's focus area → saves → value persists after page reload
