"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ExerciseList, type ExerciseFormItem } from "./ExerciseList";
import {
  createSessionTemplate,
  updateSessionTemplate,
  deleteSessionTemplate,
} from "@/lib/actions/sessions";
import {
  addExercise,
  updateExercise,
  deleteExercise,
  reorderExercises,
} from "@/lib/actions/exercises";

interface Patient {
  id: string;
  email: string | null;
}

interface SessionFormProps {
  mode: "create" | "edit";
  sessionId?: string;
  initialData?: {
    name: string;
    patient_id: string;
    provider_notes: string;
    exercises: ExerciseFormItem[];
  };
  patients: Patient[];
}

function newExercise(sortOrder: number): ExerciseFormItem {
  return {
    id: `new-${Date.now()}-${Math.random()}`,
    name: "",
    sets: 3,
    reps: 10,
    patient_notes: "",
    sort_order: sortOrder,
    isNew: true,
  };
}

export function SessionForm({
  mode,
  sessionId,
  initialData,
  patients,
}: SessionFormProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialData?.name ?? "");
  const [patientId, setPatientId] = useState(initialData?.patient_id ?? "");
  const [providerNotes, setProviderNotes] = useState(
    initialData?.provider_notes ?? ""
  );
  const [exercises, setExercises] = useState<ExerciseFormItem[]>(
    initialData?.exercises ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function addNewExercise(): void {
    setExercises((prev) => [...prev, newExercise(prev.length)]);
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Session name is required.");
      return;
    }
    if (!patientId) {
      setError("Please select a patient.");
      return;
    }

    startTransition(async () => {
      if (mode === "create") {
        const result = await createSessionTemplate({
          name,
          patient_id: patientId,
          provider_notes: providerNotes || null,
        });

        if ("error" in result) {
          setError(result.error);
          return;
        }

        const createdId = result.id;

        if (exercises.length > 0) {
          const exerciseResults = await Promise.all(
            exercises.map((ex) =>
              addExercise(createdId, {
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                patient_notes: ex.patient_notes || null,
                sort_order: ex.sort_order,
              })
            )
          );
          const firstError = exerciseResults.find((r) => "error" in r);
          if (firstError && "error" in firstError) {
            setError(firstError.error);
            return;
          }
        }

        router.push("/provider/templates");
      } else if (mode === "edit" && sessionId) {
        const result = await updateSessionTemplate(sessionId, {
          name,
          patient_id: patientId,
          provider_notes: providerNotes || null,
        });

        if ("error" in result) {
          setError(result.error);
          return;
        }

        const originalIds = new Set(
          (initialData?.exercises ?? []).map((e) => e.id)
        );
        const toDelete = [...originalIds].filter(
          (id) => !exercises.some((e) => e.id === id)
        );
        const toAdd = exercises.filter((e) => e.isNew);
        const toUpdate = exercises.filter(
          (e) => !e.isNew && originalIds.has(e.id)
        );

        await Promise.all([
          ...toDelete.map((id) => deleteExercise(id)),
          ...toAdd.map((ex) =>
            addExercise(sessionId, {
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              patient_notes: ex.patient_notes || null,
              sort_order: ex.sort_order,
            })
          ),
          ...toUpdate.map((ex) =>
            updateExercise(ex.id, {
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              patient_notes: ex.patient_notes || null,
              sort_order: ex.sort_order,
            })
          ),
        ]);

        const existingToReorder = exercises
          .filter((e) => !e.isNew)
          .map((e) => ({ id: e.id, sort_order: e.sort_order }));
        if (existingToReorder.length > 0) {
          await reorderExercises(existingToReorder);
        }

        router.push("/provider/templates");
      }
    });
  }

  async function handleDelete(): Promise<void> {
    if (!sessionId) return;
    setDeleteLoading(true);
    const result = await deleteSessionTemplate(sessionId);
    setDeleteLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      router.push("/provider/templates");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">
          Session name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Week 1 Knee Rehab"
          className="w-full h-12 rounded-sm border border-border px-3 text-sm text-foreground bg-card placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted mb-1 block">
          Patient
        </label>
        <select
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="w-full h-12 rounded-sm border border-border px-3 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          required
        >
          <option value="">Select a patient…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.email ?? p.id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs font-medium text-muted">
            Provider notes
          </label>
          <span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded">
            Confidential
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <textarea
          value={providerNotes}
          onChange={(e) => setProviderNotes(e.target.value)}
          placeholder="Notes for your reference only — not visible to the patient"
          rows={3}
          className="w-full rounded-sm border border-border px-3 py-2 text-sm text-foreground bg-card placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Exercises</h2>
          <button
            type="button"
            onClick={addNewExercise}
            className="text-sm text-primary font-medium"
          >
            + Add exercise
          </button>
        </div>

        {exercises.length === 0 ? (
          <button
            type="button"
            onClick={addNewExercise}
            className="w-full border-2 border-dashed border-border rounded-card py-8 text-sm text-muted hover:border-primary hover:text-primary transition-colors"
          >
            Tap to add the first exercise
          </button>
        ) : (
          <ExerciseList items={exercises} onChange={setExercises} />
        )}
      </section>

      {error && (
        <p className="text-sm text-error bg-red-50 rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <Button type="submit" loading={isPending} className="w-full">
          {mode === "create" ? "Create session" : "Save changes"}
        </Button>
        {mode === "edit" && (
          <Button
            type="button"
            variant="danger"
            loading={deleteLoading}
            onClick={handleDelete}
            className="w-full"
          >
            Delete session
          </Button>
        )}
      </div>
    </form>
  );
}
