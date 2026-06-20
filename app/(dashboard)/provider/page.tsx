import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StatsOverview } from "./StatsOverview";
import { PatientRosterCard } from "./PatientRosterCard";
import { RecentActivity } from "./RecentActivity";
import InvitationCodeWidget from "./InvitationCodeWidget";
import Link from "next/link";
import { Button } from "@/components/ui";
import { UnreadBadge } from "@/components/chat/UnreadBadge";

interface PatientRow {
  id: string;
  email: string | null;
  created_at: string;
}

interface ExecutionRow {
  id: string;
  patient_id: string;
  completed_at: string | null;
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

  const { data: patientsRaw } = await supabase
    .from("users")
    .select("id, email, created_at")
    .eq("provider_id", user.id)
    .eq("role", "patient");

  const patients = (patientsRaw ?? []) as PatientRow[];

  const { data: executions } = await supabase
    .from("session_executions")
    .select("id, patient_id, completed_at, sessions_template(name)")
    .in(
      "patient_id",
      patients.map((p) => p.id)
    )
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(50);

  const execs = (executions ?? []) as unknown as ExecutionRow[];

  const sessionsThisWeek = execs.filter(
    (e) => e.completed_at && e.completed_at > weekAgo
  ).length;

  const patientsWithStats = patients.map((p) => {
    const patientExecs = execs.filter((e) => e.patient_id === p.id);
    const streak = computeStreak(patientExecs);
    const last_active =
      patientExecs.length > 0 ? patientExecs[0].completed_at : null;
    const compliance_rate =
      patientExecs.length > 0
        ? Math.min(100, Math.round((patientExecs.length / 7) * 100))
        : 0;
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
    patient_email: patients.find((p) => p.id === e.patient_id)?.email ?? null,
    session_name: e.sessions_template?.name ?? "Session",
    completed_at: e.completed_at!,
  }));

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{greeting}</h1>
          <p className="text-sm text-muted mt-0.5">
            Here's your practice at a glance.
          </p>
        </div>
        <Link
          href="/provider/chat"
          aria-label="Messages"
          className="relative p-1 text-foreground -mr-1"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <UnreadBadge />
        </Link>
      </div>

      <StatsOverview
        totalPatients={patients.length}
        sessionsThisWeek={sessionsThisWeek}
        avgComplianceRate={avgComplianceRate}
      />

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-foreground">Patients</h2>
          <Link
            href="/provider/patients"
            className="text-sm text-primary font-medium"
          >
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
        <h2 className="text-base font-semibold text-foreground mb-2">
          Recent Activity
        </h2>
        <RecentActivity items={recentActivity} />
      </section>

    </div>
  );
}
