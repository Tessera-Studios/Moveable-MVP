import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Exercise, SessionTemplate } from "@/lib/types";
import { EmptyState } from "@/components/ui";
import PatientExercisesList from "@/components/patient/PatientExercisesList";

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
        "id, session_template_id, name, sets, reps, patient_notes, sort_order, video_id"
      )
      .in("session_template_id", sessionIds)
      .order("sort_order", { ascending: true });

    const exerciseRows = (exData ?? []) as Exercise[];

    const videoIds = exerciseRows
      .map((ex) => ex.video_id)
      .filter((id): id is string => id !== null && id !== undefined);

    const videoPathMap = new Map<string, string>();
    if (videoIds.length > 0) {
      const { data: videos } = await supabase
        .from("videos")
        .select("id, storage_path")
        .in("id", videoIds);
      for (const v of videos ?? []) {
        videoPathMap.set(v.id as string, v.storage_path as string);
      }
    }

    exercises = exerciseRows.map((row) => ({
      ...row,
      video_storage_path: row.video_id
        ? (videoPathMap.get(row.video_id) ?? null)
        : null,
    }));
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
          <PatientExercisesList exercises={exercises} />
        )}
      </div>
    </div>
  );
}
