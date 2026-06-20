"use client";

import React from "react";

interface State {
  error: Error | null;
}

export class EditErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="px-5 pt-10 pb-6">
          <p className="text-sm text-error">
            Failed to load the session editor. Please refresh and try again.
          </p>
          <p className="text-xs text-muted mt-1">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
