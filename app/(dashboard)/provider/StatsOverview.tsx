import React from "react";

interface StatsOverviewProps {
  totalPatients: number;
  sessionsThisWeek: number;
  avgComplianceRate: number;
}

export function StatsOverview({
  totalPatients,
  sessionsThisWeek,
  avgComplianceRate,
}: StatsOverviewProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label="Patients" value={totalPatients} />
      <StatCard label="Sessions this week" value={sessionsThisWeek} />
      <StatCard label="Avg compliance" value={`${avgComplianceRate}%`} />
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): React.JSX.Element {
  return (
    <div className="bg-card rounded-card shadow-card p-4 flex flex-col gap-1">
      <span className="text-2xl font-bold text-foreground leading-none">
        {value}
      </span>
      <span className="text-[11px] text-muted leading-tight">{label}</span>
    </div>
  );
}
