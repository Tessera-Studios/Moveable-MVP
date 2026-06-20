"use client";

import React, { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { VideoCaptureField } from "@/components/provider/VideoCaptureField";

export interface NewExerciseData {
  name: string;
  sets: number;
  reps: number;
  patient_notes: string;
  video_storage_path: string | null;
}

interface AddExerciseModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: NewExerciseData) => void;
}

const EMPTY: NewExerciseData = {
  name: "",
  sets: 3,
  reps: 10,
  patient_notes: "",
  video_storage_path: null,
};

/**
 * Video-first exercise creation. The instructional video is the primary
 * section at the top; exercise details follow. The video uploads to Storage
 * immediately but is linked to the DB when the exercise is persisted, so this
 * works before the session itself has been created.
 */
export function AddExerciseModal({
  open,
  onClose,
  onAdd,
}: AddExerciseModalProps): React.JSX.Element {
  const [data, setData] = useState<NewExerciseData>(EMPTY);

  function reset(): void {
    setData(EMPTY);
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  function handleAdd(): void {
    if (!data.name.trim()) return;
    onAdd({ ...data, name: data.name.trim() });
    reset();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add exercise" size="lg">
      <div className="flex flex-col gap-5">
        <section>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-semibold text-foreground">
              Instructional video
            </h3>
            <span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded">
              Optional
            </span>
          </div>
          <p className="text-xs text-muted mb-3">
            Record a demonstration first — your patient will see this while
            performing the exercise.
          </p>
          <VideoCaptureField
            storagePath={data.video_storage_path}
            onCaptured={(path) =>
              setData((prev) => ({ ...prev, video_storage_path: path }))
            }
          />
        </section>

        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Exercise name
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => setData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Knee extension"
            autoFocus
            className="w-full h-11 rounded-sm border border-border px-3 text-sm text-foreground bg-background placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              Sets
            </label>
            <input
              type="number"
              min={1}
              value={data.sets}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  sets: Math.max(1, Number(e.target.value)),
                }))
              }
              className="w-full h-11 rounded-sm border border-border px-3 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">
              Reps
            </label>
            <input
              type="number"
              min={1}
              value={data.reps}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  reps: Math.max(1, Number(e.target.value)),
                }))
              }
              className="w-full h-11 rounded-sm border border-border px-3 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted mb-1 block">
            Patient notes (optional)
          </label>
          <textarea
            value={data.patient_notes}
            onChange={(e) =>
              setData((prev) => ({ ...prev, patient_notes: e.target.value }))
            }
            placeholder="Instructions visible to the patient"
            rows={2}
            className="w-full rounded-sm border border-border px-3 py-2 text-sm text-foreground bg-background placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            onClick={handleAdd}
            disabled={!data.name.trim()}
          >
            Add exercise
          </Button>
        </div>
      </div>
    </Modal>
  );
}
