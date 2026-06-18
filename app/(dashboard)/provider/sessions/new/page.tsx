import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SessionForm } from "../SessionForm";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ patientId?: string }>;
}

export default async function NewSessionPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { patientId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: patientsRaw } = await supabase
    .from("users")
    .select("id, email")
    .eq("provider_id", user.id)
    .eq("role", "patient");

  const patients = (patientsRaw ?? []) as { id: string; email: string | null }[];

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <Link href="/provider/templates" className="text-sm text-primary">
        ← Templates
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">New session</h1>
      <SessionForm
        mode="create"
        patients={patients}
        initialData={
          patientId
            ? {
                name: "",
                patient_id: patientId,
                provider_notes: "",
                exercises: [],
              }
            : undefined
        }
      />
    </div>
  );
}
