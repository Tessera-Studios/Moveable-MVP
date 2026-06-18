"use client";

import React, { useState, useTransition } from "react";
import { Modal } from "@/components/ui";

type Props = {
  action: () => Promise<{ error: string } | never>;
  confirmationMessage: string;
};

export default function DeleteAccountButton({
  action,
  confirmationMessage,
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(): void {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <>
      {error && (
        <p className="text-sm text-red-500 text-center mb-2">{error}</p>
      )}
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="w-full h-12 rounded-button bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
      >
        Delete Account
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete Account" size="sm">
        <p className="text-sm text-foreground mb-6">{confirmationMessage}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 h-12 rounded-button border border-border text-foreground font-medium hover:bg-background transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 h-12 rounded-button bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
