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
    .select("id, name, sets, reps, sessions_template!inner(provider_id)")
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
