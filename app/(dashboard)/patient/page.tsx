import React from "react";

export default function PatientDashboardPage(): React.JSX.Element {
  return (
    <div className="px-5 pt-10 flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-foreground">
        Your exercises
      </h1>

      <div className="bg-card rounded-card shadow-card p-5 flex flex-col gap-1">
        <span className="text-lg font-semibold text-foreground">
          No exercises assigned yet
        </span>
        <span className="text-sm text-muted">
          Your physical therapist will assign exercises here once you are
          connected.
        </span>
      </div>
    </div>
  );
}
