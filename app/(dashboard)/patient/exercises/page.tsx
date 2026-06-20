import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Exercise, SessionTemplate } from "@/lib/types";
import { EmptyState } from "@/components/ui";

export default async function PatientExercisesPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessionsRaw } = await supabase
    .from("sessions_template")
    .select("id, name, patient_id, provider_id, created_at")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });

  const sessions = (sessionsRaw ?? []) as SessionTemplate[];
  const sessionIds = sessions.map((s) => s.id);

  let exercises: Exercise[] = [];
  if (sessionIds.length > 0) {
    const { data: exData } = await supabase
      .from("exercises")
      .select(
        "id, session_template_id, name, sets, reps, patient_notes, sort_order"
      )
      .in("session_template_id", sessionIds)
      .order("sort_order", { ascending: true });
    exercises = (exData ?? []) as Exercise[];
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-6">
      <h1 className="text-xl font-semibold text-foreground">Your Exercises</h1>

      <div className="bg-card rounded-card shadow-card p-5">
        {exercises.length === 0 ? (
          <EmptyState
            title="No exercises assigned yet"
            description="Your physical therapist will assign exercises once you're connected."
          />
        ) : (
          <div>
            {exercises.map((ex, i) => (
              <div
                key={ex.id}
                className={`flex items-center gap-3 py-3 ${
                  i < exercises.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-muted">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ex.name}
                  </p>
                  <p className="text-xs text-placeholder">
                    {ex.sets} sets · {ex.reps} reps
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
