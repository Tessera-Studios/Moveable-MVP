# Phase 3: Provider Interface

## Goals
- Build the Provider Dashboard (patient roster, aggregate stats snapshot)
- Implement session template CRUD using Next.js Server Actions
- Implement exercise management within sessions (add, edit, reorder, delete)
- Support dual-category notes: provider-only (session-level) and patient-facing (exercise-level)
- Build the patient library/exercise library for managing reusable content
- Implement patient removal from the provider's roster

## Pages

### `/provider/dashboard`
The main clinical command center.

**Components:**
- `PatientRosterCard` — list of linked patients with: name, daily streak, last active date, compliance badge
- `StatsOverview` — aggregate: total patients, total sessions this week, average compliance rate
- `QuickActions` — "Generate Invitation Code", "Create Session Template", "View All Patients"
- `RecentActivity` — latest session completions, new messages (with badge count)

**Data Flow:**
- Server Component fetches all patients linked to `provider_id`
- Fetches latest `session_executions` for each patient to compute streak/compliance
- Fetches unread message count per patient

### `/provider/patients/[patientId]`
Detailed view of a single patient's history and assigned program.

**Components:**
- `PatientProfile` — name, joined date, overall compliance streak chart
- `AssignedSession` — current session template (if any), with expandable exercise list
- `SessionHistory` — timeline of past session_executions with scores
- `ExportButton` — triggers PDF export (Phase 7)
- `ChatButton` — opens chat interface (Phase 6)
- `RemovePatientButton` — removes patient from the provider's roster with a confirmation modal

### `/provider/sessions/new` and `/provider/sessions/[sessionId]/edit`
Create or edit a session template for a specific patient.

**Components:**
- `SessionForm` — name, patient selector, provider_notes (textarea)
- `ExerciseList` — ordered list of exercises in the session
  - Each exercise: name, sets, reps, patient_notes, attach video button
  - Drag-and-drop reorder (same `@dnd-kit` library as patient, but reorder persists to DB)
  - "Add Exercise" button appends a new row
- `ProviderNotesSection` — confidential notes only visible to provider (saved to `sessions_template.provider_notes`)
- `SaveButton` — Server Action persists the entire session + exercises

### `/provider/library`
Central library of exercises and videos.

**Components:**
- `ExerciseLibraryGrid` — cards showing exercise name, sets/reps thumbnail
- `VideoLibraryGrid` — video thumbnails with playback, linked exercise tag
- `UploadVideoButton` — record or upload a new exercise video (Phase 5)

## Server Actions

```typescript
// src/lib/actions/sessions.ts
export async function createSessionTemplate(data: SessionTemplateInput) { ... }
export async function updateSessionTemplate(id: string, data: SessionTemplateInput) { ... }
export async function deleteSessionTemplate(id: string) { ... }

// src/lib/actions/exercises.ts
export async function addExercise(sessionTemplateId: string, data: ExerciseInput) { ... }
export async function updateExercise(id: string, data: ExerciseInput) { ... }
export async function deleteExercise(id: string) { ... }
export async function reorderExercises(items: { id: string; sort_order: number }[]) { ... }

// src/lib/actions/invitations.ts
export async function generateInvitationCode(): Promise<string> { ... }

// src/lib/actions/patients.ts
export async function removePatient(patientId: string) { ... }
```

Each Server Action:
1. Authenticates the caller via `supabase.auth.getUser()`
2. Validates the caller's role is `provider`
3. Validates input (zod schemas)
4. Executes the database mutation
5. Returns the result or a `{ error }` object
6. RLS policies enforce tenant isolation

## User Interface States

Every interactive component handles these states:
- **Loading** — skeleton placeholders while data fetches
- **Empty** — `EmptyState` component with CTA when no sessions/exercises/patients
- **Error** — inline error message with retry button
- **Success** — toast notification after mutations
- **Optimistic updates** — UI updates immediately before server confirms (for reorder, toggle)

## Dual-Category Notes Implementation

- **Provider notes** (`sessions_template.provider_notes`): column is never selected when querying as a patient. Enforced at the application layer (patient-side queries omit this column). Column-level RLS can be added for defense-in-depth.
- **Patient notes** (`exercises.patient_notes`): readable by both roles. Shown as instructional text before the exercise execution in the patient interface.
- Provider notes section in the form has a visual lock/shield icon to reinforce confidentiality.

## Test Cases

### Unit: Session CRUD validation
Submit invalid session name (empty), invalid sets/reps (negative). Assert Server Action returns validation errors.

### Integration: Provider can only see their patients
Seed sessions for Provider A and Provider B. Login as Provider A. Assert Provider A's dashboard only shows their patients.

### Integration: Provider notes are hidden from patients
Seed a session with provider_notes. Query as the linked patient. Assert provider_notes column is null/omitted.

### Integration: Provider can remove a patient
Seed a patient linked to Provider A. Call `removePatient` as Provider A. Assert the patient's `provider_id` is set to null or the patient record is unlinked. Call as Provider B — assert error.

## Acceptance Criteria
- [ ] Provider dashboard loads with patient roster and stats
- [ ] Provider can create, edit, and delete session templates
- [ ] Provider can add, edit, reorder, and delete exercises within a session
- [ ] Provider can write confidential notes visible only to themselves
- [ ] Provider can write patient-facing notes on exercises
- [ ] Provider can generate invitation codes from the dashboard
- [ ] Provider can remove a patient from their roster with confirmation
- [ ] All mutations show loading, success, and error states
