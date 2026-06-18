"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function generateCode(): string {
  // 9 random bytes → 12-char base64url string, uppercased
  return randomBytes(9).toString("base64url").slice(0, 12).toUpperCase();
}

export type GenerateCodeResult =
  | { code: string; error?: never }
  | { code?: never; error: string };

export async function generateInvitationCode(): Promise<GenerateCodeResult> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const code = generateCode();

  const { error: insertError } = await auth.supabase
    .from("invitation_codes")
    .insert({ code, provider_id: auth.userId, is_consumed: false });

  if (insertError) return { error: insertError.message };

  return { code };
}

export async function claimInvitationCode(
  code: string
): Promise<{ error: string } | void> {
  const auth = await requireRole("patient");
  if ("error" in auth) return auth;

  const adminSupabase = createAdminClient();

  const { data: patient } = await adminSupabase
    .from("users")
    .select("provider_id")
    .eq("id", auth.userId)
    .single<{ provider_id: string | null }>();

  if (patient?.provider_id) {
    return { error: "You are already linked to a provider." };
  }

  const { data: invite, error: lookupError } = await adminSupabase
    .from("invitation_codes")
    .select("provider_id, is_consumed, expires_at")
    .eq("code", code.trim().toUpperCase())
    .single();

  if (lookupError || !invite) return { error: "Invalid invitation code." };
  if (invite.is_consumed) return { error: "This invitation code has already been used." };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { error: "This invitation code has expired." };
  }

  const { error: updateError } = await adminSupabase
    .from("users")
    .update({ provider_id: invite.provider_id })
    .eq("id", auth.userId);

  if (updateError) return { error: updateError.message };

  await adminSupabase
    .from("invitation_codes")
    .update({ is_consumed: true })
    .eq("code", code.trim().toUpperCase());

  revalidatePath("/patient/profile");
}
