import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { SessionForm } from "../../SessionForm";
import type { ExerciseFormItem } from "../../ExerciseList";
import { EditErrorBoundary } from "../EditErrorBoundary";
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
    video_id: string | null;
    videos: { storage_path: string } | null;
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
        "id, name, patient_id, provider_notes, exercises(id, name, sets, reps, patient_notes, sort_order, video_id, videos(storage_path))"
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
      video_id: ex.video_id,
      video_storage_path: ex.videos?.storage_path ?? null,
    }));

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <Link href="/provider/templates" className="text-sm text-primary">
        ← Templates
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">Edit session</h1>
      <EditErrorBoundary>
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
      </EditErrorBoundary>
    </div>
  );
}
