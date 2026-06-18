import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPatientStats } from "@/lib/actions/executions";
import ProgressCharts from "@/components/patient/ProgressCharts";

async function ProgressContent(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const stats = await getPatientStats("UTC");

  return <ProgressCharts stats={stats} />;
}

export default function ProgressPage(): React.JSX.Element {
  return (
    <>
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-foreground">Progress</h1>
      </div>
      <Suspense
        fallback={
          <div className="animate-pulse px-5 pt-4 flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 bg-surface rounded-card" />
              ))}
            </div>
            <div className="h-36 bg-surface rounded-card" />
            <div className="h-32 bg-surface rounded-card" />
            <div className="h-32 bg-surface rounded-card" />
          </div>
        }
      >
        <ProgressContent />
      </Suspense>
    </>
  );
}
