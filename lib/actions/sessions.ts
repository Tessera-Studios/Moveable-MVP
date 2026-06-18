"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/auth";

export interface SessionTemplateInput {
  patient_id: string;
  name: string;
  provider_notes?: string | null;
}

export async function createSessionTemplate(
  data: SessionTemplateInput
): Promise<{ id: string } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  if (!data.name.trim()) return { error: "Session name is required." };
  if (!data.patient_id) return { error: "Patient is required." };

  const { data: row, error } = await auth.supabase
    .from("sessions_template")
    .insert({
      provider_id: auth.userId,
      patient_id: data.patient_id,
      name: data.name.trim(),
      provider_notes: data.provider_notes ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { error: error.message };

  revalidatePath("/provider");
  revalidatePath("/provider/templates");
  return { id: row.id };
}

export async function updateSessionTemplate(
  id: string,
  data: SessionTemplateInput
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  if (!data.name.trim()) return { error: "Session name is required." };

  const { error } = await auth.supabase
    .from("sessions_template")
    .update({
      name: data.name.trim(),
      provider_notes: data.provider_notes ?? null,
    })
    .eq("id", id)
    .eq("provider_id", auth.userId);

  if (error) return { error: error.message };

  revalidatePath("/provider/templates");
  revalidatePath(`/provider/sessions/${id}/edit`);
  return { ok: true };
}

export async function deleteSessionTemplate(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("sessions_template")
    .delete()
    .eq("id", id)
    .eq("provider_id", auth.userId);

  if (error) return { error: error.message };

  revalidatePath("/provider/templates");
  return { ok: true };
}
