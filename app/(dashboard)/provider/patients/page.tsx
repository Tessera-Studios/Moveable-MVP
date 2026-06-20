import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PatientRosterCard } from "../PatientRosterCard";
import { EmptyState } from "@/components/ui";
import Link from "next/link";
import { complianceRate, calculateStreak, distinctLocalDays } from "@/lib/stats";

interface PatientRow {
  id: string;
  email: string | null;
  created_at: string;
}

interface ExecutionRow {
  patient_id: string;
  completed_at: string | null;
}

export default async function PatientsPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: patientsRaw }, { data: executionsRaw }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, created_at")
      .eq("provider_id", user.id)
      .eq("role", "patient")
      .order("created_at", { ascending: false }),
    supabase
      .from("session_executions")
      .select("patient_id, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(200),
  ]);

  const patients = (patientsRaw ?? []) as PatientRow[];
  const executions = (executionsRaw ?? []) as ExecutionRow[];

  const patientsWithStats = patients.map((p) => {
    const patientExecs = executions.filter((e) => e.patient_id === p.id);
    const allTimestamps = patientExecs.map((e) => e.completed_at!);
    const last7Timestamps = patientExecs
      .filter((e) => e.completed_at! > weekAgo)
      .map((e) => e.completed_at!);
    const allDistinctDays = distinctLocalDays(allTimestamps, "UTC");
    const last7DistinctDays = distinctLocalDays(last7Timestamps, "UTC");
    const streak = calculateStreak(allDistinctDays, "UTC");
    const last_active = patientExecs.length > 0 ? patientExecs[0].completed_at : null;
    const compliance_rate = Math.round(complianceRate(last7DistinctDays.length, 7) * 100);
    return { ...p, streak, last_active, compliance_rate };
  });

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
