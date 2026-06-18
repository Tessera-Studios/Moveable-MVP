"use client";

import React, { useState, useTransition } from "react";
import { claimInvitationCode } from "@/lib/actions/invitation";

const inputClass =
  "w-full h-12 rounded-card border border-border px-4 bg-card text-foreground placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary";

export default function ConnectProviderWidget(): React.JSX.Element {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await claimInvitationCode(code);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="bg-card rounded-card shadow-card p-5">
      <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-3">
        Connect with your provider
      </p>
      <p className="text-sm text-placeholder mb-4">
        Enter the invitation code from your physical therapist to link your account.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXXXXXXXXXX"
          spellCheck={false}
          autoCapitalize="characters"
          className={inputClass}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={isPending || code.trim().length === 0}
          className="w-full h-12 rounded-button bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
