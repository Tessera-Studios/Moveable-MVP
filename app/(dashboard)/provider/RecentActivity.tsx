import React from "react";

interface ActivityItem {
  id: string;
  patient_email: string | null;
  session_name: string;
  completed_at: string;
}

interface RecentActivityProps {
  items: ActivityItem[];
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RecentActivity({
  items,
}: RecentActivityProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-4">
        No recent activity.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 bg-card rounded-card shadow-card px-4 py-3"
        >
          <div className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">
              <span className="font-medium">
                {item.patient_email ?? "Patient"}
              </span>{" "}
              completed{" "}
              <span className="font-medium">{item.session_name}</span>
            </p>
            <p className="text-xs text-muted">{formatTime(item.completed_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
