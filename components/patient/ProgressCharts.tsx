"use client";

import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { PatientStats } from "@/lib/types";

interface ProgressChartsProps {
  stats: PatientStats;
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="text-[11px] font-semibold text-placeholder uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

function EmptyChart({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="h-24 flex items-center justify-center text-sm text-placeholder">
      {message}
    </div>
  );
}

export default function ProgressCharts({
  stats,
}: ProgressChartsProps): React.JSX.Element {
  const { recentCompletions, painScores, easeScores, streak, totalCompleted } =
    stats;

  const complianceCount = recentCompletions.filter((d) => d.completed).length;
  const complianceRate = Math.round((complianceCount / 30) * 100);

  return (
    <div className="flex flex-col gap-4 px-5 pb-6 pt-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-card shadow-card p-4 text-center">
          <p className="text-2xl font-black text-primary">{streak}</p>
          <p className="text-[11px] text-placeholder uppercase tracking-wide font-semibold mt-0.5">
            Streak
          </p>
        </div>
        <div className="bg-card rounded-card shadow-card p-4 text-center">
          <p className="text-2xl font-black text-foreground">{totalCompleted}</p>
          <p className="text-[11px] text-placeholder uppercase tracking-wide font-semibold mt-0.5">
            Total
          </p>
        </div>
        <div className="bg-card rounded-card shadow-card p-4 text-center">
          <p className="text-2xl font-black text-secondary">{complianceRate}%</p>
          <p className="text-[11px] text-placeholder uppercase tracking-wide font-semibold mt-0.5">
            30-day
          </p>
        </div>
      </div>

      {/* 30-day streak history */}
      <div className="bg-card rounded-card shadow-card p-5">
        <SectionLabel>Daily Completions — Last 30 Days</SectionLabel>
        {recentCompletions.every((d) => !d.completed) ? (
          <EmptyChart message="Complete your first session to see your history." />
        ) : (
          <ResponsiveContainer width="100%" height={80}>
            <BarChart
              data={recentCompletions}
              barCategoryGap="20%"
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <Bar dataKey={(d) => (d.completed ? 1 : 0)} radius={[2, 2, 0, 0]}>
                {recentCompletions.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.completed ? "#2E7D32" : "#E5E7EB"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pain trend */}
      <div className="bg-card rounded-card shadow-card p-5">
        <SectionLabel>Pain Level Over Time</SectionLabel>
        {painScores.length < 2 ? (
          <EmptyChart message="Complete at least 2 sessions to see pain trends." />
        ) : (
          <ResponsiveContainer width="100%" height={100}>
            <LineChart
              data={painScores}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => [`${v}`, "Pain"]}
                labelFormatter={() => ""}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#D32F2F"
                strokeWidth={2}
                dot={{ r: 3, fill: "#D32F2F" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Ease trend */}
      <div className="bg-card rounded-card shadow-card p-5">
        <SectionLabel>Ease Over Time</SectionLabel>
        {easeScores.length < 2 ? (
          <EmptyChart message="Complete at least 2 sessions to see ease trends." />
        ) : (
          <ResponsiveContainer width="100%" height={100}>
            <LineChart
              data={easeScores}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => [`${v}`, "Ease"]}
                labelFormatter={() => ""}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#1E88E5"
                strokeWidth={2}
                dot={{ r: 3, fill: "#1E88E5" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
