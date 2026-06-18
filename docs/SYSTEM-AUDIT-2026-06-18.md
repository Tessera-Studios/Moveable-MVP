# System Audit — Move Able MVP

**Date:** 2026-06-18
**Branch audited:** `feat+account-deletion` (originally `da5db8b`; later rebased onto `main`)
**Method:** Account-deletion feature built via subagent-driven-development + a parallel per-spec audit of the implemented system against every doc in `docs/` (01–07), each by a dedicated reviewer.

---

## Resolution Log (post-audit)

The branch was **rebased onto `main`**, dissolving the two staleness false-positives (Phase 6 chat and the "Move Able" rename are now present). The following findings were then fixed (commits `84d903a`, `e72b2bf`):

| Finding | Resolution |
|---|---|
| **C1** provider-notes leak | `provider_notes` removed from all 4 patient-side queries; "Notes from your therapist" block deleted. Patients now only see `exercises.patient_notes`. |
| **C2** PWA icons missing | `icon-192/512.png` + `icon.svg` generated from `move-able.svg` into `public/icons`; wired into `manifest.json` + root metadata (apple-touch-icon). |
| **I1** streak hardcoded to UTC | `TimezoneSync` cookie + `getRequestTimezone()` helper; dashboard & progress now use the patient's local day (UTC fallback on first load). |
| **I3** compliance rate >100% | Export route now counts distinct completed days / days in range (shared `complianceRate` helper). |
| **I4** completeSession row inflation | Now updates an existing same-template same-local-day completed row instead of inserting a duplicate. |
| **No tests** | Vitest set up; pure stats/timezone logic extracted to `lib/stats.ts` and covered by 15 tests (streak U2, compliance I3 regression, timezone validation). |

**Still deferred (documented, not fixed):**
- **I2** — patient profile name/phone/address + `VideoHistoryList` require new `users` columns and a product decision (schema change); not done to avoid speculative scope.
- Minors: `zod` validation, `Modal` focus trap, `export_logs` audit table (spec-optional), documented MVP de-scopes (SessionVideoAttacher, fail-fast upload), and the pre-existing invalid `package.json` `"type": "typescript"` field.
- Integration tests for RLS / provider-notes-hidden / realtime delivery need a live test DB and are not yet written.

---

## Executive Summary

The account-deletion feature was implemented, reviewed (Opus whole-branch review), and hardened — it is **ready to merge** on its own merits. The broader system audit found the codebase **mostly compliant** with its specs, with **two genuine Critical issues** that predate this work and live on `main`, plus a recurring "no automated tests anywhere" theme that contradicts the repo's stated TDD guidance.

**The single most important finding is not in any spec:** this feature branch is **29 commits behind `main`**. It was cut from `31a2050`, before Phase 6 (Realtime Chat), the "Move Able" rename, and the codeless-registration work were merged. Two audit findings below ("Phase 6 missing", "still says Moveable") are therefore **false positives from branch staleness**, not real gaps.

---

## 0. Branch Divergence (Action Required Before Merge)

| | |
|---|---|
| Merge base | `31a2050` |
| `main` HEAD | `aacc7d8` (29 commits ahead of base) |
| This branch | 5 account-deletion commits on top of the old base |

**`main` has, but this branch does not:**
- **Phase 6 — Realtime Chat** (full implementation: migration, `lib/actions/messages.ts`, `components/chat/*`, chat pages)
- **"Move Able" rename** (`d75d325`, `a0fc2c7`)
- **Codeless registration / post-signup provider linking** (`ConnectProviderWidget`, `claimInvitationCode`, optional invitation code)

**Recommendation:** rebase this branch onto `main` before merging. The account-deletion migration (`20260618000001`) drops the `check_patient_has_provider` constraint, which is consistent with the codeless-registration work already on `main` — confirm they compose cleanly after rebase.

---

## 1. Account-Deletion Feature (this branch's work) — ✅ Complete

Built in three reviewed tasks; all spec-compliant and committed:

| Task | Commits | Status |
|---|---|---|
| `deletePatientAccount` + migration | `a9d7ae9..cc01efa` | ✅ review clean |
| `deleteProviderAccount` | `f10967a` | ✅ review clean |
| `DeleteAccountButton` + page wiring | `0ca7805` | ✅ review clean |
| Final-review hardening (delete order) | `da5db8b` | ✅ applied |

**Whole-branch review verdict (Opus):** Security model sound — both server actions take **no parameters** and derive `userId` from the server session via `requireRole`, so there is **no cross-account deletion path**. The migration correctly drops `ON DELETE CASCADE` on the single `public.users → auth.users` FK; every domain table references `public.users`, so no child rows are orphaned.

**Resolved during review:**
- Storage-deletion error now checked (`cc01efa`).
- **Deletion ordering reversed** (`da5db8b`, user-decided): auth account is deleted **first** as the gate, then videos are purged best-effort. Worst case is now a few orphaned storage blobs (an accepted gap) instead of destroyed data on a still-live account.

**Deferred (non-blocking, in ledger):**
- Deleted-provider invitation codes remain valid → a new patient could register against a ghost provider. Out of scope; follow-up.
- `deleteProviderAccount` treats `count === null` as zero patients (RESTRICT FK still prevents real orphaning).
- Migration `ADD CONSTRAINT` is not `IF EXISTS`-guarded (runs once; acceptable).

---

## 2. System Audit Findings by Phase

Severity is the reviewer's; the **R/FP** column marks **R**eal vs **FP** = false-positive-from-branch-staleness.

### Genuine Critical issues (exist on `main` too)

| # | R/FP | Phase | Finding |
|---|---|---|---|
| C1 | **R** | 03 | **Provider notes leak to patients.** `app/(dashboard)/patient/profile/page.tsx:24,96–108` selects and renders `sessions_template.provider_notes` under "Notes from your therapist". Spec 03 requires provider notes be hidden from patients (no column-level RLS; must be enforced in app queries). Confirmed present on `main`. **Needs a product decision:** is this an intentional patient-facing note, or the confidentiality leak spec 03 warns about? If the latter, stop selecting `provider_notes` on all patient-side queries. |
| C2 | **R** | 01 | **PWA cannot install.** `public/manifest.json` references `/icons/icon-192.png`, `/icons/icon-512.png` (and spec requires an SVG icon), but `public/icons/` does not exist — on this branch **or `main`**. Fails the "PWA install prompt works" acceptance criterion. |

### Important issues (real)

| # | Phase | Finding |
|---|---|---|
| I1 | 04 | **Streak timezone is hardcoded to UTC on read paths.** `patient/page.tsx:20` and `patient/progress/page.tsx:15` call `getPatientStats("UTC")`; only `FeedbackForm` sends the real client TZ on write. A patient near a day boundary sees one streak on submit and a different one on reload. Spec mandates the patient's local day. Needs a client-TZ passthrough (cookie/header) for Server Components. |
| I2 | 04 | **Patient profile missing spec'd fields.** Spec requires name/phone/**address**; the `users` table has no such columns. Address is never shown; name/phone fall back to `auth.users`. `VideoHistoryList` (recorded/assigned videos on the profile) is also absent. |
| I3 | 07 | **Compliance rate can exceed 100%.** `app/api/export/patient-stats/route.ts:80–90` computes `totalCompleted / daysInRange`; 2+ sessions in one day inflate it. Spec defines it as *days with* a completed session. Use a distinct-date Set (the streak helper already does). Note: the spec's own pseudocode shares this flaw. |
| I4 | 04 | `completeSession` uses `.insert()` not `.upsert()` (spec says upsert). Streak dedupes by date, but `totalCompleted` counts raw rows, so re-submitting feedback inflates the lifetime total. |
| I5 | 02 | The account-deletion migration drops `check_patient_has_provider` and the CASCADE FK — deliberate cross-phase changes, but deviations from the Phase 2 schema as written. Consistent with `main`'s codeless-registration work; confirm on rebase. |

### Important issues (FALSE POSITIVE — branch staleness)

| # | Phase | Finding | Reality |
|---|---|---|---|
| ~~FP1~~ | 06 | "Realtime Chat not implemented — all files missing." | **Fully implemented on `main`** (`lib/actions/messages.ts`, `components/chat/*`, chat pages, migration `20260618000000`). Absent only because this branch predates the merge. |
| ~~FP2~~ | 01 | "App still says 'Moveable' in constants, manifest, layout, auth pages." | **Renamed to "Move Able" on `main`** (`d75d325`, `a0fc2c7`). Branch staleness only. |

### Minor / polish (real, selected)

- **01:** No `Select` UI primitive; no desktop sidebar (mobile-only shell, `max-w-[512px]`); `Modal` has no focus trap; no service-worker scaffold; `BottomTabBar` "Exercises" tab links to `/patient/profile` and the "Messages" links predate the chat routes (fixed by Phase 6 on `main`).
- **02:** Provider row insert uses the admin client (bypasses the `users_own` WITH CHECK); post-`signUp` redirect assumes email confirmation is disabled; `Profile` type omits the `email` column.
- **03:** No `zod` validation (manual checks instead); route is `/provider` not spec's `/provider/dashboard`.
- **05:** `getPatientFormVideos` is named `getPatientVideosForProvider` in code (PROGRESS.md uses the spec name — docs drift); it relies on RLS rather than an explicit ownership check (defense-in-depth gap vs the Phase 7 pattern); `VideoPlayer` doesn't refresh expiring signed URLs; `SessionVideoAttacher` absent (**documented MVP de-scope**, not a defect); fail-fast upload (also a **documented scope decision**).
- **07:** No `export_logs` audit table (**spec marks optional**); PDF shows a session log instead of a score-trend comparison; no provider name/DOB in PDF.

---

## 3. Cross-Cutting Theme

**No automated tests exist anywhere in the codebase.** Every phase spec defines unit/integration/E2E test cases (streak calc, RLS isolation, provider-notes-hidden, real-time delivery, PDF content, etc.), and `AGENTS.md` mandates test-driven design. No test runner is configured and no `*.test.*`/`*.spec.*` files exist. The only verification gate in practice is `tsc --noEmit`. The C1 provider-notes leak is exactly the kind of regression the spec's "provider notes hidden from patients" integration test would have caught.

---

## 4. Merge Readiness

| Item | Status |
|---|---|
| Account-deletion feature | ✅ Ready (reviewed + hardened) |
| Rebase onto `main` | ⚠️ **Required** — branch is 29 commits behind |
| C1 provider-notes leak | 🔴 Product decision needed (pre-existing on `main`) |
| C2 PWA icons | 🟠 Pre-existing on `main`; fix independently |
| Test suite | 🟠 Absent project-wide; pre-existing |

**Bottom line:** the account-deletion work is sound and mergeable. The two Critical issues and the missing test suite are **pre-existing conditions on `main`**, surfaced by this audit but not caused by this branch. Address C1 (confidentiality) with priority and rebase before merge.

---

*Generated from a 7-agent parallel spec audit + Opus whole-branch review. Per-phase detail retained in the session ledger at `.git/worktrees/feat+account-deletion/sdd/`.*
