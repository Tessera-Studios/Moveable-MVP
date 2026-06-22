"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import { useToast } from "@/components/ui";

interface Patient {
  id: string;
  email: string | null;
  focus_area?: string | null;
  streak: number;
  last_active: string | null;
  compliance_rate: number;
}

interface PatientBulkExportProps {
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

export function PatientBulkExport({
  patients,
}: PatientBulkExportProps): React.JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  function togglePatient(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleExport(): Promise<void> {
    if (selected.size === 0) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientIds: Array.from(selected) }),
      });

      if (!res.ok) {
        const msg = await res.text();
        toast({ message: msg || "Export failed", type: "error" });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "patients-export.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ message: "Export failed. Please try again.", type: "error" });
    } finally {
      setExporting(false);
    }
  }

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
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-60 transition-opacity"
          >
            {exporting ? "Exporting…" : `Export Selected (${selected.size})`}
          </button>
        </div>
      )}

      <div className="bg-card rounded-card shadow-card divide-y divide-border">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(patient.id)}
              onChange={() => togglePatient(patient.id)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary shrink-0"
              aria-label={`Select ${patient.email ?? "patient"}`}
            />
            <Link
              href={`/provider/patients/${patient.id}`}
              className="flex items-center gap-3 flex-1 min-w-0"
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
          </div>
        ))}
      </div>
    </div>
  );
}
