"use client";

import React, { useState, useTransition } from "react";
import { generateInvitationCode } from "@/lib/actions/invitation";

export default function InvitationCodeWidget(): React.JSX.Element {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGenerate(): void {
    setError(null);
    setCode(null);
    setCopied(false);
    startTransition(async () => {
      const result = await generateInvitationCode();
      if (result.error) {
        setError(result.error);
      } else {
        setCode(result.code ?? null);
      }
    });
  }

  async function handleCopy(): Promise<void> {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-card rounded-card shadow-card p-5 flex flex-col gap-3">
      <div>
        <span className="text-lg font-semibold text-foreground">
          Invite a patient
        </span>
        <p className="text-sm text-muted mt-0.5">
          Generate a one-time code and share it with your patient.
        </p>
      </div>

      {code && (
        <div className="flex items-center gap-3 bg-background rounded-card px-4 py-3">
          <span className="font-mono text-lg font-semibold text-foreground tracking-widest flex-1">
            {code}
          </span>
          <button
            onClick={handleCopy}
            className="text-sm text-primary font-medium shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="w-full h-11 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Generating…" : code ? "Generate new code" : "Generate invitation code"}
      </button>
    </div>
  );
}
