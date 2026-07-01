"use server";

import { requireRole } from "@/lib/actions/auth";

export interface ExerciseInput {
  name: string;
  sets: number;
  reps: number;
  patient_notes?: string | null;
  sort_order: number;
}

/** Rejects NaN, non-integers, and values below 1. */
function isValidCount(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

export async function addExercise(
  sessionTemplateId: string,
  data: ExerciseInput
): Promise<{ id: string } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  if (!data.name.trim()) return { error: "Exercise name is required." };
  if (!isValidCount(data.sets)) return { error: "Sets must be a whole number of at least 1." };
  if (!isValidCount(data.reps)) return { error: "Reps must be a whole number of at least 1." };

  const { data: row, error } = await auth.supabase
    .from("exercises")
    .insert({
      session_template_id: sessionTemplateId,
      name: data.name.trim(),
      sets: data.sets,
      reps: data.reps,
      patient_notes: data.patient_notes ?? null,
      sort_order: data.sort_order,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };
  return { id: row.id };
}

export async function updateExercise(
  id: string,
  data: ExerciseInput
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  if (!data.name.trim()) return { error: "Exercise name is required." };
  if (!isValidCount(data.sets)) return { error: "Sets must be a whole number of at least 1." };
  if (!isValidCount(data.reps)) return { error: "Reps must be a whole number of at least 1." };

  const { error } = await auth.supabase
    .from("exercises")
    .update({
      name: data.name.trim(),
      sets: data.sets,
      reps: data.reps,
      patient_notes: data.patient_notes ?? null,
      sort_order: data.sort_order,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteExercise(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("exercises")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function reorderExercises(
  items: { id: string; sort_order: number }[]
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const updates = items.map(({ id, sort_order }) =>
    auth.supabase.from("exercises").update({ sort_order }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  return { ok: true };
}
