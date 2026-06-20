"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui";
import { RecordVideo } from "@/components/shared/RecordVideo";
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import {
  getUploadUrl,
  saveVideoMetadata,
  attachInstructionalVideo,
} from "@/lib/actions/videos";

type AttachState = "idle" | "uploading" | "error";

interface ExerciseVideoAttacherProps {
  exerciseId: string;
  videoStoragePath: string | null;
  onVideoAttached: (videoId: string, storagePath: string) => void;
}

export function ExerciseVideoAttacher({
  exerciseId,
  videoStoragePath,
  onVideoAttached,
}: ExerciseVideoAttacherProps): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const [attachState, setAttachState] = useState<AttachState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleRecordingComplete(blob: Blob): Promise<void> {
    setAttachState("uploading");
    setErrorMessage("");

    const uploadUrlResult = await getUploadUrl(exerciseId);
    if ("error" in uploadUrlResult) {
      setAttachState("error");
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
      setAttachState("error");
      setErrorMessage(`Upload failed (${uploadResponse.status}). Please try again.`);
      return;
    }

    const metaResult = await saveVideoMetadata(storagePath, exerciseId);
    if ("error" in metaResult) {
      setAttachState("error");
      setErrorMessage(metaResult.error);
      return;
    }

    const attachResult = await attachInstructionalVideo(exerciseId, metaResult.id);
    if ("error" in attachResult) {
      setAttachState("error");
      setErrorMessage(attachResult.error);
      return;
    }

    setAttachState("idle");
    setModalOpen(false);
    onVideoAttached(metaResult.id, storagePath);
  }

  return (
    <>
      <div className="mt-2">
        {videoStoragePath ? (
          <div className="flex flex-col gap-2">
            <VideoPlayer storagePath={videoStoragePath} label="Instructional video" />
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Attach instructional video
          </button>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setAttachState("idle");
          setErrorMessage("");
        }}
        title="Record instructional video"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {attachState === "uploading" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted">Uploading video…</p>
            </div>
          ) : (
            <>
              <RecordVideo onRecordingComplete={handleRecordingComplete} maxDuration={20} />
              {attachState === "error" && (
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
