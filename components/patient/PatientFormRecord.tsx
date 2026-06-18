"use client";

import React, { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { RecordVideo } from "@/components/shared/RecordVideo";
import { getUploadUrl, saveVideoMetadata } from "@/lib/actions/videos";

type RecordState = "idle" | "uploading" | "done" | "error";

interface PatientFormRecordProps {
  exerciseId: string;
}

export function PatientFormRecord({
  exerciseId,
}: PatientFormRecordProps): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleRecordingComplete(blob: Blob, _duration: number): Promise<void> {
    setRecordState("uploading");
    setErrorMessage("");

    const uploadUrlResult = await getUploadUrl(exerciseId);
    if ("error" in uploadUrlResult) {
      setRecordState("error");
      setErrorMessage(uploadUrlResult.error);
      return;
    }

    const { url, storagePath } = uploadUrlResult;

    const uploadResponse = await fetch(url, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": blob.type || "video/mp4" },
    });

    if (!uploadResponse.ok) {
      setRecordState("error");
      setErrorMessage(`Upload failed (${uploadResponse.status}). Please try again.`);
      return;
    }

    const metaResult = await saveVideoMetadata(storagePath, exerciseId);
    if ("error" in metaResult) {
      setRecordState("error");
      setErrorMessage(metaResult.error);
      return;
    }

    setRecordState("done");
  }

  function handleClose(): void {
    setModalOpen(false);
    setRecordState("idle");
    setErrorMessage("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 text-sm text-muted font-medium mt-3"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        Record my form
      </button>

      <Modal
        open={modalOpen}
        onClose={handleClose}
        title="Record your form"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {recordState === "uploading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted">Uploading video…</p>
            </div>
          )}

          {recordState === "done" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">Video saved!</p>
              <p className="text-sm text-muted">Your provider will be able to review your form.</p>
              <Button variant="primary" onClick={handleClose}>Done</Button>
            </div>
          )}

          {(recordState === "idle" || recordState === "error") && (
            <>
              <RecordVideo onRecordingComplete={handleRecordingComplete} />
              {recordState === "error" && (
                <p className="text-sm text-error bg-red-50 rounded-sm px-3 py-2">
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
