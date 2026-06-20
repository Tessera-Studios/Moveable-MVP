"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { Exercise } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { PatientFormRecord } from "@/components/patient/PatientFormRecord";

interface ExerciseExecutorProps {
  sessionId: string;
  exercises: Exercise[];
}

function SetCircles({
  sets,
  completedSets,
  onComplete,
}: {
  sets: number;
  completedSets: number;
  onComplete: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3 flex-wrap justify-center">
        {Array.from({ length: sets }).map((_, i) => {
          const done = i < completedSets;
          return (
            <div
              key={i}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-semibold text-sm transition-all duration-200 ${
                done
                  ? "bg-primary border-primary text-white scale-110"
                  : "border-border text-placeholder bg-card"
              }`}
              style={done ? { animation: "setComplete 0.25s ease-out" } : {}}
              aria-label={`Set ${i + 1} ${done ? "complete" : "pending"}`}
            >
              {done ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8l3.5 3.5L13 4"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </div>
          );
        })}
      </div>

      {completedSets < sets && (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onComplete}
        >
          Mark Set {completedSets + 1} Complete
        </Button>
      )}
    </div>
  );
}

function ExerciseNav({
  total,
  current,
  onNavigate,
}: {
  total: number;
  current: number;
  onNavigate: (index: number) => void;
}): React.JSX.Element {
  return (
    <div className="flex gap-2 justify-center py-3">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onNavigate(i)}
          aria-label={`Go to exercise ${i + 1}`}
          className={`rounded-full transition-all duration-150 ${
            i === current
              ? "w-6 h-2.5 bg-primary"
              : "w-2.5 h-2.5 bg-border hover:bg-placeholder"
          }`}
        />
      ))}
    </div>
  );
}

export default function ExerciseExecutor({
  sessionId,
  exercises,
}: ExerciseExecutorProps): React.JSX.Element {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<Record<string, number>>(
    {}
  );
  const [uploadingCount, setUploadingCount] = useState(0);

  function handleUploadingChange(uploading: boolean): void {
    setUploadingCount((n) => Math.max(0, n + (uploading ? 1 : -1)));
  }

  const exercise = exercises[currentIndex];
  const setsCompleted = completedSets[exercise.id] ?? 0;
  const exerciseDone = setsCompleted >= exercise.sets;

  const allDone = exercises.every(
    (e) => (completedSets[e.id] ?? 0) >= e.sets
  );

  function handleSetComplete(): void {
    setCompletedSets((prev) => ({
      ...prev,
      [exercise.id]: (prev[exercise.id] ?? 0) + 1,
    }));
  }

  function handleNext(): void {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleFinish(): void {
    router.push(`/patient/session/${sessionId}/feedback`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="w-full h-1 bg-surface">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{
            width: `${((currentIndex + (exerciseDone ? 1 : 0)) / exercises.length) * 100}%`,
          }}
        />
      </div>

      {/* Exercise nav dots */}
      <ExerciseNav
        total={exercises.length}
        current={currentIndex}
        onNavigate={setCurrentIndex}
      />

      {/* Exercise card */}
      <div className="flex-1 px-5 pb-6">
        <div className="bg-card rounded-card shadow-card p-5 flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-1">
              Exercise {currentIndex + 1} of {exercises.length}
            </p>
            <h2 className="text-xl font-semibold text-foreground">
              {exercise.name}
            </h2>
            <p className="text-sm text-placeholder mt-1">
              {exercise.sets} sets · {exercise.reps} reps each
            </p>
          </div>

          {exercise.patient_notes && (
            <div className="bg-primary-light rounded-sm px-4 py-3">
              <p className="text-sm text-primary font-medium">
                {exercise.patient_notes}
              </p>
            </div>
          )}

          <SetCircles
            sets={exercise.sets}
            completedSets={setsCompleted}
            onComplete={handleSetComplete}
          />

          <PatientFormRecord exerciseId={exercise.id} onUploadingChange={handleUploadingChange} />

          {exerciseDone && (
            <div className="flex flex-col gap-2">
              {currentIndex < exercises.length - 1 ? (
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={handleNext}
                >
                  Next Exercise →
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Finish button — appears when all exercises done */}
      {allDone && (
        <div className="px-5 pb-4">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleFinish}
            loading={uploadingCount > 0}
            disabled={uploadingCount > 0}
          >
            {uploadingCount > 0 ? "Uploading video…" : "Finish Session"}
          </Button>
        </div>
      )}
    </div>
  );
}
