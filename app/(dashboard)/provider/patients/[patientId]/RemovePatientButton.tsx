"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ui";
import { removePatient } from "@/lib/actions/patients";

export function RemovePatientButton({
  patientId,
}: {
  patientId: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRemove(): Promise<void> {
    setLoading(true);
    setError(null);
    const result = await removePatient(patientId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setOpen(false);
      router.push("/provider/patients");
    }
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Remove patient
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Remove patient"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            This will unlink the patient from your practice. They will no
            longer appear in your roster. This action cannot be undone.
          </p>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={loading}
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
