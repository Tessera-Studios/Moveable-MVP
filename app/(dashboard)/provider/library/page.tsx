import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import { getProviderVideos } from "@/lib/actions/videos";
import type { ProviderVideoRow } from "@/lib/actions/videos";

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

  const [exercisesResult, videosResult] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, sets, reps, sessions_template!inner(provider_id)")
      .eq("sessions_template.provider_id", user.id)
      .order("name"),
    getProviderVideos(),
  ]);

  const exercises = (exercisesResult.data ?? []) as ExerciseRow[];
  const videos: ProviderVideoRow[] = "error" in videosResult ? [] : videosResult;

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
        <h2 className="text-base font-semibold text-foreground mb-3">
          Videos ({videos.length})
        </h2>
        {videos.length === 0 ? (
          <EmptyState
            title="No videos yet"
            description="Attach instructional videos to exercises in your session templates."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {videos.map((video) => (
              <div key={video.id} className="bg-card rounded-card shadow-card p-4">
                <VideoPlayer
                  storagePath={video.storage_path}
                  label={
                    video.exercise_name
                      ? `Exercise: ${video.exercise_name} · ${new Date(video.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : `Unlinked · ${new Date(video.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
