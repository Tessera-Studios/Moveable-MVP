import React from "react";

interface LoadingSpinnerProps {
  fullPage?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-4",
  lg: "w-12 h-12 border-4",
};

export function LoadingSpinner({
  fullPage = false,
  size = "md",
}: LoadingSpinnerProps): React.ReactElement {
  const spinner = (
    <div
      role="status"
      aria-label="Loading"
      className={[
        "rounded-full animate-spin border-primary border-t-transparent",
        sizeClasses[size],
      ].join(" ")}
    />
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
        {spinner}
      </div>
    );
  }

  return spinner;
}
