"use client";

import React from "react";

interface ProgressPreviewProps {
  recentCompletions: { date: string; completed: boolean }[];
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function ProgressPreview({
  recentCompletions,
}: ProgressPreviewProps): React.JSX.Element {
  const todayDate =
    recentCompletions[recentCompletions.length - 1]?.date ??
    new Date().toLocaleDateString("en-CA");

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate + "T12:00:00");
    d.setDate(d.getDate() + i);
    const dateStr = d.toLocaleDateString("en-CA");
    const completed =
      recentCompletions.find((c) => c.date === dateStr)?.completed ?? false;
    return { date: dateStr, completed };
  });

  return (
    <div className="bg-card rounded-card shadow-card mx-5 px-4 py-4">
      <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-3">
        This Week
      </p>
      <div className="flex justify-between">
        {week.map((day) => {
          const dayLabel =
            DAY_LABELS[new Date(day.date + "T12:00:00").getDay()];
          return (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  day.completed ? "bg-primary" : "bg-surface"
                }`}
                aria-label={`${day.date}: ${day.completed ? "completed" : "missed"}`}
              >
                <span
                  className={`text-[12px] font-semibold ${
                    day.completed ? "text-white" : "text-placeholder"
                  }`}
                >
                  {dayLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
