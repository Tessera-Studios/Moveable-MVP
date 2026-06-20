import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExerciseExecutor from "@/components/patient/ExerciseExecutor";
import type { SessionTemplate, Exercise } from "@/lib/types";

interface Props {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ order?: string }>;
}

export default async function SessionPage({
  params,
  searchParams,
}: Props): Promise<React.JSX.Element> {
  const { sessionId } = await params;
  const { order } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessionData } = await supabase
    .from("sessions_template")
    .select("id, provider_id, patient_id, name, created_at")
    .eq("id", sessionId)
    .eq("patient_id", user.id)
    .single<SessionTemplate>();

  if (!sessionData) notFound();

  // Fetch base exercise columns without an embedded video join. The embedded
  // `videos(storage_path)` relationship can fail to resolve in PostgREST,
  // which nulls the entire result and leaves the patient with no exercises
  // even though the dashboard (which omits the join) shows them. Resolve the
  // instructional video paths in a separate, fault-tolerant query instead.
  const { data: exData } = await supabase
    .from("exercises")
    .select(
      "id, session_template_id, name, sets, reps, patient_notes, sort_order, video_id"
    )
    .eq("session_template_id", sessionId)
    .order("sort_order", { ascending: true });

  const exerciseRows = (exData ?? []) as (Exercise & { video_id: string | null })[];

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

  const allExercises: Exercise[] = exerciseRows.map((row) => ({
    ...row,
    video_storage_path: row.video_id
      ? (videoPathMap.get(row.video_id) ?? null)
      : null,
  }));

  // Apply client-provided ordering from the dashboard drag-and-drop
  let exercises = allExercises;
  if (order) {
    const ids = order.split(",").filter(Boolean);
    const map = new Map(allExercises.map((e) => [e.id, e]));
    const ordered = ids.map((id) => map.get(id)).filter(Boolean) as Exercise[];
    // Append any exercises not in the order list (safety)
    const inOrder = new Set(ids);
    const rest = allExercises.filter((e) => !inOrder.has(e.id));
    exercises = [...ordered, ...rest];
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)]">
      <div className="px-5 pt-6 pb-2">
        <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-0.5">
          Session
        </p>
        <h1 className="text-xl font-semibold text-foreground">
          {sessionData.name}
        </h1>
      </div>

      {exercises.length === 0 ? (
        <div className="px-5 py-8 text-center text-placeholder text-sm">
          No exercises in this session.
        </div>
      ) : (
        <ExerciseExecutor sessionId={sessionId} exercises={exercises} />
      )}
    </div>
  );
}
