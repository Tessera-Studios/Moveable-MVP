"use client";

import React from "react";
import Link from "next/link";
import type { ConversationRow } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ChatList({
  conversations,
}: {
  conversations: ConversationRow[];
}): React.JSX.Element {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-placeholder text-sm text-center px-6">
        <p>No conversations yet.</p>
        <p className="mt-1">Your patients can message you from their app.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {conversations.map((conv) => (
        <li key={conv.otherUserId}>
          <Link
            href={`/provider/chat/${conv.otherUserId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-card/60 transition-colors"
          >
            <Avatar name={conv.otherUserName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-sm truncate ${
                    conv.unreadCount > 0
                      ? "font-semibold text-foreground"
                      : "font-medium text-foreground"
                  }`}
                >
                  {conv.otherUserName}
                </span>
                <span className="text-[10px] text-placeholder flex-shrink-0">
                  {formatRelativeTime(conv.lastMessageAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-xs text-placeholder truncate">
                  {conv.lastMessage.slice(0, 60)}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-error text-white text-[10px] font-bold">
                    {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
