"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deletePatientAccount(): Promise<{ error: string } | never> {
  const auth = await requireRole("patient");
  if ("error" in auth) return auth;

  const adminSupabase = createAdminClient();

  // Delete the auth account FIRST — this is the gate. If it fails we abort
  // before touching any data, so the account is never left half-deleted with
  // a working login. public.users row stays (no CASCADE after migration).
  const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(
    auth.userId
  );
  if (deleteError) return { error: deleteError.message };

  // Best-effort post-gate cleanup. The auth account is already gone and the
  // user is being redirected with no way to retry, so failures here only leave
  // orphaned storage objects — an accepted gap. Do NOT return errors or block
  // the redirect past this point.
  const { data: videos } = await adminSupabase
    .from("videos")
    .select("storage_path")
    .eq("uploader_id", auth.userId);

  if (videos && videos.length > 0) {
    const paths = videos.map((v) => v.storage_path);
    await adminSupabase.storage.from("exercise-videos").remove(paths);
    await adminSupabase.from("videos").delete().eq("uploader_id", auth.userId);
  }

  await adminSupabase
    .from("users")
    .update({ provider_id: null })
    .eq("id", auth.userId);

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
