"use client";

import React, { useState } from "react";
import { Button, useToast } from "@/components/ui";

interface ExportButtonProps {
  patientId: string;
}

export function ExportButton({ patientId }: ExportButtonProps): React.JSX.Element {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(
        `/api/export/patient-stats?patientId=${encodeURIComponent(patientId)}&from=2024-01-01&to=${today}`
      );
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patient-${patientId}-stats.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ message: "Export failed. Please try again.", type: "error" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="secondary" loading={exporting} onClick={handleExport}>
      Export Statistics to PDF
    </Button>
  );
}
