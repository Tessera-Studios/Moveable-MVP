"use server";

import { createClient } from "@/lib/supabase/server";
import type { PatientStats } from "@/lib/types";

function toLocalDate(utcDate: string, timezone: string): string {
  return new Date(utcDate).toLocaleDateString("en-CA", { timeZone: timezone });
}

function calculateStreak(
  completedDates: string[],
  timezone: string
): number {
  if (completedDates.length === 0) return 0;

  const dateSet = new Set(completedDates);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: timezone }
  );

  // Streak must include today or yesterday to be active
  const startDate = dateSet.has(today)
    ? today
    : dateSet.has(yesterday)
      ? yesterday
      : null;

  if (!startDate) return 0;

  let streak = 0;
  const cursor = new Date(startDate + "T12:00:00");

  while (true) {
    const ds = cursor.toLocaleDateString("en-CA", { timeZone: timezone });
    if (!dateSet.has(ds)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

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

  const { error } = await supabase.from("session_executions").insert({
    session_template_id: sessionTemplateId,
    patient_id: user.id,
    status: "completed",
    ease_score: easeScore,
    pain_score: painScore,
    completed_at: new Date().toISOString(),
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

  return {
    streak: calculateStreak(dates, timezone),
    totalCompleted: dates.length,
  };
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
