import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/actions/messages";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { Message } from "@/lib/types";

export default async function ProviderPatientChatPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<React.JSX.Element> {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: patient } = await supabase
    .from("users")
    .select("id, email, provider_id")
    .eq("id", patientId)
    .single<{ id: string; email: string; provider_id: string | null }>();

  if (!patient || patient.provider_id !== user.id) notFound();

  const result = await getMessages(patientId);
  const initialMessages: Message[] = "error" in result ? [] : result;

  return (
    <ChatWindow
      initialMessages={initialMessages}
      currentUserId={user.id}
      otherUser={{ id: patient.id, name: patient.email }}
    />
  );
}
