import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FeedbackForm from "@/components/patient/FeedbackForm";
import type { SessionTemplate } from "@/lib/types";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function FeedbackPage({
  params,
}: Props): Promise<React.JSX.Element> {
  const { sessionId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessionData } = await supabase
    .from("sessions_template")
    .select("id, provider_id, patient_id, name, provider_notes, created_at")
    .eq("id", sessionId)
    .eq("patient_id", user.id)
    .single<SessionTemplate>();

  if (!sessionData) notFound();

  return (
    <FeedbackForm
      sessionTemplateId={sessionId}
      sessionName={sessionData.name}
    />
  );
}
