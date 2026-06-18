import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/actions/messages";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { Message, Profile } from "@/lib/types";

export default async function PatientChatPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, provider_id, created_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile?.provider_id) {
    redirect("/patient");
  }

  const [{ data: provider }, result] = await Promise.all([
    supabase
      .from("users")
      .select("id, email")
      .eq("id", profile.provider_id)
      .single<{ id: string; email: string }>(),
    getMessages(profile.provider_id),
  ]);

  const initialMessages: Message[] = "error" in result ? [] : result;

  return (
    <ChatWindow
      initialMessages={initialMessages}
      currentUserId={user.id}
      otherUser={{
        id: profile.provider_id,
        name: provider?.email ?? profile.provider_id,
      }}
    />
  );
}
