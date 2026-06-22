"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function removePatient(
  patientId: string
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("users")
    .update({ provider_id: null })
    .eq("id", patientId)
    .eq("provider_id", auth.userId);

  if (error) return { error: error.message };

  revalidatePath("/provider");
  revalidatePath("/provider/patients");
  return { ok: true };
}

export async function updatePatientFocusArea(
  patientId: string,
  focusArea: string
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  // Verify the patient belongs to this provider
  const { data: patient } = await auth.supabase
    .from("users")
    .select("id")
    .eq("id", patientId)
    .eq("provider_id", auth.userId)
    .single<{ id: string }>();

  if (!patient) return { error: "Patient not found or not assigned to you." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ focus_area: focusArea || null })
    .eq("id", patientId);

  if (error) return { error: error.message };
  return { ok: true };
}
