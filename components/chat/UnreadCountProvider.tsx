"use client";

import React, { createContext, useContext, useState } from "react";

interface UnreadCountContextValue {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

const UnreadCountContext = createContext<UnreadCountContextValue | null>(null);

export function UnreadCountProvider({
  children,
  initialCount,
}: {
  children: React.ReactNode;
  initialCount: number;
}): React.JSX.Element {
  const [unreadCount, setUnreadCount] = useState(initialCount);
  return (
    <UnreadCountContext.Provider value={{ unreadCount, setUnreadCount }}>
      {children}
    </UnreadCountContext.Provider>
  );
}

export function useUnreadCount(): UnreadCountContextValue {
  const ctx = useContext(UnreadCountContext);
  if (!ctx)
    throw new Error("useUnreadCount must be used within UnreadCountProvider");
  return ctx;
}
