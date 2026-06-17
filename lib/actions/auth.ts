"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function registerProvider(
  email: string,
  password: string
): Promise<{ error: string } | never> {
  const supabase = await createClient();

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  if (!data.user) {
    return { error: "Sign-up succeeded but no user was returned." };
  }

  const { error: insertError } = await supabase.from("users").insert({
    id: data.user.id,
    role: "provider",
    provider_id: null,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  redirect("/provider");
}

export async function registerPatient(
  email: string,
  password: string,
  code: string
): Promise<{ error: string } | never> {
  const supabase = await createClient();

  // Validate the invitation code before creating the auth user
  const { data: invite, error: lookupError } = await supabase
    .from("invitation_codes")
    .select("provider_id, is_consumed, expires_at")
    .eq("code", code.trim().toUpperCase())
    .single();

  if (lookupError || !invite) {
    return { error: "Invalid invitation code." };
  }

  if (invite.is_consumed) {
    return { error: "This invitation code has already been used." };
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { error: "This invitation code has expired." };
  }

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  if (!data.user) {
    return { error: "Sign-up succeeded but no user was returned." };
  }

  const { error: insertError } = await supabase.from("users").insert({
    id: data.user.id,
    role: "patient",
    provider_id: invite.provider_id,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  // Mark code as consumed
  await supabase
    .from("invitation_codes")
    .update({ is_consumed: true })
    .eq("code", code.trim().toUpperCase());

  redirect("/patient");
}
