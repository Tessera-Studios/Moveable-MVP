import React from "react";

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

const sizePixels: Record<"sm" | "md" | "lg", number> = {
  sm: 32,
  md: 40,
  lg: 48,
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function FallbackIcon(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-1/2 h-1/2 text-primary"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function Avatar({
  src,
  name,
  size = "md",
  className = "",
}: AvatarProps): React.ReactElement {
  const px = sizePixels[size];
  const base = [
    "rounded-full overflow-hidden inline-flex items-center justify-center shrink-0",
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "Avatar"}
        width={px}
        height={px}
        className={[base, "object-cover"].join(" ")}
      />
    );
  }

  return (
    <div className={[base, "bg-primary-light"].join(" ")}>
      {name ? (
        <span className="font-medium text-primary leading-none">
          {getInitials(name)}
        </span>
      ) : (
        <FallbackIcon />
      )}
    </div>
  );
}
