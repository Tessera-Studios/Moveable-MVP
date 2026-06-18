"use client";

import React from "react";

export function TypingIndicator({
  name,
}: {
  name: string;
}): React.JSX.Element {
  return (
    <div className="px-4 py-1 text-sm text-placeholder italic">
      {name} is typing…
    </div>
  );
}
