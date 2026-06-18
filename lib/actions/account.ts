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
    const paths = videos.map((v: { storage_path: string }) => v.storage_path);
    await adminSupabase.storage.from("exercise-videos").remove(paths);
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
