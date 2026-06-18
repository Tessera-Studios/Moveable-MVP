"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ClientMessage } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { getMessages } from "@/lib/actions/messages";

interface MessageListProps {
  messages: ClientMessage[];
  currentUserId: string;
  otherUserId: string;
  onRetry: (message: ClientMessage) => void;
  onPrepend: (messages: ClientMessage[]) => void;
}

export function MessageList({
  messages,
  currentUserId,
  otherUserId,
  onRetry,
  onPrepend,
}: MessageListProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Auto-scroll to bottom whenever a new message arrives
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom on mount
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  async function loadOlder(): Promise<void> {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);

    const oldest = messages[0].created_at;
    const el = containerRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;

    const result = await getMessages(otherUserId, oldest);
    if (!("error" in result)) {
      if (result.length < 30) setHasMore(false);
      const older = result.map((m) => ({ ...m, _status: "sent" as const }));
      onPrepend(older);
      // Restore scroll position so viewport doesn't jump
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        }
      });
    }

    setLoadingMore(false);
  }

  function handleScroll(): void {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop === 0 && hasMore && !loadingMore) {
      void loadOlder();
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-placeholder text-sm px-6 text-center">
        No messages yet. Say hello!
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4 flex flex-col"
    >
      {loadingMore && (
        <div className="text-center text-placeholder text-xs py-2">
          Loading…
        </div>
      )}
      {!hasMore && messages.length >= 30 && (
        <div className="text-center text-placeholder text-xs py-2">
          Beginning of conversation
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isSent={msg.sender_id === currentUserId}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
