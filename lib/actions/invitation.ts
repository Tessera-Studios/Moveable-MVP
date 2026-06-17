"use server";

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

function generateCode(): string {
  // 9 random bytes → 12-char base64url string, uppercased
  return randomBytes(9).toString("base64url").slice(0, 12).toUpperCase();
}

export type GenerateCodeResult =
  | { code: string; error?: never }
  | { code?: never; error: string };

export async function generateInvitationCode(): Promise<GenerateCodeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (profileError || profile?.role !== "provider") {
    return { error: "Only providers can generate invitation codes." };
  }

  const code = generateCode();

  const { error: insertError } = await supabase.from("invitation_codes").insert({
    code,
    provider_id: user.id,
    is_consumed: false,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  return { code };
}
