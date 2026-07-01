"use client";

import React, { useState } from "react";
import type { Exercise } from "@/lib/types";
import { ExerciseDetailModal } from "./ExerciseDetailModal";

interface PatientExercisesListProps {
  exercises: Exercise[];
}

function ChevronRight(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4 text-placeholder shrink-0"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PatientExercisesList({
  exercises,
}: PatientExercisesListProps): React.JSX.Element {
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null
  );

  return (
    <div>
      {exercises.map((ex, i) => (
        <button
          key={ex.id}
          type="button"
          onClick={() => setSelectedExercise(ex)}
          className={`flex items-center gap-3 py-3 w-full text-left transition-colors hover:bg-surface focus-visible:bg-surface outline-none ${
            i < exercises.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-muted">{i + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {ex.name}
            </p>
            <p className="text-xs text-placeholder">
              {ex.sets} sets · {ex.reps} reps
            </p>
          </div>
          <ChevronRight />
        </button>
      ))}

      <ExerciseDetailModal
        exercise={selectedExercise}
        open={selectedExercise !== null}
        onClose={() => setSelectedExercise(null)}
      />
    </div>
  );
}
