"use client";

import React from "react";
import type { ClientMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ClientMessage;
  isSent: boolean;
  onRetry?: (message: ClientMessage) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  message,
  isSent,
  onRetry,
}: MessageBubbleProps): React.JSX.Element {
  return (
    <div
      className={`flex flex-col mb-2 ${isSent ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isSent
            ? "bg-primary text-white rounded-br-sm"
            : "bg-card text-foreground rounded-bl-sm"
        }`}
      >
        {message.content}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-placeholder">
        <span>{formatTime(message.created_at)}</span>
        {isSent && message._status === "sending" && <span>Sending…</span>}
        {isSent && message._status === "failed" && (
          <>
            <span className="text-error">Failed</span>
            {onRetry && (
              <button
                onClick={() => onRetry(message)}
                className="text-primary underline"
                type="button"
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
