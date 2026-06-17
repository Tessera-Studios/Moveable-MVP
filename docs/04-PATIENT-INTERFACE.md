# Phase 4: Patient Interface & Gamification

## Goals
- Build the Patient Dashboard showing the active session and streak status
- Implement session execution flow (step through exercises, track completion)
- Implement drag-and-drop exercise reordering (client-side only)
- Build the post-session feedback form (ease + pain scores 1-5)
- Implement gamification engine (daily streak calculation, total completed count)
- Build the Progress Screen (charts for compliance, streak history, pain trends)
- Build the Patient Profile screen (personal info, notes, videos, exercises)

## Pages

### `/patient/dashboard`
The primary patient interface, heavily focused on the active daily session.

**Components:**
- `StreakBanner` — prominent display: current streak count (fire icon), total completed sessions, message like "You're on a 5-day streak!"
- `ActiveSessionCard` — the single active session for today
  - Session name, due status
  - Exercise list (ordered, with drag handles)
  - "Start Session" button
- `ProgressPreview` — mini chart showing last 7 days completion
- `MessageBadge` — unread message count (Phase 6)

### `/patient/session/[sessionId]`
The active session execution screen.

**Components:**
- `SessionHeader` — session name, progress bar (exercises completed / total)
- `ExerciseExecutionCard` — one exercise at a time (swipe or tap to advance)
  - Exercise name, sets x reps display
  - Instructional video player (if video attached)
  - Patient notes (instructional text from provider)
  - "Mark Complete" button per set (e.g., "Set 1/3 ✓", "Set 2/3")
  - Optional: "Record My Form" button (Phase 5 — skip if not implemented yet)
- `ExerciseNav` — dots/carousel showing all exercises, tapping navigates
- `ReorderHandle` — drag handle to reorder exercises before starting
- `FinishSessionButton` — appears when all exercises marked complete

### `/patient/session/[sessionId]/feedback`
Mandatory post-session feedback.

**Components:**
- `EaseRating` — 5 labeled emoji/buttons: "Very Hard" (1) to "Very Easy" (5)
- `PainRating` — 5 labeled emoji/buttons: "No Pain" (1) to "Severe Pain" (5)
- `SubmitButton` — Server Action saves scores + marks session complete
- `SkipWarning` — if user tries to close without submitting

### `/patient/profile`
Personal information and history view.

**Components:**
- `ProfileHeader` — name, email, phone number, address
- `PatientNotesSection` — patient-facing notes from the provider (read-only)
- `VideoHistoryList` — list of videos the patient has recorded or been assigned, linked to exercises
- `ExerciseHistoryList` — list of exercises from past and current sessions
- `ProviderInfoCard` — name of the linked provider, contact info if available

**Data Flow:**
- Server Component fetches `users` row for the patient's name, email, phone, address
- Fetches `sessions_template.provider_notes` where patient_id matches (patient-visible notes)
- Fetches `videos` where uploader_id matches or exercise_id is linked to patient's sessions
- Fetches `exercises` linked to patient's session templates

### `/patient/progress`
Statistics and compliance visualization.

**Components:**
- `StreakHistoryChart` — bar chart of daily completions over past 30 days
- `TotalSessionsBadge` — lifetime completed count
- `PainTrendChart` — line chart of pain scores over time
- `EaseTrendChart` — line chart of ease scores over time
- `ComplianceRate` — percentage of days completed in the last 30 days
- `EmptyState` — if no sessions completed yet

## State Management

### Exercise Reordering (Client-Side Only)
- Before session starts, the exercise list is a client component with `@dnd-kit/core`
- Reordering mutates only local React state (`useState` array, `arrayMove`)
- On "Start Session", the final order is captured as the execution order for this session
- No database writes for reorder — purely transient UI state
- **Test assertion**: no network calls triggered during reorder (U3)

### Session Execution State
- `exercisesRemaining: Set<string>` — tracks which exercises are not yet completed
- Transitioning to next exercise is purely client-side
- On "Finish Session", navigate to feedback; on feedback submit, Server Action writes the record

## Server Actions

```typescript
// src/lib/actions/executions.ts
export async function completeSession(
  sessionTemplateId: string,
  easeScore: number,
  painScore: number
): Promise<{ streak: number; totalCompleted: number }> {
  // 1. Authenticate as the patient
  // 2. Validate scores are 1-5
  // 3. Upsert session_execution (status='completed', scores, completed_at=now())
  // 4. Calculate new streak (see Gamification Engine)
  // 5. Return { streak, totalCompleted } for UI update
}

export async function getPatientStats(): Promise<PatientStats> {
  // Aggregate: total completed, current streak, 30-day window completions
}
```

## Gamification Engine

### Streak Calculation (Server-Side)
Runs inside the `completeSession` Server Action and on dashboard load.

```typescript
function calculateStreak(patientId: string): number {
  // 1. Fetch all session_executions for this patient, ordered by completed_at DESC
  // 2. Group by date (patient's local timezone — timezone offset sent from client)
  // 3. Walk backwards from today:
  //    - If today has a completion, count starts from today
  //    - Otherwise start from yesterday
  //    - Count consecutive days with at least one completion
  //    - Break on first day with no completion
  // 4. Return count
}
```

### Timezone Handling
- Client sends `Intl.DateTimeFormat().resolvedOptions().timeZone` with session completion payload
- Server stores timezone offset alongside the completion
- Streak calculation uses `AT TIME ZONE` or equivalent to align to patient's local day
- Defaults to UTC if no timezone provided

### Daily Reset
- No explicit "reset" action — the 24-hour cycle is implicit in streak calculation
- Patient can complete multiple sessions in a day (counts as one completed day for streak)
- A day with zero completions breaks the streak

## Data Flow: Complete Session

```
Patient taps "Finish" on last exercise
  → Navigate to /feedback
  → Patient rates ease (1-5) and pain (1-5)
  → Taps "Submit"
  → Server Action:
      a) Write session_execution (status=completed, scores)
      b) Calculate streak
      c) Return { streak, totalCompleted }
  → UI updates:
      - StreakBanner shows new streak count
      - TotalCompleted increments
      - Navigate to /progress or show success modal
```

## Charting Library

Use a lightweight, tree-shakeable charting library such as **recharts** or **visx**.

- `StreakHistoryChart` — `<BarChart>` with 30 bars, green for completed, gray for missed
- `PainTrendChart` — `<LineChart>` with pain scores over last N sessions
- `EaseTrendChart` — `<LineChart>` with ease scores over last N sessions

Charts are Client Components wrapped in `<Suspense>` with skeleton fallback.

## User Interface States

- **Loading** — skeleton placeholders for dashboard, session, and progress pages
- **Empty** — "No sessions assigned yet" for new patients; "Complete your first session!" CTA
- **Error** — toast on failed submission; retry button on data fetch failure
- **Offline** — banner when navigator.onLine is false; cached data display
- **Session in progress** — app warns before navigating away (beforeunload)

## Test Cases

### Unit: U2 — Streak calculation
Inject mock patient state with streak N. Call `calculateStreak` with a session completed within 24h. Assert result is N+1. With incomplete session or out-of-window, assert result is 0.

### E2E: E1 — Full patient session flow
Login as patient, view dashboard, execute all exercises, submit feedback, verify streak and total increment on progress screen.

### Unit: Drag-and-drop is client-side
Mount ExerciseList, simulate DnD reorder, assert network spy was not called.

### Integration: Patient profile displays correct data
Seed a patient with name, email, phone, address, and linked provider notes. Fetch profile data as the patient. Assert all fields match. Assert provider-only notes from other patients are not visible.

## Acceptance Criteria
- [ ] Patient dashboard loads with active session and streak display
- [ ] Patient can reorder exercises (client-side only) before starting
- [ ] Patient can step through exercises, marking each complete
- [ ] Post-session feedback form enforces 1-5 range for both scores
- [ ] Session completion triggers Server Action and saves to DB
- [ ] Streak correctly increments for consecutive daily completions
- [ ] Streak resets to 0 when a day is missed
- [ ] Progress screen shows accurate charts and stats
- [ ] Timezone handling: patient's local day determines streak boundaries
- [ ] Patient profile displays name, email, phone, address, notes, videos, and exercises
- [ ] Patient profile only shows patient-visible data (provider-only notes excluded)
