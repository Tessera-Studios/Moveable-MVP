"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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
import type { Exercise, SessionTemplate } from "@/lib/types";
import { Button } from "@/components/ui/Button";

interface ActiveSessionCardProps {
  session: SessionTemplate;
  exercises: Exercise[];
}

function DragHandle(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="5" cy="4" r="1.5" fill="currentColor" />
      <circle cx="5" cy="8" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="11" cy="4" r="1.5" fill="currentColor" />
      <circle cx="11" cy="8" r="1.5" fill="currentColor" />
      <circle cx="11" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function SortableExerciseItem({
  exercise,
  index,
}: {
  exercise: Exercise;
  index: number;
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: exercise.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-3 border-b border-border last:border-0"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-placeholder touch-none cursor-grab active:cursor-grabbing p-1 -ml-1"
        aria-label="Drag to reorder"
      >
        <DragHandle />
      </button>
      <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center text-[11px] font-semibold text-muted shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {exercise.name}
        </p>
        <p className="text-xs text-placeholder">
          {exercise.sets} sets · {exercise.reps} reps
        </p>
      </div>
    </div>
  );
}

export default function ActiveSessionCard({
  session,
  exercises: initialExercises,
}: ActiveSessionCardProps): React.JSX.Element {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setExercises((prev) => {
      const oldIndex = prev.findIndex((e) => e.id === active.id);
      const newIndex = prev.findIndex((e) => e.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleStartSession(): void {
    const order = exercises.map((e) => e.id).join(",");
    router.push(
      `/patient/session/${session.id}?order=${encodeURIComponent(order)}`
    );
  }

  return (
    <div className="bg-card rounded-card shadow-card mx-5">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-0.5">
              Today&apos;s Session
            </p>
            <h2 className="text-lg font-semibold text-foreground">
              {session.name}
            </h2>
          </div>
          <span className="bg-primary-light text-primary text-[11px] font-semibold px-2 py-1 rounded-sm uppercase tracking-wide shrink-0">
            Due Today
          </span>
        </div>
      </div>

      <div className="px-4">
        {exercises.length === 0 ? (
          <p className="text-sm text-placeholder py-3">
            No exercises in this session yet.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={exercises.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              {exercises.map((exercise, index) => (
                <SortableExerciseItem
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="px-4 pb-4 pt-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleStartSession}
          disabled={exercises.length === 0}
        >
          Start Session
        </Button>
      </div>
    </div>
  );
}
