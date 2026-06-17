import React from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface text-muted",
  success: "bg-green-100 text-success",
  warning: "bg-orange-100 text-warning",
  error: "bg-red-100 text-error",
  info: "bg-primary-light text-primary",
};

export function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps): React.ReactElement {
  return (
    <span
      className={[
        "inline-flex items-center rounded-button px-3 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
