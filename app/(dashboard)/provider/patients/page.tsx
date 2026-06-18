import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PatientRosterCard } from "../PatientRosterCard";
import { EmptyState } from "@/components/ui";
import Link from "next/link";

export default async function PatientsPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: patientsRaw } = await supabase
    .from("users")
    .select("id, email, created_at")
    .eq("provider_id", user.id)
    .eq("role", "patient")
    .order("created_at", { ascending: false });

  const patients = (patientsRaw ?? []) as {
    id: string;
    email: string | null;
    created_at: string;
  }[];

  const patientsWithStats = patients.map((p) => ({
    ...p,
    streak: 0,
    last_active: null,
    compliance_rate: 0,
  }));

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Patients</h1>
        <Link
          href="/provider/sessions/new"
          className="text-sm text-primary font-medium"
        >
          + New Session
        </Link>
      </div>

      {patients.length === 0 ? (
        <EmptyState
          title="No patients yet"
          description="Generate an invitation code and share it with your patients to get started."
        />
      ) : (
        <PatientRosterCard patients={patientsWithStats} />
      )}
    </div>
  );
}
