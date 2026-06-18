import React, { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StreakBanner from "@/components/patient/StreakBanner";
import ActiveSessionCard from "@/components/patient/ActiveSessionCard";
import ProgressPreview from "@/components/patient/ProgressPreview";
import { getPatientStats } from "@/lib/actions/executions";
import { getRequestTimezone } from "@/lib/timezone.server";
import type { SessionTemplate, Exercise } from "@/lib/types";
import { EmptyState } from "@/components/ui";

async function DashboardContent(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const timezone = await getRequestTimezone();
  const [stats, sessionsResult] = await Promise.all([
    getPatientStats(timezone),
    supabase
      .from("sessions_template")
      .select("id, provider_id, patient_id, name, created_at")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const session = sessionsResult.data?.[0] as SessionTemplate | undefined;

  let exercises: Exercise[] = [];
  if (session) {
    const { data: exData } = await supabase
      .from("exercises")
      .select(
        "id, session_template_id, name, sets, reps, patient_notes, sort_order"
      )
      .eq("session_template_id", session.id)
      .order("sort_order", { ascending: true });
    exercises = (exData ?? []) as Exercise[];
  }

  return (
    <>
      <StreakBanner streak={stats.streak} totalCompleted={stats.totalCompleted} />

      <div className="flex flex-col gap-4 py-4">
        {session ? (
          <ActiveSessionCard session={session} exercises={exercises} />
        ) : (
          <div className="mx-5">
            <EmptyState
              title="No session assigned yet"
              description="Your physical therapist will assign a session once you're connected."
            />
          </div>
        )}

        <ProgressPreview recentCompletions={stats.recentCompletions} />
      </div>
    </>
  );
}

export default function PatientDashboardPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse">
          <div
            className="h-36 w-full"
            style={{
              background: "linear-gradient(135deg, #1E88E5 0%, #00897B 100%)",
            }}
          />
          <div className="flex flex-col gap-4 py-4 px-5">
            <div className="h-48 bg-surface rounded-card" />
            <div className="h-20 bg-surface rounded-card" />
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
