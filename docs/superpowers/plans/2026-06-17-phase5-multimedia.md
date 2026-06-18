# Phase 5 Multimedia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app video recording and secure playback so providers can attach instructional videos to exercises and patients can record form-check videos during session execution.

**Architecture:** Signed URL flow — server actions generate short-lived Supabase Storage signed URLs; the client uploads blobs directly to storage (bypassing Next.js); metadata is saved to the `videos` table via server action after upload. Playback uses on-the-fly signed download URLs. The `RecordVideo` and `VideoPlayer` primitives are shared by both provider and patient flows.

**Tech Stack:** MediaRecorder API (browser), Supabase Storage (`exercise-videos` bucket), `@supabase/supabase-js` storage client, Next.js App Router server actions, React client components.

## Global Constraints

- All server actions live in `"use server"` files under `lib/actions/`; always call `requireRole(...)` or `supabase.auth.getUser()` before touching data.
- All storage paths follow the pattern `${userId}/${uuid}.${ext}` — the first folder segment is the uploader's auth UID.
- Supabase Storage bucket name: `exercise-videos` (private, RLS enabled). **Must be created manually** in the Supabase dashboard before running Task 3+.
- Storage RLS policies use `TO authenticated` + ownership predicates — **never** `auth.role() = 'authenticated'` (deprecated per Supabase skill).
- The `video_id` column on `exercises` is for provider-attached instructional videos. The `exercise_id` column on `videos` is for patient form-check videos. Both exist in the same `videos` table.
- New exercises (`isNew: true` in `ExerciseFormItem`) do not have a DB row yet — video attachment is disabled for them with a tooltip explaining why.
- Error handling is fail-fast: show error message, let user retry. No retry logic, no offline queue.
- No `session_id` on videos — session-level video attaching is out of scope for this MVP.
- TypeScript strict mode: no `any`, explicit return types on all functions.
- Follow existing file patterns: check `lib/actions/auth.ts` for the `requireRole` pattern, `components/patient/ExerciseExecutor.tsx` for client component style.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20260617000001_phase5_multimedia.sql` | **Create** | Add `exercises.video_id`; storage RLS SQL (apply manually) |
| `lib/actions/videos.ts` | **Create** | Signed upload URL, metadata save, signed playback URL, attach instructional, provider/patient video queries |
| `components/shared/RecordVideo.tsx` | **Create** | MediaRecorder UI — camera preview, record/stop, timer, MIME negotiation |
| `components/shared/VideoPlayer.tsx` | **Create** | Fetch signed download URL on mount, render `<video>` |
| `components/provider/ExerciseVideoAttacher.tsx` | **Create** | Provider attaches/views instructional video per exercise row |
| `components/patient/PatientFormRecord.tsx` | **Create** | Patient records form-check video during session execution |
| `lib/types.ts` | **Modify** | Add `video_id: string \| null` to `Exercise` |
| `app/(dashboard)/provider/sessions/ExerciseList.tsx` | **Modify** | Add `video_id`, `video_storage_path` to `ExerciseFormItem`; render `ExerciseVideoAttacher` |
| `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx` | **Modify** | Expand exercise select to include `video_id` + joined `videos(storage_path)` |
| `components/patient/ExerciseExecutor.tsx` | **Modify** | Render `PatientFormRecord` per exercise |
| `app/(dashboard)/provider/patients/[patientId]/page.tsx` | **Modify** | Add parallel fetch for patient videos + render Videos section |
| `app/(dashboard)/provider/library/page.tsx` | **Modify** | Replace Videos placeholder with real list of provider-uploaded videos |

---

## Task 1: DB Migration + Type Update

**Files:**
- Create: `supabase/migrations/20260617000001_phase5_multimedia.sql`
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `Exercise.video_id: string | null` (used by Tasks 5, 6, 8, 9)
- Produces: storage RLS SQL ready to apply manually

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260617000001_phase5_multimedia.sql

-- Add instructional video FK to exercises
ALTER TABLE public.exercises
  ADD COLUMN video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL;

-- ============================================================
-- SUPABASE STORAGE CONFIGURATION
-- Apply the following manually via the Supabase Dashboard:
--
-- 1. Create a new Storage bucket named "exercise-videos"
--    - Public: false
--    - File size limit: 100 MB
--    - Allowed MIME types: video/mp4, video/webm
--
-- 2. Apply these RLS policies in the SQL editor:
-- ============================================================

-- Allow authenticated users to upload to their own folder
CREATE POLICY "exercise_videos_insert"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exercise-videos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- Allow authenticated users to read from their own folder
-- (signed URLs bypass this for cross-user access; this is defense-in-depth)
CREATE POLICY "exercise_videos_select"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'exercise-videos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
```

- [ ] **Step 2: Update `Exercise` type in `lib/types.ts`**

Find the `Exercise` interface and add `video_id`:

```typescript
export interface Exercise {
  id: string;
  session_template_id: string;
  name: string;
  sets: number;
  reps: number;
  patient_notes: string | null;
  sort_order: number;
  video_id: string | null;
}
```

- [ ] **Step 3: Apply migration manually**

In the Supabase Dashboard → SQL Editor, paste and run the migration SQL (the `ALTER TABLE` line only — storage policies go in the storage section if storage isn't available via SQL editor, or apply them after bucket creation).

Also create the `exercise-videos` bucket via Dashboard → Storage → New bucket.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/ish/Work/Tessera/Applications/moveable-mvp && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors (or same errors as before this change — baseline).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260617000001_phase5_multimedia.sql lib/types.ts
git commit -m "feat(multimedia): add exercises.video_id column and storage bucket setup"
```

---

## Task 2: Server Actions (`lib/actions/videos.ts`)

**Files:**
- Create: `lib/actions/videos.ts`

**Interfaces:**
- Consumes: `requireRole` from `lib/actions/auth.ts` → `Promise<{ supabase, userId } | { error: string }>`
- Produces:
  - `getUploadUrl(exerciseId?: string): Promise<{ url: string; storagePath: string } | { error: string }>`
  - `saveVideoMetadata(storagePath: string, exerciseId?: string): Promise<{ id: string } | { error: string }>`
  - `getSignedPlaybackUrl(storagePath: string): Promise<{ url: string } | { error: string }>`
  - `attachInstructionalVideo(exerciseId: string, videoId: string): Promise<{ ok: true } | { error: string }>`
  - `getProviderVideos(): Promise<ProviderVideoRow[] | { error: string }>`
  - `getPatientVideosForProvider(patientId: string): Promise<PatientVideoRow[] | { error: string }>`

- [ ] **Step 1: Create `lib/actions/videos.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/actions/auth";
import { randomUUID } from "crypto";

export interface ProviderVideoRow {
  id: string;
  storage_path: string;
  created_at: string;
  exercise_name: string | null;
}

export interface PatientVideoRow {
  id: string;
  storage_path: string;
  created_at: string;
  exercise_name: string | null;
}

export async function getUploadUrl(
  exerciseId?: string
): Promise<{ url: string; storagePath: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const ext = "mp4";
  const storagePath = `${user.id}/${randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("exercise-videos")
    .createSignedUploadUrl(storagePath);

  if (error || !data) return { error: error?.message ?? "Failed to create upload URL." };

  return { url: data.signedUrl, storagePath };
}

export async function saveVideoMetadata(
  storagePath: string,
  exerciseId?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data, error } = await supabase
    .from("videos")
    .insert({
      uploader_id: user.id,
      storage_path: storagePath,
      exercise_id: exerciseId ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { error: error?.message ?? "Failed to save video metadata." };
  return { id: data.id };
}

export async function getSignedPlaybackUrl(
  storagePath: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data, error } = await supabase.storage
    .from("exercise-videos")
    .createSignedUrl(storagePath, 3600);

  if (error || !data) return { error: error?.message ?? "Failed to generate playback URL." };
  return { url: data.signedUrl };
}

export async function attachInstructionalVideo(
  exerciseId: string,
  videoId: string
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { error } = await auth.supabase
    .from("exercises")
    .update({ video_id: videoId })
    .eq("id", exerciseId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function getProviderVideos(): Promise<
  ProviderVideoRow[] | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data, error } = await supabase
    .from("videos")
    .select("id, storage_path, created_at, exercises(name)")
    .eq("uploader_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  return (data ?? []).map((row) => ({
    id: row.id as string,
    storage_path: row.storage_path as string,
    created_at: row.created_at as string,
    exercise_name: (row.exercises as { name: string } | null)?.name ?? null,
  }));
}

export async function getPatientVideosForProvider(
  patientId: string
): Promise<PatientVideoRow[] | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { data, error } = await auth.supabase
    .from("videos")
    .select("id, storage_path, created_at, exercises(name)")
    .eq("uploader_id", patientId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  return (data ?? []).map((row) => ({
    id: row.id as string,
    storage_path: row.storage_path as string,
    created_at: row.created_at as string,
    exercise_name: (row.exercises as { name: string } | null)?.name ?? null,
  }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ish/Work/Tessera/Applications/moveable-mvp && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/videos.ts
git commit -m "feat(multimedia): add video server actions (upload URL, metadata, playback, queries)"
```

---

## Task 3: `RecordVideo` Component

**Files:**
- Create: `components/shared/RecordVideo.tsx`

**Interfaces:**
- Produces: `RecordVideoProps { onRecordingComplete: (blob: Blob, duration: number) => void; maxDuration?: number }` — used by Tasks 5, 7

- [ ] **Step 1: Create `components/shared/RecordVideo.tsx`**

```typescript
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
    navigator.mediaDevices?.getUserMedia &&
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ish/Work/Tessera/Applications/moveable-mvp && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/shared/RecordVideo.tsx
git commit -m "feat(multimedia): add RecordVideo component with MediaRecorder API"
```

---

## Task 4: `VideoPlayer` Component

**Files:**
- Create: `components/shared/VideoPlayer.tsx`

**Interfaces:**
- Consumes: `getSignedPlaybackUrl(storagePath: string): Promise<{ url: string } | { error: string }>` from `lib/actions/videos.ts`
- Produces: `VideoPlayerProps { storagePath: string; label?: string }` — used by Tasks 5, 8, 9

- [ ] **Step 1: Create `components/shared/VideoPlayer.tsx`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ish/Work/Tessera/Applications/moveable-mvp && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/shared/VideoPlayer.tsx
git commit -m "feat(multimedia): add VideoPlayer component with signed URL playback"
```

---

## Task 5: `ExerciseVideoAttacher` Component

**Files:**
- Create: `components/provider/ExerciseVideoAttacher.tsx`

**Interfaces:**
- Consumes: `RecordVideo` from `components/shared/RecordVideo.tsx`
- Consumes: `VideoPlayer` from `components/shared/VideoPlayer.tsx`
- Consumes: `getUploadUrl`, `saveVideoMetadata`, `attachInstructionalVideo` from `lib/actions/videos.ts`
- Consumes: `Modal` from `@/components/ui`
- Produces: `ExerciseVideoAttacherProps { exerciseId: string; videoStoragePath: string | null; onVideoAttached: (videoId: string, storagePath: string) => void }` — used in Task 6

- [ ] **Step 1: Create `components/provider/ExerciseVideoAttacher.tsx`**

```typescript
"use client";

import React, { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { RecordVideo } from "@/components/shared/RecordVideo";
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import {
  getUploadUrl,
  saveVideoMetadata,
  attachInstructionalVideo,
} from "@/lib/actions/videos";

type AttachState = "idle" | "uploading" | "error";

interface ExerciseVideoAttacherProps {
  exerciseId: string;
  videoStoragePath: string | null;
  onVideoAttached: (videoId: string, storagePath: string) => void;
}

export function ExerciseVideoAttacher({
  exerciseId,
  videoStoragePath,
  onVideoAttached,
}: ExerciseVideoAttacherProps): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const [attachState, setAttachState] = useState<AttachState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleRecordingComplete(blob: Blob): Promise<void> {
    setAttachState("uploading");
    setErrorMessage("");

    const uploadUrlResult = await getUploadUrl(exerciseId);
    if ("error" in uploadUrlResult) {
      setAttachState("error");
      setErrorMessage(uploadUrlResult.error);
      return;
    }

    const { url, storagePath } = uploadUrlResult;

    const uploadResponse = await fetch(url, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": blob.type || "video/mp4" },
    });

    if (!uploadResponse.ok) {
      setAttachState("error");
      setErrorMessage(`Upload failed (${uploadResponse.status}). Please try again.`);
      return;
    }

    const metaResult = await saveVideoMetadata(storagePath, exerciseId);
    if ("error" in metaResult) {
      setAttachState("error");
      setErrorMessage(metaResult.error);
      return;
    }

    const attachResult = await attachInstructionalVideo(exerciseId, metaResult.id);
    if ("error" in attachResult) {
      setAttachState("error");
      setErrorMessage(attachResult.error);
      return;
    }

    setAttachState("idle");
    setModalOpen(false);
    onVideoAttached(metaResult.id, storagePath);
  }

  return (
    <>
      <div className="mt-2">
        {videoStoragePath ? (
          <div className="flex flex-col gap-2">
            <VideoPlayer storagePath={videoStoragePath} label="Instructional video" />
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-xs text-primary text-left"
            >
              Replace video
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-sm text-primary font-medium"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Attach instructional video
          </button>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setAttachState("idle");
          setErrorMessage("");
        }}
        title="Record instructional video"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {attachState === "uploading" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted">Uploading video…</p>
            </div>
          ) : (
            <>
              <RecordVideo onRecordingComplete={handleRecordingComplete} />
              {attachState === "error" && (
                <p className="text-sm text-error bg-red-50 rounded-sm px-3 py-2">
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ish/Work/Tessera/Applications/moveable-mvp && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/provider/ExerciseVideoAttacher.tsx
git commit -m "feat(multimedia): add ExerciseVideoAttacher for provider instructional videos"
```

---

## Task 6: Update `ExerciseList` + Edit Session Page

Wire `ExerciseVideoAttacher` into each exercise row and load `video_id` + `storage_path` from the database on the edit page.

**Files:**
- Modify: `app/(dashboard)/provider/sessions/ExerciseList.tsx`
- Modify: `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx`

**Interfaces:**
- Consumes: `ExerciseVideoAttacher` from `components/provider/ExerciseVideoAttacher.tsx`
- Modifies: `ExerciseFormItem` — adds `video_id: string | null` and `video_storage_path: string | null`

- [ ] **Step 1: Add `video_id` and `video_storage_path` to `ExerciseFormItem`**

In `app/(dashboard)/provider/sessions/ExerciseList.tsx`, find the `ExerciseFormItem` interface and add two fields:

```typescript
export interface ExerciseFormItem {
  id: string;
  name: string;
  sets: number;
  reps: number;
  patient_notes: string;
  sort_order: number;
  isNew?: boolean;
  video_id: string | null;
  video_storage_path: string | null;
}
```

- [ ] **Step 2: Add `ExerciseVideoAttacher` import to `ExerciseList.tsx`**

At the top of `ExerciseList.tsx`, add the import after the existing imports:

```typescript
import { ExerciseVideoAttacher } from "@/components/provider/ExerciseVideoAttacher";
```

- [ ] **Step 3: Render `ExerciseVideoAttacher` inside `SortableRow`**

In `SortableRow`, add the attacher after the closing `</div>` of the patient notes `<div>` block (before the closing `</div>` of the outer container). The attacher is disabled for new exercises with a tooltip:

```typescript
      {item.isNew ? (
        <p className="text-xs text-muted">Save the exercise first to attach an instructional video.</p>
      ) : (
        <ExerciseVideoAttacher
          exerciseId={item.id}
          videoStoragePath={item.video_storage_path}
          onVideoAttached={(videoId, storagePath) =>
            onChange({ ...item, video_id: videoId, video_storage_path: storagePath })
          }
        />
      )}
```

Place this block inside `SortableRow`'s return, after the patient notes section (after the last `<div>` that wraps the textarea) and before the closing `</div>` of the outer container.

- [ ] **Step 4: Update `newExercise` in `SessionForm.tsx` to include new fields**

In `app/(dashboard)/provider/sessions/SessionForm.tsx`, find the `newExercise` function and add the two new fields:

```typescript
function newExercise(sortOrder: number): ExerciseFormItem {
  return {
    id: `new-${Date.now()}-${Math.random()}`,
    name: "",
    sets: 3,
    reps: 10,
    patient_notes: "",
    sort_order: sortOrder,
    isNew: true,
    video_id: null,
    video_storage_path: null,
  };
}
```

- [ ] **Step 5: Update the edit page to load `video_id` + storage path**

In `app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx`, update the `SessionRow` interface and the Supabase select query:

Replace the `SessionRow` interface with:

```typescript
interface SessionRow {
  id: string;
  name: string;
  patient_id: string;
  provider_notes: string | null;
  exercises: {
    id: string;
    name: string;
    sets: number;
    reps: number;
    patient_notes: string | null;
    sort_order: number;
    video_id: string | null;
    videos: { storage_path: string } | null;
  }[];
}
```

Replace the exercises select string:

```typescript
"id, name, patient_id, provider_notes, exercises(id, name, sets, reps, patient_notes, sort_order, video_id, videos(storage_path))"
```

Update the `exercises` mapping to include the new fields:

```typescript
  const exercises: ExerciseFormItem[] = (session.exercises ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ex) => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      patient_notes: ex.patient_notes ?? "",
      sort_order: ex.sort_order,
      video_id: ex.video_id,
      video_storage_path: ex.videos?.storage_path ?? null,
    }));
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /home/ish/Work/Tessera/Applications/moveable-mvp && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors (the `ExerciseFormItem` fields will now be required — any callers not setting them will error, fix those too).

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/provider/sessions/ExerciseList.tsx" \
        "app/(dashboard)/provider/sessions/SessionForm.tsx" \
        "app/(dashboard)/provider/sessions/[sessionId]/edit/page.tsx"
git commit -m "feat(multimedia): wire ExerciseVideoAttacher into exercise rows"
```

---

## Task 7: `PatientFormRecord` + `ExerciseExecutor` Update

**Files:**
- Create: `components/patient/PatientFormRecord.tsx`
- Modify: `components/patient/ExerciseExecutor.tsx`

**Interfaces:**
- Consumes: `RecordVideo` from `components/shared/RecordVideo.tsx`
- Consumes: `getUploadUrl`, `saveVideoMetadata` from `lib/actions/videos.ts`
- Consumes: `Modal`, `Button` from `@/components/ui`
- Produces: `PatientFormRecordProps { exerciseId: string }` — used in `ExerciseExecutor`

- [ ] **Step 1: Create `components/patient/PatientFormRecord.tsx`**

```typescript
"use client";

import React, { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { RecordVideo } from "@/components/shared/RecordVideo";
import { getUploadUrl, saveVideoMetadata } from "@/lib/actions/videos";

type RecordState = "idle" | "uploading" | "done" | "error";

interface PatientFormRecordProps {
  exerciseId: string;
}

export function PatientFormRecord({
  exerciseId,
}: PatientFormRecordProps): React.JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleRecordingComplete(blob: Blob): Promise<void> {
    setRecordState("uploading");
    setErrorMessage("");

    const uploadUrlResult = await getUploadUrl(exerciseId);
    if ("error" in uploadUrlResult) {
      setRecordState("error");
      setErrorMessage(uploadUrlResult.error);
      return;
    }

    const { url, storagePath } = uploadUrlResult;

    const uploadResponse = await fetch(url, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": blob.type || "video/mp4" },
    });

    if (!uploadResponse.ok) {
      setRecordState("error");
      setErrorMessage(`Upload failed (${uploadResponse.status}). Please try again.`);
      return;
    }

    const metaResult = await saveVideoMetadata(storagePath, exerciseId);
    if ("error" in metaResult) {
      setRecordState("error");
      setErrorMessage(metaResult.error);
      return;
    }

    setRecordState("done");
  }

  function handleClose(): void {
    setModalOpen(false);
    setRecordState("idle");
    setErrorMessage("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 text-sm text-muted font-medium mt-3"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        Record my form
      </button>

      <Modal
        isOpen={modalOpen}
        onClose={handleClose}
        title="Record your form"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {recordState === "uploading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted">Uploading video…</p>
            </div>
          )}

          {recordState === "done" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">Video saved!</p>
              <p className="text-sm text-muted">Your provider will be able to review your form.</p>
              <Button variant="primary" onClick={handleClose}>Done</Button>
            </div>
          )}

          {(recordState === "idle" || recordState === "error") && (
            <>
              <RecordVideo onRecordingComplete={handleRecordingComplete} />
              {recordState === "error" && (
                <p className="text-sm text-error bg-red-50 rounded-sm px-3 py-2">
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Add `PatientFormRecord` to `ExerciseExecutor`**

In `components/patient/ExerciseExecutor.tsx`, add the import after existing imports:

```typescript
import { PatientFormRecord } from "@/components/patient/PatientFormRecord";
```

Then, inside the exercise card `<div>` in the JSX, add `PatientFormRecord` after `<SetCircles>` and before the "exerciseDone" check:

```typescript
          <PatientFormRecord exerciseId={exercise.id} />
```

Place this line after the `patient_notes` conditional block and after `<SetCircles>`, but before the `{exerciseDone && (...)}` block.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/ish/Work/Tessera/Applications/moveable-mvp && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add components/patient/PatientFormRecord.tsx components/patient/ExerciseExecutor.tsx
git commit -m "feat(multimedia): add PatientFormRecord and wire into ExerciseExecutor"
```

---

## Task 8: Provider Patient Detail — Videos Section

Add a "Videos" section at the bottom of the patient detail page showing form-check videos the patient has uploaded.

**Files:**
- Modify: `app/(dashboard)/provider/patients/[patientId]/page.tsx`

**Interfaces:**
- Consumes: `VideoPlayer` from `components/shared/VideoPlayer.tsx`
- Consumes: `getPatientVideosForProvider(patientId: string)` from `lib/actions/videos.ts`

- [ ] **Step 1: Add video fetch + Videos section to patient detail page**

In `app/(dashboard)/provider/patients/[patientId]/page.tsx`:

1. Add imports at the top:

```typescript
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import { getPatientVideosForProvider } from "@/lib/actions/videos";
import type { PatientVideoRow } from "@/lib/actions/videos";
```

2. Add a fourth parallel fetch inside the `Promise.all`:

```typescript
  const [
    { data: patient },
    { data: assignedSession },
    { data: executions },
    videosResult,
  ] = await Promise.all([
    // ... existing three fetches unchanged ...
    getPatientVideosForProvider(patientId),
  ]);
```

3. Add the result handling after the `if (!patient) notFound();` line:

```typescript
  const patientVideos: PatientVideoRow[] =
    "error" in videosResult ? [] : videosResult;
```

4. Add the Videos section in the JSX, after the session history `<section>` and before the `RemovePatientButton`:

```typescript
      <section>
        <h2 className="text-base font-semibold text-foreground mb-2">
          Form-check videos ({patientVideos.length})
        </h2>
        {patientVideos.length === 0 ? (
          <div className="bg-card rounded-card shadow-card p-4">
            <p className="text-sm text-muted">
              No form-check videos yet. The patient can record their form during sessions.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {patientVideos.map((video) => (
              <div key={video.id} className="bg-card rounded-card shadow-card p-4">
                <VideoPlayer
                  storagePath={video.storage_path}
                  label={
                    video.exercise_name
                      ? `${video.exercise_name} · ${new Date(video.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : new Date(video.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ish/Work/Tessera/Applications/moveable-mvp && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/provider/patients/[patientId]/page.tsx"
git commit -m "feat(multimedia): add patient form-check Videos section to provider patient detail"
```

---

## Task 9: Provider Library — Videos Section

Replace the "Video library coming soon" placeholder with a real list of all videos the provider has uploaded.

**Files:**
- Modify: `app/(dashboard)/provider/library/page.tsx`

**Interfaces:**
- Consumes: `VideoPlayer` from `components/shared/VideoPlayer.tsx`
- Consumes: `getProviderVideos()` from `lib/actions/videos.ts`

- [ ] **Step 1: Update provider library page**

Replace the entire content of `app/(dashboard)/provider/library/page.tsx` with:

```typescript
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import { getProviderVideos } from "@/lib/actions/videos";
import type { ProviderVideoRow } from "@/lib/actions/videos";

interface ExerciseRow {
  id: string;
  name: string;
  sets: number;
  reps: number;
}

export default async function LibraryPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [exercisesResult, videosResult] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, sets, reps, sessions_template!inner(provider_id)")
      .eq("sessions_template.provider_id", user.id)
      .order("name"),
    getProviderVideos(),
  ]);

  const exercises = (exercisesResult.data ?? []) as ExerciseRow[];
  const videos: ProviderVideoRow[] = "error" in videosResult ? [] : videosResult;

  return (
    <div className="px-5 pt-10 pb-6 flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-foreground">Library</h1>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Exercises ({exercises.length})
        </h2>
        {exercises.length === 0 ? (
          <EmptyState
            title="No exercises yet"
            description="Exercises you add to session templates will appear here."
          />
        ) : (
          <div className="bg-card rounded-card shadow-card divide-y divide-border">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className="px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm text-foreground font-medium">
                  {ex.name}
                </span>
                <span className="text-xs text-muted">
                  {ex.sets}×{ex.reps}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Videos ({videos.length})
        </h2>
        {videos.length === 0 ? (
          <EmptyState
            title="No videos yet"
            description="Attach instructional videos to exercises in your session templates."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {videos.map((video) => (
              <div key={video.id} className="bg-card rounded-card shadow-card p-4">
                <VideoPlayer
                  storagePath={video.storage_path}
                  label={
                    video.exercise_name
                      ? `Exercise: ${video.exercise_name} · ${new Date(video.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : `Unlinked · ${new Date(video.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ish/Work/Tessera/Applications/moveable-mvp && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 3: Update PROGRESS.md**

Add a Phase 5 section to `PROGRESS.md` documenting what was built. (See existing sections for format.)

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/provider/library/page.tsx" PROGRESS.md
git commit -m "feat(multimedia): replace library Videos placeholder with real video list"
```

---

## Post-Implementation Checklist

After all tasks complete, verify these acceptance criteria manually:

- [ ] Provider can open a session template in edit mode, record a video for an existing exercise, and see the VideoPlayer appear inline after upload.
- [ ] New (unsaved) exercises show "Save the exercise first to attach an instructional video." instead of the camera button.
- [ ] Patient can tap "Record my form" during a session execution exercise, record a video, and see the success confirmation.
- [ ] Provider navigates to patient detail page and sees the "Form-check videos" section with the patient's uploaded videos playing via VideoPlayer.
- [ ] Provider library → Videos tab shows all provider-uploaded videos with exercise name labels.
- [ ] Recording permissions denial shows the error message (test by blocking camera in browser settings).
- [ ] TypeScript: `npx tsc --noEmit` passes with zero errors.
