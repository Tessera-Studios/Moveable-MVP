"use client";

import React from "react";
import { useUnreadCount } from "./UnreadCountProvider";

export function UnreadBadge(): React.JSX.Element | null {
  const { unreadCount } = useUnreadCount();
  if (unreadCount === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-error text-white text-[9px] font-bold leading-none">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );
}
