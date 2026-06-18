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
  // Ref-based guard prevents double-fetch on rapid scroll-to-top (I2)
  const loadingMoreRef = useRef(false);
  const [showLoadingBanner, setShowLoadingBanner] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Track whether the last length change was a prepend, to suppress auto-scroll (M5)
  const isPrependRef = useRef(false);

  // Auto-scroll to bottom whenever a new message arrives (but not on prepend)
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLengthRef.current && !isPrependRef.current) {
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
    // Synchronous ref check prevents race from rapid scroll events (I2)
    if (loadingMoreRef.current || !hasMore || messages.length === 0) return;
    loadingMoreRef.current = true;
    setShowLoadingBanner(true);

    const oldest = messages[0].created_at;
    const el = containerRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;

    const result = await getMessages(otherUserId, oldest);
    if (!("error" in result)) {
      if (result.length < 30) setHasMore(false);
      const older = result.map((m) => ({ ...m, _status: "sent" as const }));
      // Signal that the upcoming length increase is a prepend, not a new message (M5)
      isPrependRef.current = true;
      onPrepend(older);
      // Restore scroll position so viewport doesn't jump; reset isPrependRef after rAF (M5)
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        }
        isPrependRef.current = false;
      });
    }

    loadingMoreRef.current = false;
    setShowLoadingBanner(false);
  }

  function handleScroll(): void {
    const el = containerRef.current;
    if (!el) return;
    // Use <= 1 instead of === 0 to handle fractional scrollTop on high-DPI displays (M6)
    if (el.scrollTop <= 1 && hasMore && !loadingMoreRef.current) {
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
      {showLoadingBanner && (
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
