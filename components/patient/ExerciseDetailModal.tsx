"use client";

import React from "react";
import type { Exercise } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { VideoPlayer } from "@/components/shared/VideoPlayer";

interface ExerciseDetailModalProps {
  exercise: Exercise | null;
  open: boolean;
  onClose: () => void;
}

export function ExerciseDetailModal({
  exercise,
  open,
  onClose,
}: ExerciseDetailModalProps): React.JSX.Element | null {
  if (!exercise) return null;

  return (
    <Modal open={open} onClose={onClose} title={exercise.name} size="lg">
      <div className="flex flex-col gap-4">
        {exercise.video_storage_path ? (
          <VideoPlayer storagePath={exercise.video_storage_path} />
        ) : (
          <div className="bg-surface rounded-card aspect-video flex items-center justify-center p-4 text-center">
            <p className="text-sm text-muted">No video for this exercise yet.</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="bg-surface text-muted text-xs font-semibold px-2.5 py-1 rounded-sm">
            {exercise.sets} sets
          </span>
          <span className="bg-surface text-muted text-xs font-semibold px-2.5 py-1 rounded-sm">
            {exercise.reps} reps
          </span>
        </div>

        {exercise.patient_notes && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-placeholder uppercase tracking-wide">
              Notes from your therapist
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {exercise.patient_notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
