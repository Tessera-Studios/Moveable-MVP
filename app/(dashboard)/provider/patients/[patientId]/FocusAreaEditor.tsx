"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui";
import { updatePatientFocusArea } from "@/lib/actions/patients";

const DEFAULT_OPTIONS = ["Shoulder", "Back", "Legs", "Core", "Arms", "Other"];

interface Props {
  patientId: string;
  currentFocusArea: string | null;
}

export function FocusAreaEditor({ patientId, currentFocusArea }: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentFocusArea ?? "");
  const [displayed, setDisplayed] = useState(currentFocusArea);
  const { toast } = useToast();

  async function handleSave(): Promise<void> {
    const result = await updatePatientFocusArea(patientId, value);
    if ("error" in result) {
      toast({ message: result.error, type: "error" });
      return;
    }
    setDisplayed(value || null);
    setEditing(false);
  }

  function handleCancel(): void {
    setValue(displayed ?? "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        {displayed ? (
          <>
            <span className="text-sm text-foreground">{displayed}</span>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary font-medium shrink-0"
            >
              Edit
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted">Not set</span>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary font-medium shrink-0"
            >
              Set focus area
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          list="focus-area-options"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Shoulder, Back..."
          className="flex-1 border border-border rounded-input px-3 py-2 text-sm text-foreground bg-card outline-none focus:ring-2 focus:ring-primary/30"
        />
        <datalist id="focus-area-options">
          {DEFAULT_OPTIONS.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white"
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
