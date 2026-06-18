"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deletePatientAccount(): Promise<{ error: string } | never> {
  const auth = await requireRole("patient");
  if ("error" in auth) return auth;

  const adminSupabase = createAdminClient();

  // Delete form-check videos from storage and DB
  const { data: videos } = await adminSupabase
    .from("videos")
    .select("storage_path")
    .eq("uploader_id", auth.userId);

  if (videos && videos.length > 0) {
    const paths = videos.map((v) => v.storage_path);
    const { error: storageError } = await adminSupabase.storage.from("exercise-videos").remove(paths);
    if (storageError) return { error: storageError.message };
    await adminSupabase.from("videos").delete().eq("uploader_id", auth.userId);
  }

  // Unlink from provider so they no longer appear in the provider's roster
  await adminSupabase
    .from("users")
    .update({ provider_id: null })
    .eq("id", auth.userId);

  // Delete auth account — public.users row stays (no CASCADE after migration)
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(
    auth.userId
  );
  if (deleteError) return { error: deleteError.message };

  redirect("/login");
}

export async function deleteProviderAccount(): Promise<{ error: string } | never> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const adminSupabase = createAdminClient();

  // Block deletion if any patients are still linked
  const { count } = await adminSupabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("provider_id", auth.userId);

  if (count && count > 0) {
    return { error: "Remove all your patients before deleting your account." };
  }

  // Delete auth account — all other data is preserved
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(
    auth.userId
  );
  if (deleteError) return { error: deleteError.message };

  redirect("/login");
}
