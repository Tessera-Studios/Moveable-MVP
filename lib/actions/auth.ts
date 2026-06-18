"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type RequireRoleSuccess = { supabase: SupabaseClient; userId: string };
type RequireRoleResult = RequireRoleSuccess | { error: string };

/**
 * Asserts the caller is authenticated and holds the given role.
 * Returns the Supabase client and userId on success, or { error } to return early.
 */
export async function requireRole(
  role: UserRole
): Promise<RequireRoleResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<{ role: UserRole }>();

  if (profileError || profile?.role !== role) {
    return { error: `Only ${role}s can perform this action.` };
  }

  return { supabase, userId: user.id };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

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

  const adminSupabase = createAdminClient();
  const { error: insertError } = await adminSupabase.from("users").insert({
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

  // Use admin client to bypass RLS — the user is unauthenticated at this point
  const adminSupabase = createAdminClient();
  const { data: invite, error: lookupError } = await adminSupabase
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

  const { error: insertError } = await adminSupabase.from("users").insert({
    id: data.user.id,
    role: "patient",
    provider_id: invite.provider_id,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  // Mark code as consumed
  await adminSupabase
    .from("invitation_codes")
    .update({ is_consumed: true })
    .eq("code", code.trim().toUpperCase());

  redirect("/patient");
}
