"use client";

import React from "react";

export function PresenceDot({
  online,
}: {
  online: boolean;
}): React.JSX.Element {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        online ? "bg-green-500" : "bg-gray-400"
      }`}
      aria-label={online ? "Online" : "Offline"}
    />
  );
}
