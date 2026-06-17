"use server";

import { randomBytes } from "crypto";
import { requireRole } from "@/lib/actions/auth";

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
