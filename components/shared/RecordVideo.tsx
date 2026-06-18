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
  maxDuration = 120,
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startCamera = useCallback(async (): Promise<void> => {
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
        video: { facingMode: "user" },
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
    void startCamera();
  }, [startCamera]);

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

  function handleUseRecording(): void {
    if (!previewUrl) return;
    const duration = elapsed;
    fetch(previewUrl)
      .then((r) => r.blob())
      .then((blob) => onRecordingComplete(blob, duration));
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

      <div className="flex gap-3">
        {state === "idle" && (
          <Button variant="primary" className="w-full" onClick={startRecording}>
            Start Recording
          </Button>
        )}
        {state === "recording" && (
          <Button variant="danger" className="w-full" onClick={stopRecording}>
            Stop Recording
          </Button>
        )}
        {state === "recorded" && (
          <>
            <Button variant="secondary" className="flex-1" onClick={handleRetake}>
              Retake
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleUseRecording}>
              Use This Video
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
