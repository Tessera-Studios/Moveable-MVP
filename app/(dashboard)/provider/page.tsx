import React from "react";
import InvitationCodeWidget from "./InvitationCodeWidget";

export default function ProviderDashboardPage(): React.JSX.Element {
  return (
    <div className="px-5 pt-10 flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-foreground">
        Good morning, Doctor
      </h1>

      <div className="bg-card rounded-card shadow-card p-5 flex flex-col gap-1">
        <span className="text-lg font-semibold text-foreground">
          0 patients
        </span>
        <span className="text-sm text-muted">
          No patients added yet. Invite patients to get started.
        </span>
      </div>

      <InvitationCodeWidget />

      <div className="bg-card rounded-card shadow-card p-5 flex flex-col gap-1">
        <span className="text-lg font-semibold text-foreground">
          No sessions today
        </span>
        <span className="text-sm text-muted">
          Your scheduled sessions will appear here.
        </span>
      </div>
    </div>
  );
}
