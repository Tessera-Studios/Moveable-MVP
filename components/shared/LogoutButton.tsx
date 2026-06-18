"use client";

import React, { useTransition } from "react";
import { signOut } from "@/lib/actions/auth";

export default function LogoutButton(): React.JSX.Element {
  const [isPending, startTransition] = useTransition();

  function handleLogout(): void {
    startTransition(async () => {
      await signOut();
    });
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="w-full h-12 rounded-button border border-border bg-card text-foreground font-medium hover:bg-background transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
