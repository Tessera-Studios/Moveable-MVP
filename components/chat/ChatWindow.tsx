"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markMessagesRead } from "@/lib/actions/messages";
import { useUnreadCount } from "./UnreadCountProvider";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { PresenceDot } from "./PresenceDot";
import type { Message, ClientMessage } from "@/lib/types";

interface ChatWindowProps {
  initialMessages: Message[];
  currentUserId: string;
  otherUser: { id: string; name: string };
}

export function ChatWindow({
  initialMessages,
  currentUserId,
  otherUser,
}: ChatWindowProps): React.JSX.Element {
  const [messages, setMessages] = useState<ClientMessage[]>(
    initialMessages.map((m) => ({ ...m, _status: "sent" as const }))
  );
  const [isOnline, setIsOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [channelStatus, setChannelStatus] = useState<string>("CONNECTING");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { setUnreadCount } = useUnreadCount();

  // Mark conversation as read on open
  useEffect(() => {
    void markMessagesRead(otherUser.id);
    setUnreadCount(0);
  }, [otherUser.id, setUnreadCount]);

  // Set up Realtime channel
  useEffect(() => {
    const supabase = createClient();
    const channelId = `chat:${[currentUserId, otherUser.id].sort().join("-")}`;

    const channel = supabase
      .channel(channelId, { config: { broadcast: { ack: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          // Filter to only messages in this conversation
          const inConversation =
            (msg.sender_id === currentUserId && msg.receiver_id === otherUser.id) ||
            (msg.sender_id === otherUser.id && msg.receiver_id === currentUserId);
          if (!inConversation) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, { ...msg, _status: "sent" }];
          });

          if (msg.receiver_id === currentUserId) {
            void markMessagesRead(otherUser.id);
          }
        }
      )
      .on("broadcast", { event: "typing" }, () => {
        setIsTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTyping(false), 2000);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        const others = Object.values(state)
          .flat()
          .filter((p) => p.user_id !== currentUserId);
        setIsOnline(others.length > 0);
      })
      .subscribe(async (status) => {
        setChannelStatus(status);
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUser.id]);

  const handleSend = useCallback(
    async (content: string): Promise<void> => {
      const tempId = `optimistic-${Date.now()}`;
      const optimistic: ClientMessage = {
        id: tempId,
        sender_id: currentUserId,
        receiver_id: otherUser.id,
        content,
        media_url: null,
        is_read: false,
        created_at: new Date().toISOString(),
        _optimistic: true,
        _status: "sending",
      };

      setMessages((prev) => [...prev, optimistic]);
      setIsSending(true);

      const result = await sendMessage(otherUser.id, content);
      setIsSending(false);

      if ("error" in result) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, _status: "failed" } : m
          )
        );
      } else {
        // Replace optimistic with confirmed message; Postgres Changes may also
        // fire — the duplicate guard in the handler prevents double-append.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...result, _status: "sent" } : m
          )
        );
      }
    },
    [currentUserId, otherUser.id]
  );

  function handleRetry(message: ClientMessage): void {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    void handleSend(message.content);
  }

  function handlePrepend(older: ClientMessage[]): void {
    setMessages((prev) => [...older, ...prev]);
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <PresenceDot online={isOnline} />
        <span className="font-medium text-sm truncate">{otherUser.name}</span>
      </div>

      {/* Reconnecting banner — shown after initial connect attempt fails */}
      {channelStatus !== "SUBSCRIBED" && channelStatus !== "CONNECTING" && (
        <div className="flex-shrink-0 bg-amber-50 text-amber-700 text-xs text-center py-1 border-b border-amber-200">
          Reconnecting…
        </div>
      )}

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        otherUserId={otherUser.id}
        onRetry={handleRetry}
        onPrepend={handlePrepend}
      />

      {isTyping && <TypingIndicator name={otherUser.name} />}

      <MessageInput
        channelRef={channelRef}
        currentUserId={currentUserId}
        onSend={(content) => void handleSend(content)}
        isSending={isSending}
      />
    </div>
  );
}
