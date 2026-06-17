"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/auth";

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
