"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeSession } from "@/lib/actions/executions";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const EASE_OPTIONS = [
  { value: 1, emoji: "😤", label: "Very Hard" },
  { value: 2, emoji: "😣", label: "Hard" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Easy" },
  { value: 5, emoji: "😄", label: "Very Easy" },
];

const PAIN_OPTIONS = [
  { value: 1, emoji: "😊", label: "No Pain" },
  { value: 2, emoji: "🙂", label: "Mild" },
  { value: 3, emoji: "😐", label: "Moderate" },
  { value: 4, emoji: "😣", label: "Severe" },
  { value: 5, emoji: "😭", label: "Extreme" },
];

interface RatingRowProps {
  label: string;
  options: typeof EASE_OPTIONS;
  selected: number | null;
  onSelect: (value: number) => void;
}

function RatingRow({
  label,
  options,
  selected,
  onSelect,
}: RatingRowProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest">
        {label}
      </p>
      <div className="flex gap-2">
        {options.map((opt) => {
          const active = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              aria-label={opt.label}
              aria-pressed={active}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-card border-2 transition-all ${
                active
                  ? "border-primary bg-primary-light"
                  : "border-border bg-card"
              }`}
            >
              <span className="text-2xl leading-none">{opt.emoji}</span>
              <span
                className={`text-[10px] font-medium ${
                  active ? "text-primary" : "text-placeholder"
                }`}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FeedbackFormProps {
  sessionTemplateId: string;
  sessionName: string;
}

export default function FeedbackForm({
  sessionTemplateId,
  sessionName,
}: FeedbackFormProps): React.JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const [ease, setEase] = useState<number | null>(null);
  const [pain, setPain] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(): void {
    if (ease === null || pain === null) {
      toast({ type: "error", message: "Please rate both ease and pain before submitting." });
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    startTransition(async () => {
      try {
        const { streak, totalCompleted } = await completeSession(
          sessionTemplateId,
          ease,
          pain,
          timezone
        );
        toast({
          type: "success",
          message: `Session complete! 🔥 ${streak}-day streak · ${totalCompleted} total`,
        });
        router.refresh();
        router.push("/patient/progress");
      } catch (err) {
        toast({
          type: "error",
          message: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  }

  return (
    <div className="px-5 py-6 flex flex-col gap-6">
      <div>
        <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-1">
          Session complete
        </p>
        <h1 className="text-xl font-semibold text-foreground">{sessionName}</h1>
        <p className="text-sm text-placeholder mt-1">
          Tell us how it went so your therapist can adjust your plan.
        </p>
      </div>

      <RatingRow
        label="How easy was it?"
        options={EASE_OPTIONS}
        selected={ease}
        onSelect={setEase}
      />

      <RatingRow
        label="Pain level"
        options={PAIN_OPTIONS}
        selected={pain}
        onSelect={setPain}
      />

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        loading={isPending}
        disabled={ease === null || pain === null}
      >
        Submit & View Progress
      </Button>
    </div>
  );
}
