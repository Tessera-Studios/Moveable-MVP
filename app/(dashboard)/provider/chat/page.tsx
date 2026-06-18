import React from "react";
import { getConversations } from "@/lib/actions/messages";
import { ChatList } from "@/components/chat/ChatList";
import type { ConversationRow } from "@/lib/types";

export default async function ProviderChatPage(): Promise<React.JSX.Element> {
  const result = await getConversations();
  const conversations: ConversationRow[] =
    "error" in result ? [] : result;

  return (
    <div className="pt-4">
      <h1 className="px-4 text-lg font-semibold mb-3">Messages</h1>
      <ChatList conversations={conversations} />
    </div>
  );
}
