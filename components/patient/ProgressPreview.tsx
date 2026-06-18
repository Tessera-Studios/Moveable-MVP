"use client";

import React from "react";

interface ProgressPreviewProps {
  recentCompletions: { date: string; completed: boolean }[];
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function ProgressPreview({
  recentCompletions,
}: ProgressPreviewProps): React.JSX.Element {
  const last7 = recentCompletions.slice(-7);

  return (
    <div className="bg-card rounded-card shadow-card mx-5 px-4 py-4">
      <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-3">
        Last 7 Days
      </p>
      <div className="flex items-end gap-1.5 h-12">
        {last7.map((day, i) => {
          const dayLabel =
            DAY_LABELS[new Date(day.date + "T12:00:00").getDay()];
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-sm transition-colors ${
                  day.completed ? "bg-success" : "bg-surface"
                }`}
                style={{ height: day.completed ? "100%" : "30%" }}
                aria-label={`${day.date}: ${day.completed ? "completed" : "missed"}`}
              />
              <span className="text-[10px] text-placeholder font-medium">
                {dayLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
