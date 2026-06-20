"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateStreak, toLocalDate } from "@/lib/stats";
import type { PatientStats } from "@/lib/types";

export async function completeSession(
  sessionTemplateId: string,
  easeScore: number,
  painScore: number,
  timezone: string = "UTC"
): Promise<{ streak: number; totalCompleted: number }> {
  if (
    !Number.isInteger(easeScore) ||
    easeScore < 1 ||
    easeScore > 5 ||
    !Number.isInteger(painScore) ||
    painScore < 1 ||
    painScore > 5
  ) {
    throw new Error("Scores must be integers between 1 and 5");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  // Dedupe per local day: if this template was already completed today (in the
  // patient's timezone), update that row instead of inserting a duplicate.
  // session_executions has no unique constraint, so this is enforced here.
  const now = new Date();
  const today = toLocalDate(now.toISOString(), timezone);

  const { data: todaysCompletions } = await supabase
    .from("session_executions")
    .select("id, completed_at")
    .eq("patient_id", user.id)
    .eq("session_template_id", sessionTemplateId)
    .eq("status", "completed")
    .not("completed_at", "is", null);

  const existing = (todaysCompletions ?? []).find(
    (c) => toLocalDate(c.completed_at!, timezone) === today
  );

  const payload = {
    ease_score: easeScore,
    pain_score: painScore,
    completed_at: now.toISOString(),
  };

  const { error } = existing
    ? await supabase
        .from("session_executions")
        .update(payload)
        .eq("id", existing.id)
    : await supabase.from("session_executions").insert({
        session_template_id: sessionTemplateId,
        patient_id: user.id,
        status: "completed",
        ...payload,
      });

  if (error) throw new Error(error.message);

  const { data: allCompletions } = await supabase
    .from("session_executions")
    .select("completed_at")
    .eq("patient_id", user.id)
    .eq("status", "completed")
    .not("completed_at", "is", null);

  const dates = (allCompletions ?? [])
    .map((c) => toLocalDate(c.completed_at!, timezone));

  const result = {
    streak: calculateStreak(dates, timezone),
    totalCompleted: dates.length,
  };

  revalidatePath("/patient", "layout");

  return result;
}

export async function getPatientStats(
  timezone: string = "UTC"
): Promise<PatientStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const { data: executions } = await supabase
    .from("session_executions")
    .select("completed_at, ease_score, pain_score")
    .eq("patient_id", user.id)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: true });

  const completed = executions ?? [];
  const dates = completed.map((c) => toLocalDate(c.completed_at!, timezone));
  const streak = calculateStreak(dates, timezone);

  const recentCompletions: PatientStats["recentCompletions"] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86_400_000).toLocaleDateString(
      "en-CA",
      { timeZone: timezone }
    );
    recentCompletions.push({
      date,
      completed: dates.includes(date),
    });
  }

  const painScores = completed
    .filter((c) => c.pain_score !== null)
    .map((c) => ({
      date: toLocalDate(c.completed_at!, timezone),
      score: c.pain_score as number,
    }));

  const easeScores = completed
    .filter((c) => c.ease_score !== null)
    .map((c) => ({
      date: toLocalDate(c.completed_at!, timezone),
      score: c.ease_score as number,
    }));

  return {
    streak,
    totalCompleted: completed.length,
    recentCompletions,
    painScores,
    easeScores,
  };
}
