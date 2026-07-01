"use client";

import React, { useId } from "react";
import { ExerciseVideoAttacher } from "@/components/provider/ExerciseVideoAttacher";
import { VideoCaptureField } from "@/components/provider/VideoCaptureField";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface ExerciseFormItem {
  id: string;
  name: string;
  sets: string;
  reps: string;
  patient_notes: string;
  sort_order: number;
  isNew?: boolean;
  video_id: string | null;
  video_storage_path: string | null;
}

/** Digits only, so the field can never hold a non-numeric value. */
function sanitizeDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

interface ExerciseListProps {
  items: ExerciseFormItem[];
  onChange: (items: ExerciseFormItem[]) => void;
}

interface SortableRowProps {
  item: ExerciseFormItem;
  onChange: (updated: ExerciseFormItem) => void;
  onDelete: () => void;
}

function SortableRow({
  item,
  onChange,
  onDelete,
}: SortableRowProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const nameId = useId();
  const setsId = useId();
  const repsId = useId();
  const notesId = useId();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card rounded-card shadow-card p-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="touch-none cursor-grab active:cursor-grabbing text-placeholder p-1 -ml-1 rounded"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="12" height="2" rx="1" />
            <rect x="2" y="7" width="12" height="2" rx="1" />
            <rect x="2" y="11" width="12" height="2" rx="1" />
          </svg>
        </button>
        <div className="flex-1">
          <label
            htmlFor={nameId}
            className="text-xs font-medium text-muted mb-1 block"
          >
            Exercise name
          </label>
          <input
            id={nameId}
            type="text"
            value={item.name}
            onChange={(e) => onChange({ ...item, name: e.target.value })}
            placeholder="e.g. Knee extension"
            className="w-full h-10 rounded-sm border border-border px-3 text-sm text-foreground bg-background placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete exercise"
          className="text-placeholder hover:text-error transition-colors p-1 rounded shrink-0"
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
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={setsId}
            className="text-xs font-medium text-muted mb-1 block"
          >
            Sets
          </label>
          <input
            id={setsId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={item.sets}
            onChange={(e) =>
              onChange({ ...item, sets: sanitizeDigits(e.target.value) })
            }
            className="w-full h-10 rounded-sm border border-border px-3 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label
            htmlFor={repsId}
            className="text-xs font-medium text-muted mb-1 block"
          >
            Reps
          </label>
          <input
            id={repsId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={item.reps}
            onChange={(e) =>
              onChange({ ...item, reps: sanitizeDigits(e.target.value) })
            }
            className="w-full h-10 rounded-sm border border-border px-3 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={notesId}
          className="text-xs font-medium text-muted mb-1 block"
        >
          Patient notes (optional)
        </label>
        <textarea
          id={notesId}
          value={item.patient_notes}
          onChange={(e) => onChange({ ...item, patient_notes: e.target.value })}
          placeholder="Instructions visible to the patient"
          rows={2}
          className="w-full rounded-sm border border-border px-3 py-2 text-sm text-foreground bg-background placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {item.id.startsWith("new-") ? (
        // Not yet persisted: upload to Storage now, link to the DB on save.
        <VideoCaptureField
          storagePath={item.video_storage_path}
          onCaptured={(storagePath) =>
            onChange({ ...item, video_storage_path: storagePath })
          }
        />
      ) : (
        <ExerciseVideoAttacher
          exerciseId={item.id}
          videoStoragePath={item.video_storage_path}
          onVideoAttached={(videoId, storagePath) =>
            onChange({ ...item, video_id: videoId, video_storage_path: storagePath })
          }
        />
      )}
    </div>
  );
}

export function ExerciseList({
  items,
  onChange,
}: ExerciseListProps): React.JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map(
      (item, index) => ({ ...item, sort_order: index })
    );
    onChange(reordered);
  }

  function updateItem(id: string, updated: ExerciseFormItem): void {
    onChange(items.map((i) => (i.id === id ? updated : i)));
  }

  function deleteItem(id: string): void {
    onChange(items.filter((i) => i.id !== id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              onChange={(updated) => updateItem(item.id, updated)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
