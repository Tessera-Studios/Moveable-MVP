import React from "react";
import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";

interface Patient {
  id: string;
  email: string | null;
  streak: number;
  last_active: string | null;
  compliance_rate: number;
}

interface PatientRosterCardProps {
  patients: Patient[];
}

function complianceBadgeVariant(
  rate: number
): "success" | "warning" | "error" {
  if (rate >= 80) return "success";
  if (rate >= 50) return "warning";
  return "error";
}

function formatLastActive(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export function PatientRosterCard({
  patients,
}: PatientRosterCardProps): React.JSX.Element {
  if (patients.length === 0) {
    return (
      <div className="bg-card rounded-card shadow-card p-5">
        <p className="text-sm text-muted text-center py-4">
          No patients yet. Share an invitation code to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-card shadow-card divide-y divide-border">
      {patients.map((patient) => (
        <Link
          key={patient.id}
          href={`/provider/patients/${patient.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors"
        >
          <Avatar name={patient.email ?? "Patient"} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {patient.email ?? "Unknown patient"}
            </p>
            <p className="text-xs text-muted">
              {patient.streak > 0 ? `${patient.streak}d streak · ` : ""}
              Last active: {formatLastActive(patient.last_active)}
            </p>
          </div>
          <Badge variant={complianceBadgeVariant(patient.compliance_rate)}>
            {patient.compliance_rate}%
          </Badge>
        </Link>
      ))}
    </div>
  );
}
