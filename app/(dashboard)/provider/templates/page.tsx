import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui";
import Link from "next/link";

interface TemplateRow {
  id: string;
  name: string;
  patient_id: string;
  created_at: string;
  exercises: { id: string }[];
  users: { email: string | null } | null;
}

export default async function TemplatesPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: templates } = await supabase
    .from("sessions_template")
    .select(
      "id, name, patient_id, created_at, exercises(id), users!patient_id(email)"
    )
    .eq("provider_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (templates ?? []) as unknown as TemplateRow[];

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Templates</h1>
        <Link
          href="/provider/sessions/new"
          className="text-sm text-primary font-medium"
        >
          + New
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No session templates yet"
          description="Create a session template to assign exercises to a patient."
          action={
            <Link
              href="/provider/sessions/new"
              className="inline-flex items-center justify-center h-10 px-5 rounded-button bg-primary text-white text-sm font-medium"
            >
              Create template
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((t) => (
            <div
              key={t.id}
              className="bg-card rounded-card shadow-card p-4 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{t.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {t.users?.email ?? "Unassigned"} ·{" "}
                  {t.exercises.length} exercise
                  {t.exercises.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Link
                href={`/provider/sessions/${t.id}/edit`}
                className="text-sm text-primary font-medium shrink-0"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
