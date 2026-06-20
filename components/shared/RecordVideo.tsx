"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui";

type RecordingState = "idle" | "requesting" | "recording" | "recorded" | "error";

interface RecordVideoProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  maxDuration?: number;
}

function isRecordingSupported(): boolean {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices?.getUserMedia !== undefined &&
    typeof window !== "undefined" &&
    window.MediaRecorder
  );
}

function getSupportedMimeType(): string {
  const types = [
    "video/mp4; codecs=avc1",
    "video/webm; codecs=vp9,opus",
    "video/webm; codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function RecordVideo({
  onRecordingComplete,
  maxDuration = 20,
}: RecordVideoProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<RecordingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [toggleError, setToggleError] = useState<string>("");

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startCamera = useCallback(async (mode: "user" | "environment" = "user"): Promise<void> => {
    if (!isRecordingSupported()) {
      setState("error");
      setErrorMessage(
        "Video recording is not supported in this browser. Please use Chrome, Firefox, or Safari."
      );
      return;
    }

    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState("idle");
    } catch {
      setState("error");
      setErrorMessage(
        "Camera access was denied. Please allow camera and microphone access and try again."
      );
    }
  }, []);

  useEffect(() => {
    void startCamera("user");
  }, [startCamera]);

  async function handleToggleCamera(): Promise<void> {
    setToggleError("");
    const next = facingMode === "user" ? "environment" : "user";
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setFacingMode(next);
      setState("idle");
    } catch {
      // New facing mode not available — fall back to original
      setToggleError("Back camera not available on this device.");
      await startCamera(facingMode);
    }
  }

  function startRecording(): void {
    if (!streamRef.current) return;

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(
      streamRef.current,
      mimeType ? { mimeType } : {}
    );
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "video/webm",
      });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
      }
      setState("recorded");
    };

    recorder.start(250);
    startTimeRef.current = Date.now();
    setState("recording");
    setElapsed(0);

    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (secs >= maxDuration) {
        stopRecording();
      }
    }, 500);
  }

  function stopRecording(): void {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.stop();
  }

  async function handleUseRecording(): Promise<void> {
    if (!previewUrl) return;
    try {
      const r = await fetch(previewUrl);
      const blob = await r.blob();
      if (blob.size > 15 * 1024 * 1024) {
        setState("error");
        setErrorMessage("Video exceeds the 15 MB limit. Please record a shorter clip.");
        return;
      }
      onRecordingComplete(blob, elapsed);
    } catch {
      setState("error");
      setErrorMessage("Failed to process video. Please try again.");
    }
  }

  function handleRetake(): void {
    setPreviewUrl(null);
    setState("idle");
    setElapsed(0);
    void startCamera();
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-error" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <p className="text-sm text-foreground font-medium">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative bg-black rounded-card overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={state !== "recorded"}
          controls={state === "recorded"}
          className="w-full h-full object-cover"
        />
        {state === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded px-2 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-mono">{mm}:{ss}</span>
          </div>
        )}
        {state === "requesting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white text-sm">Requesting camera access…</p>
          </div>
        )}
      </div>

      {toggleError && (
        <p className="text-sm text-error bg-red-50 rounded-sm px-3 py-2">{toggleError}</p>
      )}

      <div className="flex gap-3">
        {state === "idle" && (
          <>
            <button
              type="button"
              onClick={handleToggleCamera}
              aria-label="Switch camera"
              className="flex items-center justify-center w-11 h-11 rounded-full border border-border bg-card text-muted hover:text-foreground transition-colors flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 7h-3a2 2 0 00-2-2H9a2 2 0 00-2 2H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                <circle cx="12" cy="13" r="3" />
                <path d="M8 7V5" />
              </svg>
            </button>
            <Button type="button" variant="primary" className="flex-1" onClick={startRecording}>
              Start Recording
            </Button>
          </>
        )}
        {state === "recording" && (
          <Button type="button" variant="danger" className="w-full" onClick={stopRecording}>
            Stop Recording
          </Button>
        )}
        {state === "recorded" && (
          <>
            <Button type="button" variant="secondary" className="flex-1" onClick={handleRetake}>
              Retake
            </Button>
            <Button type="button" variant="primary" className="flex-1" onClick={handleUseRecording}>
              Use This Video
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
