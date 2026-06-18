# Phase 3: Provider Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Provider Interface: dashboard, patient roster & detail, session template CRUD with drag-and-drop exercise management, and a library page.

**Architecture:** Server Components fetch data at the page level and pass it down as props; Client Components handle interactivity (DnD, forms, mutations). Server Actions use the established `requireRole` utility for auth + role enforcement. All mutations return `{ error }` on failure or invoke `revalidatePath` on success.

**Tech Stack:** Next.js 16 App Router, Supabase SSR, @dnd-kit/sortable, Tailwind v4, existing UI primitives (Button, Card, Badge, Modal, Toast, EmptyState, LoadingSpinner, Avatar)

## Global Constraints

- Max container width: 512px (mobile-first PWA)
- All Server Actions must call `requireRole("provider")` first
- No dark mode — light only
- No `any` types — use explicit interfaces
- Files stay under ~300 lines; split when exceeded
- Primary: #1E88E5 | Secondary: #00897B | Error: #D32F2F
- Inter font via `--font-sans`
- `await cookies()` pattern for server clients (Next.js 16 async API)

---

### Task 1: Session & Exercise Server Actions

**Files:**
- Create: `lib/actions/sessions.ts`
- Create: `lib/actions/exercises.ts`

**Interfaces:**
- Produces:
  - `createSessionTemplate(data: SessionTemplateInput): Promise<{ id: string } | { error: string }>`
  - `updateSessionTemplate(id: string, data: SessionTemplateInput): Promise<{ ok: true } | { error: string }>`
  - `deleteSessionTemplate(id: string): Promise<{ ok: true } | { error: string }>`
  - `addExercise(sessionTemplateId: string, data: ExerciseInput): Promise<{ id: string } | { error: string }>`
  - `updateExercise(id: string, data: ExerciseInput): Promise<{ ok: true } | { error: string }>`
  - `deleteExercise(id: string): Promise<{ ok: true } | { error: string }>`
  - `reorderExercises(items: { id: string; sort_order: number }[]): Promise<{ ok: true } | { error: string }>`

- [ ] **Step 1: Create `lib/actions/sessions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/auth";

export interface SessionTemplateInput {
  patient_id: string;
  name: string;
  provider_notes?: string | null;
}

export async function createSessionTemplate(
  data: SessionTemplateInput
): Promise<{ id: string } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  if (!data.name.trim()) return { error: "Session name is required." };
  if (!data.patient_id) return { error: "Patient is required." };

  const { data: row, error } = await auth.supabase
    .from("sessions_template")
    .insert({
      provider_id: auth.userId,
      patient_id: data.patient_id,
      name: data.name.trim(),
      provider_notes: data.provider_notes ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  revalidatePath("/provider");
  revalidatePath("/provider/templates");
  return { id: row.id };
}

export async function updateSessionTemplate(
  id: string,
  data: SessionTemplateInput
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  if (!data.name.trim()) return { error: "Session name is required." };

  const { error } = await auth.supabase
    .from("sessions_template")
    .update({
      name: data.name.trim(),
      provider_notes: data.provider_notes ?? null,
    })
    .eq("id", id)
    .eq("provider_id", auth.userId);

  if (error) return { error: error.message };

  revalidatePath("/provider/templates");
  revalidatePath(`/provider/sessions/${id}/edit`);
  return { ok: true };
}

export async function deleteSessionTemplate(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("sessions_template")
    .delete()
    .eq("id", id)
    .eq("provider_id", auth.userId);

  if (error) return { error: error.message };

  revalidatePath("/provider/templates");
  return { ok: true };
}
```

- [ ] **Step 2: Create `lib/actions/exercises.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/auth";

export interface ExerciseInput {
  name: string;
  sets: number;
  reps: number;
  patient_notes?: string | null;
  sort_order: number;
}

export async function addExercise(
  sessionTemplateId: string,
  data: ExerciseInput
): Promise<{ id: string } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  if (!data.name.trim()) return { error: "Exercise name is required." };
  if (data.sets < 1) return { error: "Sets must be at least 1." };
  if (data.reps < 1) return { error: "Reps must be at least 1." };

  const { data: row, error } = await auth.supabase
    .from("exercises")
    .insert({
      session_template_id: sessionTemplateId,
      name: data.name.trim(),
      sets: data.sets,
      reps: data.reps,
      patient_notes: data.patient_notes ?? null,
      sort_order: data.sort_order,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };
  return { id: row.id };
}

export async function updateExercise(
  id: string,
  data: ExerciseInput
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  if (!data.name.trim()) return { error: "Exercise name is required." };
  if (data.sets < 1) return { error: "Sets must be at least 1." };
  if (data.reps < 1) return { error: "Reps must be at least 1." };

  const { error } = await auth.supabase
    .from("exercises")
    .update({
      name: data.name.trim(),
      sets: data.sets,
      reps: data.reps,
      patient_notes: data.patient_notes ?? null,
      sort_order: data.sort_order,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteExercise(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("exercises")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function reorderExercises(
  items: { id: string; sort_order: number }[]
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const updates = items.map(({ id, sort_order }) =>
    auth.supabase.from("exercises").update({ sort_order }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  return { ok: true };
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/sessions.ts lib/actions/exercises.ts
git commit -m "feat: session template and exercise server actions"
```

---

### Task 2: Patient Server Actions & Data Helpers

**Files:**
- Create: `lib/actions/patients.ts`

**Interfaces:**
- Produces:
  - `removePatient(patientId: string): Promise<{ ok: true } | { error: string }>`
  - `PatientWithStats` interface (exported)

- [ ] **Step 1: Create `lib/actions/patients.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/auth";

export interface PatientWithStats {
  id: string;
  email: string | null;
  created_at: string;
  streak: number;
  last_active: string | null;
  compliance_rate: number;
}

export async function removePatient(
  patientId: string
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("users")
    .update({ provider_id: null })
    .eq("id", patientId)
    .eq("provider_id", auth.userId);

  if (error) return { error: error.message };

  revalidatePath("/provider");
  revalidatePath("/provider/patients");
  return { ok: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/patients.ts
git commit -m "feat: patient removal server action"
```

---

### Task 3: Provider Dashboard (Full)

**Files:**
- Modify: `app/(dashboard)/provider/page.tsx`
- Create: `app/(dashboard)/provider/StatsOverview.tsx`
- Create: `app/(dashboard)/provider/PatientRosterCard.tsx`
- Create: `app/(dashboard)/provider/RecentActivity.tsx`

**Interfaces:**
- Consumes: `requireRole`, `createClient` (server), Supabase `users` + `session_executions` tables
- `PatientRow { id: string; email: string | null; created_at: string; provider_id: string | null }`

- [ ] **Step 1: Create `app/(dashboard)/provider/StatsOverview.tsx`**

```typescript
import React from "react";

interface StatsOverviewProps {
  totalPatients: number;
  sessionsThisWeek: number;
  avgComplianceRate: number;
}

export function StatsOverview({
  totalPatients,
  sessionsThisWeek,
  avgComplianceRate,
}: StatsOverviewProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label="Patients" value={totalPatients} />
      <StatCard label="Sessions this week" value={sessionsThisWeek} />
      <StatCard label="Avg compliance" value={`${avgComplianceRate}%`} />
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): React.JSX.Element {
  return (
    <div className="bg-card rounded-card shadow-card p-4 flex flex-col gap-1">
      <span className="text-2xl font-bold text-foreground leading-none">
        {value}
      </span>
      <span className="text-[11px] text-muted leading-tight">{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/provider/PatientRosterCard.tsx`**

```typescript
import React from "react";
import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";

interface Patient {
  id: string;
  email: string | null;
  streak: number;
  last_active: string | null;
  compliance_rate: number;
}

interface PatientRosterCardProps {
  patients: Patient[];
}

function complianceBadgeVariant(
  rate: number
): "success" | "warning" | "error" {
  if (rate >= 80) return "success";
  if (rate >= 50) return "warning";
  return "error";
}

function formatLastActive(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export function PatientRosterCard({
  patients,
}: PatientRosterCardProps): React.JSX.Element {
  if (patients.length === 0) {
    return (
      <div className="bg-card rounded-card shadow-card p-5">
        <p className="text-sm text-muted text-center py-4">
          No patients yet. Share an invitation code to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-card shadow-card divide-y divide-border">
      {patients.map((patient) => (
        <Link
          key={patient.id}
          href={`/provider/patients/${patient.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors"
        >
          <Avatar
            name={patient.email ?? "Patient"}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {patient.email ?? "Unknown patient"}
            </p>
            <p className="text-xs text-muted">
              {patient.streak > 0 ? `${patient.streak}d streak · ` : ""}
              Last active: {formatLastActive(patient.last_active)}
            </p>
          </div>
          <Badge variant={complianceBadgeVariant(patient.compliance_rate)}>
            {patient.compliance_rate}%
          </Badge>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/(dashboard)/provider/RecentActivity.tsx`**

```typescript
import React from "react";

interface ActivityItem {
  id: string;
  patient_email: string | null;
  session_name: string;
  completed_at: string;
}

interface RecentActivityProps {
  items: ActivityItem[];
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RecentActivity({
  items,
}: RecentActivityProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-4">
        No recent activity.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 bg-card rounded-card shadow-card px-4 py-3"
        >
          <div className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">
              <span className="font-medium">
                {item.patient_email ?? "Patient"}
              </span>{" "}
              completed{" "}
              <span className="font-medium">{item.session_name}</span>
            </p>
            <p className="text-xs text-muted">{formatTime(item.completed_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `app/(dashboard)/provider/page.tsx`**

```typescript
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StatsOverview } from "./StatsOverview";
import { PatientRosterCard } from "./PatientRosterCard";
import { RecentActivity } from "./RecentActivity";
import InvitationCodeWidget from "./InvitationCodeWidget";
import Link from "next/link";
import { Button } from "@/components/ui";

interface PatientRow {
  id: string;
  email: string | null;
  created_at: string;
}

interface ExecutionRow {
  id: string;
  patient_id: string;
  completed_at: string | null;
  session_template_id: string;
  sessions_template: { name: string } | null;
}

function computeStreak(
  executions: { completed_at: string | null }[]
): number {
  const days = executions
    .filter((e) => e.completed_at)
    .map((e) => {
      const d = new Date(e.completed_at!);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
    .sort((a, b) => b - a);

  const unique = [...new Set(days)];
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < unique.length; i++) {
    const expected = today.getTime() - i * 86400000;
    if (unique[i] === expected) streak++;
    else break;
  }
  return streak;
}

export default async function ProviderDashboardPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: patientsRaw }, { data: executions }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, created_at")
      .eq("provider_id", user.id)
      .eq("role", "patient"),
    supabase
      .from("session_executions")
      .select("id, patient_id, completed_at, session_template_id, sessions_template(name)")
      .in(
        "patient_id",
        (patientsRaw ?? []).map((p) => p.id)
      )
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(50),
  ]);

  const patients = (patientsRaw ?? []) as PatientRow[];
  const execs = (executions ?? []) as ExecutionRow[];

  const sessionsThisWeek = execs.filter(
    (e) => e.completed_at && e.completed_at > weekAgo
  ).length;

  const patientsWithStats = patients.map((p) => {
    const patientExecs = execs.filter((e) => e.patient_id === p.id);
    const streak = computeStreak(patientExecs);
    const last_active =
      patientExecs.length > 0 ? patientExecs[0].completed_at : null;
    const total = patientExecs.length;
    const compliance_rate = total > 0 ? Math.min(100, Math.round((total / 7) * 100)) : 0;
    return { ...p, streak, last_active, compliance_rate };
  });

  const avgComplianceRate =
    patientsWithStats.length > 0
      ? Math.round(
          patientsWithStats.reduce((s, p) => s + p.compliance_rate, 0) /
            patientsWithStats.length
        )
      : 0;

  const recentActivity = execs.slice(0, 10).map((e) => ({
    id: e.id,
    patient_email:
      patients.find((p) => p.id === e.patient_id)?.email ?? null,
    session_name: e.sessions_template?.name ?? "Session",
    completed_at: e.completed_at!,
  }));

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{greeting}</h1>
        <p className="text-sm text-muted mt-0.5">Here's your practice at a glance.</p>
      </div>

      <StatsOverview
        totalPatients={patients.length}
        sessionsThisWeek={sessionsThisWeek}
        avgComplianceRate={avgComplianceRate}
      />

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-foreground">Patients</h2>
          <Link href="/provider/patients" className="text-sm text-primary font-medium">
            View all
          </Link>
        </div>
        <PatientRosterCard patients={patientsWithStats.slice(0, 5)} />
      </section>

      <div className="flex flex-col gap-3">
        <InvitationCodeWidget />
        <Link href="/provider/sessions/new">
          <Button variant="secondary" className="w-full">
            Create Session Template
          </Button>
        </Link>
      </div>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">Recent Activity</h2>
        <RecentActivity items={recentActivity} />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/provider/page.tsx app/(dashboard)/provider/StatsOverview.tsx app/(dashboard)/provider/PatientRosterCard.tsx app/(dashboard)/provider/RecentActivity.tsx
git commit -m "feat: full provider dashboard with stats, roster, and activity"
```

---

### Task 4: Patient Roster & Detail Pages

**Files:**
- Create: `app/(dashboard)/provider/patients/page.tsx`
- Create: `app/(dashboard)/provider/patients/[patientId]/page.tsx`
- Create: `app/(dashboard)/provider/patients/[patientId]/RemovePatientButton.tsx`

**Interfaces:**
- Consumes: `removePatient` from `lib/actions/patients.ts`

- [ ] **Step 1: Create `app/(dashboard)/provider/patients/page.tsx`**

```typescript
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PatientRosterCard } from "../PatientRosterCard";
import { EmptyState } from "@/components/ui";
import Link from "next/link";

export default async function PatientsPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: patientsRaw } = await supabase
    .from("users")
    .select("id, email, created_at")
    .eq("provider_id", user.id)
    .eq("role", "patient")
    .order("created_at", { ascending: false });

  const patients = (patientsRaw ?? []) as {
    id: string;
    email: string | null;
    created_at: string;
  }[];

  const patientsWithStats = patients.map((p) => ({
    ...p,
    streak: 0,
    last_active: null,
    compliance_rate: 0,
  }));

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Patients</h1>
        <Link
          href="/provider/sessions/new"
          className="text-sm text-primary font-medium"
        >
          + New Session
        </Link>
      </div>

      {patients.length === 0 ? (
        <EmptyState
          title="No patients yet"
          description="Generate an invitation code and share it with your patients to get started."
        />
      ) : (
        <PatientRosterCard patients={patientsWithStats} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/provider/patients/[patientId]/RemovePatientButton.tsx`**

```typescript
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui";
import { removePatient } from "@/lib/actions/patients";

export function RemovePatientButton({
  patientId,
}: {
  patientId: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRemove(): Promise<void> {
    setLoading(true);
    setError(null);
    const result = await removePatient(patientId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setOpen(false);
      router.push("/provider/patients");
    }
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Remove patient
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Remove patient"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            This will unlink the patient from your practice. They will no
            longer appear in your roster. This action cannot be undone.
          </p>
          {error && (
            <p className="text-sm text-error">{error}</p>
          )}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={loading}
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Create `app/(dashboard)/provider/patients/[patientId]/page.tsx`**

```typescript
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Avatar, Badge } from "@/components/ui";
import { RemovePatientButton } from "./RemovePatientButton";
import Link from "next/link";

interface PageProps {
  params: Promise<{ patientId: string }>;
}

interface ExecutionRow {
  id: string;
  status: "pending" | "completed";
  completed_at: string | null;
  ease_score: number | null;
  pain_score: number | null;
  sessions_template: { name: string } | null;
}

export default async function PatientDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: patient }, { data: assignedSession }, { data: executions }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, email, created_at, provider_id")
        .eq("id", patientId)
        .eq("provider_id", user.id)
        .single<{ id: string; email: string | null; created_at: string; provider_id: string | null }>(),
      supabase
        .from("sessions_template")
        .select("id, name, provider_id, exercises(id, name, sets, reps, sort_order)")
        .eq("patient_id", patientId)
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("session_executions")
        .select("id, status, completed_at, ease_score, pain_score, sessions_template(name)")
        .eq("patient_id", patientId)
        .order("completed_at", { ascending: false })
        .limit(20),
    ]);

  if (!patient) notFound();

  const execs = (executions ?? []) as ExecutionRow[];

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <Link href="/provider/patients" className="text-sm text-primary">
        ← Patients
      </Link>

      <div className="flex items-center gap-4">
        <Avatar name={patient.email ?? "Patient"} size="lg" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {patient.email ?? "Unknown patient"}
          </h1>
          <p className="text-sm text-muted">
            Joined{" "}
            {new Date(patient.created_at).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-foreground">
            Assigned session
          </h2>
          <Link
            href={
              assignedSession
                ? `/provider/sessions/${assignedSession.id}/edit`
                : `/provider/sessions/new?patientId=${patientId}`
            }
            className="text-sm text-primary font-medium"
          >
            {assignedSession ? "Edit" : "Assign session"}
          </Link>
        </div>

        {assignedSession ? (
          <div className="bg-card rounded-card shadow-card p-4 flex flex-col gap-3">
            <p className="font-medium text-foreground">{assignedSession.name}</p>
            <div className="flex flex-col gap-1.5">
              {(assignedSession.exercises ?? [])
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-foreground">{ex.name}</span>
                    <span className="text-xs text-muted">
                      {ex.sets}×{ex.reps}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-card shadow-card p-4">
            <p className="text-sm text-muted">No session assigned yet.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">
          Session history
        </h2>
        {execs.length === 0 ? (
          <div className="bg-card rounded-card shadow-card p-4">
            <p className="text-sm text-muted">No sessions completed yet.</p>
          </div>
        ) : (
          <div className="bg-card rounded-card shadow-card divide-y divide-border">
            {execs.map((ex) => (
              <div
                key={ex.id}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {ex.sessions_template?.name ?? "Session"}
                  </p>
                  <p className="text-xs text-muted">
                    {ex.completed_at
                      ? new Date(ex.completed_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "In progress"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {ex.ease_score !== null && (
                    <Badge variant="info">Ease {ex.ease_score}/5</Badge>
                  )}
                  {ex.pain_score !== null && (
                    <Badge variant={ex.pain_score > 3 ? "error" : "success"}>
                      Pain {ex.pain_score}/5
                    </Badge>
                  )}
                  <Badge
                    variant={ex.status === "completed" ? "success" : "default"}
                  >
                    {ex.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="pt-2">
        <RemovePatientButton patientId={patientId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/provider/patients/"
git commit -m "feat: patient roster and detail pages with remove action"
```

---

### Task 5: Session Templates List

**Files:**
- Create: `app/(dashboard)/provider/templates/page.tsx`

- [ ] **Step 1: Create `app/(dashboard)/provider/templates/page.tsx`**

```typescript
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmptyState, Badge } from "@/components/ui";
import Link from "next/link";
import { deleteSessionTemplate } from "@/lib/actions/sessions";

interface TemplateRow {
  id: string;
  name: string;
  patient_id: string;
  created_at: string;
  exercises: { id: string }[];
  users: { email: string | null } | null;
}

export default async function TemplatesPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: templates } = await supabase
    .from("sessions_template")
    .select("id, name, patient_id, created_at, exercises(id), users!patient_id(email)")
    .eq("provider_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (templates ?? []) as TemplateRow[];

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Templates</h1>
        <Link
          href="/provider/sessions/new"
          className="text-sm text-primary font-medium"
        >
          + New
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No session templates yet"
          description="Create a session template to assign exercises to a patient."
          action={
            <Link
              href="/provider/sessions/new"
              className="inline-flex items-center justify-center h-10 px-5 rounded-button bg-primary text-white text-sm font-medium"
            >
              Create template
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((t) => (
            <div
              key={t.id}
              className="bg-card rounded-card shadow-card p-4 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{t.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {t.users?.email ?? "Unassigned"} ·{" "}
                  {t.exercises.length} exercise
                  {t.exercises.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Link
                href={`/provider/sessions/${t.id}/edit`}
                className="text-sm text-primary font-medium shrink-0"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/provider/templates/"
git commit -m "feat: session templates list page"
```

---

### Task 6: Session Form (Create + Edit with Drag-and-Drop Exercises)

**Files:**
- Create: `app/(dashboard)/provider/sessions/ExerciseList.tsx`
- Create: `app/(dashboard)/provider/sessions/SessionForm.tsx`
- Create: `app/(dashboard)/provider/sessions/new/page.tsx`
- Create: `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx`

**Interfaces:**
- Consumes: `createSessionTemplate`, `updateSessionTemplate`, `deleteSessionTemplate` from `lib/actions/sessions.ts`; `addExercise`, `updateExercise`, `deleteExercise`, `reorderExercises` from `lib/actions/exercises.ts`
- `ExerciseFormItem { id: string; name: string; sets: number; reps: number; patient_notes: string; sort_order: number; isNew?: boolean }`

- [ ] **Step 1: Create `app/(dashboard)/provider/sessions/ExerciseList.tsx`**

```typescript
"use client";

import React, { useId } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface ExerciseFormItem {
  id: string;
  name: string;
  sets: number;
  reps: number;
  patient_notes: string;
  sort_order: number;
  isNew?: boolean;
}

interface ExerciseListProps {
  items: ExerciseFormItem[];
  onChange: (items: ExerciseFormItem[]) => void;
}

interface SortableRowProps {
  item: ExerciseFormItem;
  onChange: (updated: ExerciseFormItem) => void;
  onDelete: () => void;
}

function SortableRow({
  item,
  onChange,
  onDelete,
}: SortableRowProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const nameId = useId();
  const setsId = useId();
  const repsId = useId();
  const notesId = useId();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card rounded-card shadow-card p-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="touch-none cursor-grab active:cursor-grabbing text-placeholder p-1 -ml-1 rounded"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="12" height="2" rx="1" />
            <rect x="2" y="7" width="12" height="2" rx="1" />
            <rect x="2" y="11" width="12" height="2" rx="1" />
          </svg>
        </button>
        <div className="flex-1">
          <label
            htmlFor={nameId}
            className="text-xs font-medium text-muted mb-1 block"
          >
            Exercise name
          </label>
          <input
            id={nameId}
            type="text"
            value={item.name}
            onChange={(e) => onChange({ ...item, name: e.target.value })}
            placeholder="e.g. Knee extension"
            className="w-full h-10 rounded-sm border border-border px-3 text-sm text-foreground bg-background placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete exercise"
          className="text-placeholder hover:text-error transition-colors p-1 rounded"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={setsId}
            className="text-xs font-medium text-muted mb-1 block"
          >
            Sets
          </label>
          <input
            id={setsId}
            type="number"
            min={1}
            value={item.sets}
            onChange={(e) =>
              onChange({ ...item, sets: Math.max(1, Number(e.target.value)) })
            }
            className="w-full h-10 rounded-sm border border-border px-3 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label
            htmlFor={repsId}
            className="text-xs font-medium text-muted mb-1 block"
          >
            Reps
          </label>
          <input
            id={repsId}
            type="number"
            min={1}
            value={item.reps}
            onChange={(e) =>
              onChange({ ...item, reps: Math.max(1, Number(e.target.value)) })
            }
            className="w-full h-10 rounded-sm border border-border px-3 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={notesId}
          className="text-xs font-medium text-muted mb-1 block"
        >
          Patient notes (optional)
        </label>
        <textarea
          id={notesId}
          value={item.patient_notes}
          onChange={(e) => onChange({ ...item, patient_notes: e.target.value })}
          placeholder="Instructions visible to the patient"
          rows={2}
          className="w-full rounded-sm border border-border px-3 py-2 text-sm text-foreground bg-background placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>
    </div>
  );
}

export function ExerciseList({
  items,
  onChange,
}: ExerciseListProps): React.JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map(
      (item, index) => ({ ...item, sort_order: index })
    );
    onChange(reordered);
  }

  function updateItem(id: string, updated: ExerciseFormItem): void {
    onChange(items.map((i) => (i.id === id ? updated : i)));
  }

  function deleteItem(id: string): void {
    onChange(items.filter((i) => i.id !== id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              onChange={(updated) => updateItem(item.id, updated)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/provider/sessions/SessionForm.tsx`**

```typescript
"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ExerciseList, ExerciseFormItem } from "./ExerciseList";
import {
  createSessionTemplate,
  updateSessionTemplate,
  deleteSessionTemplate,
} from "@/lib/actions/sessions";
import {
  addExercise,
  updateExercise,
  deleteExercise,
  reorderExercises,
} from "@/lib/actions/exercises";

interface Patient {
  id: string;
  email: string | null;
}

interface SessionFormProps {
  mode: "create" | "edit";
  sessionId?: string;
  initialData?: {
    name: string;
    patient_id: string;
    provider_notes: string;
    exercises: ExerciseFormItem[];
  };
  patients: Patient[];
}

function newExercise(sortOrder: number): ExerciseFormItem {
  return {
    id: `new-${Date.now()}-${Math.random()}`,
    name: "",
    sets: 3,
    reps: 10,
    patient_notes: "",
    sort_order: sortOrder,
    isNew: true,
  };
}

export function SessionForm({
  mode,
  sessionId,
  initialData,
  patients,
}: SessionFormProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialData?.name ?? "");
  const [patientId, setPatientId] = useState(initialData?.patient_id ?? "");
  const [providerNotes, setProviderNotes] = useState(
    initialData?.provider_notes ?? ""
  );
  const [exercises, setExercises] = useState<ExerciseFormItem[]>(
    initialData?.exercises ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function addNewExercise(): void {
    setExercises((prev) => [...prev, newExercise(prev.length)]);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Session name is required.");
      return;
    }
    if (!patientId) {
      setError("Please select a patient.");
      return;
    }

    startTransition(async () => {
      if (mode === "create") {
        const result = await createSessionTemplate({
          name,
          patient_id: patientId,
          provider_notes: providerNotes || null,
        });

        if ("error" in result) {
          setError(result.error);
          return;
        }

        const createdId = result.id;

        if (exercises.length > 0) {
          const exerciseResults = await Promise.all(
            exercises.map((ex) =>
              addExercise(createdId, {
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                patient_notes: ex.patient_notes || null,
                sort_order: ex.sort_order,
              })
            )
          );
          const firstError = exerciseResults.find((r) => "error" in r);
          if (firstError && "error" in firstError) {
            setError(firstError.error);
            return;
          }
        }

        router.push("/provider/templates");
      } else if (mode === "edit" && sessionId) {
        const result = await updateSessionTemplate(sessionId, {
          name,
          patient_id: patientId,
          provider_notes: providerNotes || null,
        });

        if ("error" in result) {
          setError(result.error);
          return;
        }

        const originalIds = new Set(
          (initialData?.exercises ?? []).map((e) => e.id)
        );
        const currentIds = new Set(
          exercises.filter((e) => !e.isNew).map((e) => e.id)
        );

        const toDelete = [...originalIds].filter((id) => !currentIds.has(id));
        const toAdd = exercises.filter((e) => e.isNew);
        const toUpdate = exercises.filter(
          (e) => !e.isNew && originalIds.has(e.id)
        );

        await Promise.all([
          ...toDelete.map((id) => deleteExercise(id)),
          ...toAdd.map((ex) =>
            addExercise(sessionId, {
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              patient_notes: ex.patient_notes || null,
              sort_order: ex.sort_order,
            })
          ),
          ...toUpdate.map((ex) =>
            updateExercise(ex.id, {
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              patient_notes: ex.patient_notes || null,
              sort_order: ex.sort_order,
            })
          ),
        ]);

        const existingToReorder = exercises
          .filter((e) => !e.isNew)
          .map((e) => ({ id: e.id, sort_order: e.sort_order }));
        if (existingToReorder.length > 0) {
          await reorderExercises(existingToReorder);
        }

        router.push("/provider/templates");
      }
    });
  }

  async function handleDelete(): Promise<void> {
    if (!sessionId) return;
    setDeleteLoading(true);
    const result = await deleteSessionTemplate(sessionId);
    setDeleteLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      router.push("/provider/templates");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">
          Session name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Week 1 Knee Rehab"
          className="w-full h-12 rounded-sm border border-border px-3 text-sm text-foreground bg-card placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted mb-1 block">
          Patient
        </label>
        <select
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="w-full h-12 rounded-sm border border-border px-3 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          required
        >
          <option value="">Select a patient…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.email ?? p.id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs font-medium text-muted">
            Provider notes
          </label>
          <span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded">
            Confidential
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <textarea
          value={providerNotes}
          onChange={(e) => setProviderNotes(e.target.value)}
          placeholder="Notes for your reference only — not visible to the patient"
          rows={3}
          className="w-full rounded-sm border border-border px-3 py-2 text-sm text-foreground bg-card placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Exercises</h2>
          <button
            type="button"
            onClick={addNewExercise}
            className="text-sm text-primary font-medium"
          >
            + Add exercise
          </button>
        </div>

        {exercises.length === 0 ? (
          <button
            type="button"
            onClick={addNewExercise}
            className="w-full border-2 border-dashed border-border rounded-card py-8 text-sm text-muted hover:border-primary hover:text-primary transition-colors"
          >
            Tap to add the first exercise
          </button>
        ) : (
          <ExerciseList items={exercises} onChange={setExercises} />
        )}
      </section>

      {error && (
        <p className="text-sm text-error bg-error/10 rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <Button type="submit" loading={isPending} className="w-full">
          {mode === "create" ? "Create session" : "Save changes"}
        </Button>
        {mode === "edit" && (
          <Button
            type="button"
            variant="danger"
            loading={deleteLoading}
            onClick={handleDelete}
            className="w-full"
          >
            Delete session
          </Button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create `app/(dashboard)/provider/sessions/new/page.tsx`**

```typescript
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SessionForm } from "../SessionForm";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ patientId?: string }>;
}

export default async function NewSessionPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { patientId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: patientsRaw } = await supabase
    .from("users")
    .select("id, email")
    .eq("provider_id", user.id)
    .eq("role", "patient");

  const patients = (patientsRaw ?? []) as { id: string; email: string | null }[];

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <Link href="/provider/templates" className="text-sm text-primary">
        ← Templates
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">New session</h1>
      <SessionForm
        mode="create"
        patients={patients}
        initialData={
          patientId
            ? { name: "", patient_id: patientId, provider_notes: "", exercises: [] }
            : undefined
        }
      />
    </div>
  );
}
```

- [ ] **Step 4: Create `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx`**

```typescript
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { SessionForm } from "../../SessionForm";
import type { ExerciseFormItem } from "../../ExerciseList";
import Link from "next/link";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

interface SessionRow {
  id: string;
  name: string;
  patient_id: string;
  provider_notes: string | null;
  exercises: {
    id: string;
    name: string;
    sets: number;
    reps: number;
    patient_notes: string | null;
    sort_order: number;
  }[];
}

export default async function EditSessionPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: session }, { data: patientsRaw }] = await Promise.all([
    supabase
      .from("sessions_template")
      .select(
        "id, name, patient_id, provider_notes, exercises(id, name, sets, reps, patient_notes, sort_order)"
      )
      .eq("id", sessionId)
      .eq("provider_id", user.id)
      .single<SessionRow>(),
    supabase
      .from("users")
      .select("id, email")
      .eq("provider_id", user.id)
      .eq("role", "patient"),
  ]);

  if (!session) notFound();

  const patients = (patientsRaw ?? []) as { id: string; email: string | null }[];

  const exercises: ExerciseFormItem[] = (session.exercises ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      patient_notes: ex.patient_notes ?? "",
      sort_order: ex.sort_order,
    }));

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <Link href="/provider/templates" className="text-sm text-primary">
        ← Templates
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">Edit session</h1>
      <SessionForm
        mode="edit"
        sessionId={session.id}
        patients={patients}
        initialData={{
          name: session.name,
          patient_id: session.patient_id,
          provider_notes: session.provider_notes ?? "",
          exercises,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/provider/sessions/"
git commit -m "feat: session form with drag-and-drop exercise management"
```

---

### Task 7: Library Page

**Files:**
- Create: `app/(dashboard)/provider/library/page.tsx`

- [ ] **Step 1: Create `app/(dashboard)/provider/library/page.tsx`**

```typescript
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui";

interface ExerciseRow {
  id: string;
  name: string;
  sets: number;
  reps: number;
}

export default async function LibraryPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exercisesRaw } = await supabase
    .from("exercises")
    .select(
      "id, name, sets, reps, sessions_template!inner(provider_id)"
    )
    .eq("sessions_template.provider_id", user.id)
    .order("name");

  const exercises = (exercisesRaw ?? []) as ExerciseRow[];

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-foreground">Library</h1>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Exercises ({exercises.length})
        </h2>
        {exercises.length === 0 ? (
          <EmptyState
            title="No exercises yet"
            description="Exercises you add to session templates will appear here."
          />
        ) : (
          <div className="bg-card rounded-card shadow-card divide-y divide-border">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className="px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm text-foreground font-medium">
                  {ex.name}
                </span>
                <span className="text-xs text-muted">
                  {ex.sets}×{ex.reps}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Videos</h2>
        <EmptyState
          title="Video library coming soon"
          description="Upload exercise demonstration videos in a future update."
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/provider/library/"
git commit -m "feat: provider library page for exercises and videos"
```

---

### Task 8: Update Constants & Final Cleanup

**Files:**
- Modify: `lib/constants.ts`
- Modify: `PROGRESS.md`

- [ ] **Step 1: Update `lib/constants.ts` with new routes**

Add the new provider routes:
```typescript
export const ROUTES: {
  login: string;
  register: string;
  providerDashboard: string;
  patientDashboard: string;
  providerPatients: string;
  providerTemplates: string;
  providerLibrary: string;
  providerSessionNew: string;
} = {
  login: "/login",
  register: "/register",
  providerDashboard: "/provider",
  patientDashboard: "/patient",
  providerPatients: "/provider/patients",
  providerTemplates: "/provider/templates",
  providerLibrary: "/provider/library",
  providerSessionNew: "/provider/sessions/new",
};
```

- [ ] **Step 2: Update `PROGRESS.md` with Phase 3 completion summary**

- [ ] **Step 3: Final commit**

```bash
git add lib/constants.ts PROGRESS.md
git commit -m "chore: update routes constants and mark Phase 3 complete in PROGRESS.md"
```
