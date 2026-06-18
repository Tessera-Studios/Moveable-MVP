import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Exercise, SessionTemplate } from "@/lib/types";
import LogoutButton from "@/components/shared/LogoutButton";
import ConnectProviderWidget from "@/components/patient/ConnectProviderWidget";
import DeleteAccountButton from "@/components/shared/DeleteAccountButton";
import { deletePatientAccount } from "@/lib/actions/account";

export default async function PatientProfilePage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, sessionsResult] = await Promise.all([
    supabase
      .from("users")
      .select("id, role, provider_id, created_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("sessions_template")
      .select("id, name, provider_notes, patient_id, provider_id, created_at")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileResult.data;
  const sessions = (sessionsResult.data ?? []) as SessionTemplate[];

  const sessionIds = sessions.map((s) => s.id);
  let exercises: Exercise[] = [];
  if (sessionIds.length > 0) {
    const { data: exData } = await supabase
      .from("exercises")
      .select(
        "id, session_template_id, name, sets, reps, patient_notes, sort_order"
      )
      .in("session_template_id", sessionIds)
      .order("sort_order", { ascending: true });
    exercises = (exData ?? []) as Exercise[];
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  const nameFromEmail = user.email?.split("@")[0] ?? "Patient";
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? nameFromEmail;

  return (
    <div className="flex flex-col gap-4 px-5 pt-6 pb-6">
      {/* Profile header */}
      <div className="bg-card rounded-card shadow-card p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center shrink-0">
            <span className="text-primary text-2xl font-bold uppercase">
              {displayName.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {displayName}
            </h1>
            <p className="text-sm text-placeholder">{user.email}</p>
            {memberSince && (
              <p className="text-xs text-placeholder mt-0.5">
                Member since {memberSince}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-4 flex flex-col gap-2">
          {user.phone && (
            <div className="flex justify-between text-sm">
              <span className="text-placeholder">Phone</span>
              <span className="text-foreground font-medium">{user.phone}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-placeholder">Role</span>
            <span className="text-foreground font-medium capitalize">
              {profile?.role ?? "Patient"}
            </span>
          </div>
        </div>
      </div>

      {/* Provider notes */}
      {sessions.some((s) => s.provider_notes) && (
        <div className="bg-card rounded-card shadow-card p-5">
          <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-3">
            Notes from your therapist
          </p>
          {sessions
            .filter((s) => s.provider_notes)
            .map((s) => (
              <div key={s.id} className="mb-3 last:mb-0">
                <p className="text-xs text-placeholder mb-1 font-medium">
                  {s.name}
                </p>
                <p className="text-sm text-foreground">{s.provider_notes}</p>
              </div>
            ))}
        </div>
      )}

      {/* Exercise list */}
      <div className="bg-card rounded-card shadow-card p-5">
        <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-3">
          Your Exercises
        </p>

        {exercises.length === 0 ? (
          <p className="text-sm text-placeholder">No exercises assigned yet.</p>
        ) : (
          <div>
            {exercises.map((ex, i) => (
              <div
                key={ex.id}
                className={`flex items-center gap-3 py-3 ${
                  i < exercises.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-muted">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ex.name}
                  </p>
                  <p className="text-xs text-placeholder">
                    {ex.sets} sets · {ex.reps} reps
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Provider info */}
      {profile?.provider_id && (
        <div className="bg-card rounded-card shadow-card p-5">
          <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-2">
            Your Therapist
          </p>
          <p className="text-sm text-foreground font-medium">
            Physical Therapist
          </p>
          <p className="text-xs text-placeholder mt-0.5">
            Contact your therapist through the Messages tab.
          </p>
        </div>
      )}

      {/* Connect provider widget — only when unlinked */}
      {!profile?.provider_id && <ConnectProviderWidget />}

      <LogoutButton />

      {/* Danger zone */}
      <div className="bg-card rounded-card shadow-card p-5">
        <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-4">
          Danger Zone
        </p>
        <DeleteAccountButton
          action={deletePatientAccount}
          confirmationMessage="This will permanently delete your account and your recorded videos. Your session history will be kept. This cannot be undone."
        />
      </div>
    </div>
  );
}
