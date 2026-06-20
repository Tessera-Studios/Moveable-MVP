"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui";
import { RecordVideo } from "@/components/shared/RecordVideo";
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import { getUploadUrl } from "@/lib/actions/videos";

type CaptureState = "idle" | "uploading" | "error";

interface VideoCaptureFieldProps {
  /** Storage path of an already-captured video, if any. */
  storagePath: string | null;
  /**
   * Called with the storage path once a recording has been uploaded. The DB
   * `videos` row and `exercises.video_id` link are wired later, when the
   * exercise itself is persisted — so this works before the session exists.
   */
  onCaptured: (storagePath: string) => void;
  label?: string;
}

/**
 * Records + uploads an instructional video to Storage without touching the
 * database. Used for exercises that have not been persisted yet (new session
 * creation, or freshly added rows in edit mode). Persisted exercises use
 * {@link ExerciseVideoAttacher} instead, which writes to the DB immediately.
 */
export function VideoCaptureField({
  storagePath,
  onCaptured,
  label = "Instructional video",
}: VideoCaptureFieldProps): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const [state, setState] = useState<CaptureState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleRecordingComplete(blob: Blob): Promise<void> {
    setState("uploading");
    setErrorMessage("");

    const uploadUrlResult = await getUploadUrl();
    if ("error" in uploadUrlResult) {
      setState("error");
      setErrorMessage(uploadUrlResult.error);
      return;
    }

    const { url, storagePath: path } = uploadUrlResult;

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": blob.type || "video/mp4" },
      });
    } catch {
      setState("error");
      setErrorMessage("Upload failed. Please check your connection and try again.");
      return;
    }

    if (!uploadResponse.ok) {
      setState("error");
      setErrorMessage(`Upload failed (${uploadResponse.status}). Please try again.`);
      return;
    }

    setState("idle");
    setModalOpen(false);
    onCaptured(path);
  }

  function closeModal(): void {
    setModalOpen(false);
    setState("idle");
    setErrorMessage("");
  }

  return (
    <>
      {storagePath ? (
        <div className="flex flex-col gap-2">
          <VideoPlayer storagePath={storagePath} label={label} />
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-xs text-primary text-left"
          >
            Replace video
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 text-sm text-primary font-medium"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          Record instructional video
        </button>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Record instructional video"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {state === "uploading" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted">Uploading video…</p>
            </div>
          ) : (
            <>
              <RecordVideo onRecordingComplete={handleRecordingComplete} />
              {state === "error" && (
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
