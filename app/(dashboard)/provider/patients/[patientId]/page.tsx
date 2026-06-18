import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Avatar, Badge } from "@/components/ui";
import { RemovePatientButton } from "./RemovePatientButton";
import { ExportButton } from "./ExportButton";
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

interface ExerciseRow {
  id: string;
  name: string;
  sets: number;
  reps: number;
  sort_order: number;
}

interface SessionRow {
  id: string;
  name: string;
  exercises: ExerciseRow[];
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
        .single<{
          id: string;
          email: string | null;
          created_at: string;
          provider_id: string | null;
        }>(),
      supabase
        .from("sessions_template")
        .select(
          "id, name, exercises(id, name, sets, reps, sort_order)"
        )
        .eq("patient_id", patientId)
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<SessionRow>(),
      supabase
        .from("session_executions")
        .select(
          "id, status, completed_at, ease_score, pain_score, sessions_template(name)"
        )
        .eq("patient_id", patientId)
        .order("completed_at", { ascending: false })
        .limit(20),
    ]);

  if (!patient) notFound();

  const execs = (executions ?? []) as unknown as ExecutionRow[];

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
            <div className="flex flex-col gap-0">
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
                className="px-4 py-3 flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
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
                <div className="flex gap-1.5 shrink-0">
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

      <div className="pt-2 flex flex-col gap-3">
        <ExportButton patientId={patientId} />
        <RemovePatientButton patientId={patientId} />
      </div>
    </div>
  );
}
