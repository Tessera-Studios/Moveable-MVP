"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface MessageInputProps {
  channelRef: React.RefObject<RealtimeChannel | null>;
  currentUserId: string;
  onSend: (content: string) => void;
  isSending: boolean;
}

export function MessageInput({
  channelRef,
  currentUserId,
  onSend,
  isSending,
}: MessageInputProps): React.JSX.Element {
  const [content, setContent] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const broadcastTyping = useCallback(() => {
    if (!channelRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: currentUserId },
      });
    }, 300);
  }, [channelRef, currentUserId]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setContent(e.target.value);
    broadcastTyping();
  }

  function submit(): void {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setContent("");
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 border-t border-border p-3 bg-background"
    >
      <textarea
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Message…"
        rows={1}
        className="flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-32"
      />
      <button
        type="submit"
        disabled={!content.trim() || isSending}
        className="flex-shrink-0 rounded-full bg-primary text-white w-9 h-9 flex items-center justify-center disabled:opacity-40 transition-opacity"
        aria-label="Send"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
}
