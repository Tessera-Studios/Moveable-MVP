import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/shared/LogoutButton";
import DeleteAccountButton from "@/components/shared/DeleteAccountButton";
import { deleteProviderAccount } from "@/lib/actions/account";

export default async function ProviderProfilePage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, created_at")
    .eq("id", user.id)
    .single();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  const nameFromEmail = user.email?.split("@")[0] ?? "Provider";

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-6 min-h-[calc(100vh-80px)]">
      <div className="bg-card rounded-card shadow-card p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center shrink-0">
            <span className="text-primary text-2xl font-bold uppercase">
              {nameFromEmail.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {nameFromEmail}
            </h1>
            <p className="text-sm text-placeholder">{user.email}</p>
            {memberSince && (
              <p className="text-xs text-placeholder mt-0.5">
                Member since {memberSince}
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-placeholder">Role</span>
            <span className="text-foreground font-medium capitalize">
              Provider
            </span>
          </div>
        </div>
      </div>

      <LogoutButton />

      <div className="mt-auto flex flex-col items-center gap-1.5 pt-6">
        <p className="text-xs text-placeholder text-center">
          You must remove all patients before deleting your account.
        </p>
        <DeleteAccountButton
          action={deleteProviderAccount}
          confirmationMessage="This will permanently delete your account. Your patients' session history will be kept. This cannot be undone."
        />
      </div>
    </div>
  );
}
