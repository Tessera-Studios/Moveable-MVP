"use client";

import React, { useEffect, useState } from "react";
import { getSignedPlaybackUrl } from "@/lib/actions/videos";

interface VideoPlayerProps {
  storagePath: string;
  label?: string;
}

type PlayerState = "loading" | "ready" | "error";

export function VideoPlayer({ storagePath, label }: VideoPlayerProps): React.JSX.Element {
  const [state, setState] = useState<PlayerState>("loading");
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function fetchUrl(): Promise<void> {
      const result = await getSignedPlaybackUrl(storagePath);
      if (cancelled) return;

      if ("error" in result) {
        setState("error");
        setErrorMessage(result.error);
      } else {
        setSignedUrl(result.url);
        setState("ready");
      }
    }

    void fetchUrl();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (state === "loading") {
    return (
      <div className="bg-surface rounded-card aspect-video flex items-center justify-center">
        <p className="text-sm text-muted">Loading video…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="bg-surface rounded-card aspect-video flex items-center justify-center p-4 text-center">
        <p className="text-sm text-error">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <p className="text-xs font-medium text-muted">{label}</p>
      )}
      <video
        src={signedUrl}
        controls
        playsInline
        className="w-full rounded-card bg-black"
        style={{ aspectRatio: "16/9" }}
      />
    </div>
  );
}
