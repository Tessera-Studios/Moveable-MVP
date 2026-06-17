"use client";

import React, { useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({
  label,
  error,
  hint,
  className = "",
  id: providedId,
  ...props
}: InputProps): React.ReactElement {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        {...props}
        id={id}
        className={[
          "w-full min-h-12 px-4 rounded-card border bg-card text-foreground",
          "placeholder:text-placeholder transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary",
          error ? "border-error" : "border-border",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {error && <p className="text-sm text-error">{error}</p>}
      {!error && hint && <p className="text-sm text-placeholder">{hint}</p>}
    </div>
  );
}
