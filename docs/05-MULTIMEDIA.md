# Phase 5: Multimedia Capture & Secure Storage Pipeline

## Scoping Decisions (pre-implementation Q&A)

| Question | Decision |
|---|---|
| Priority between instructional videos (provider) vs form-check videos (patient)? | Both equally — full pipeline for both flows |
| Upload error handling depth? | Simple fail-fast — show error on failure, let user re-record/retry manually. No retry backoff, no offline queue. |
| Where do patient form-check videos surface for the provider? | Dedicated "Videos" section at the bottom of the patient detail page, listed chronologically |
| Where do provider instructional videos appear? | Inline on the exercise list within the session template form |
| Provider library Videos tab scope? | All provider-uploaded videos with labels indicating what they're attached to |
| Session-level video attacher (`SessionVideoAttacher`)? | **Skipped for MVP** — exercise-level videos cover the core use case |

## Goals
- Implement in-app video recording using the MediaRecorder API
- Build a reusable `RecordVideo` component for both Provider and Patient
- Configure Supabase Storage buckets with RLS
- Implement direct client-to-storage uploads using signed URLs
- Build secure video playback components
- Link videos to exercises (instructional for Provider, form-check for Patient)
- ~~Link videos to sessions~~ — skipped for MVP (see Scoping Decisions)

## Supabase Storage Configuration

### Bucket: `exercise-videos`
```
Name: exercise-videos
Public: false
RLS: enabled
```

### Storage RLS Policies

```sql
-- Authenticated users can upload
CREATE POLICY upload_video ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND bucket_id = 'exercise-videos'
  );

-- Only linked participants can read
CREATE POLICY read_video ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exercise-videos'
    AND auth.role() = 'authenticated'
    AND (
      -- Check if user is uploader
      (storage.foldername(name))[1] = auth.uid()::text
      -- Or if user is linked via video metadata (checked at app layer)
    )
  );
```

> **Note**: For MVP, signed URLs provide the primary access control. The RLS policy on the `videos` table ensures metadata is protected. Storage-level RLS is defense-in-depth.

## Signed URL Flow

1. Client requests upload via Server Action `GET /api/storage/upload-url`
2. Server authenticates user, generates a signed upload URL:
   ```typescript
   const { data, error } = await supabase.storage
     .from("exercise-videos")
     .createSignedUploadUrl(`${userId}/${uuid}.mp4`);
   ```
3. Client uploads the video blob directly to the signed URL (bypasses Next.js server)
4. After upload completes, client calls Server Action to insert `videos` metadata record
5. For playback, Server Action generates a signed download URL on-the-fly:
   ```typescript
   const { data } = await supabase.storage
     .from("exercise-videos")
     .createSignedUrl(storagePath, 3600); // 1 hour expiry
   ```

## Components

### `RecordVideo`
A unified recording component usable by both Provider and Patient.

**Props:**
```typescript
interface RecordVideoProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  exerciseId?: string; // optional, to link video to an exercise
  sessionId?: string; // optional, to link video to a session
  maxDuration?: number; // seconds, default 120
  quality?: "720p" | "1080p";
}
```

**Implementation:**
```typescript
"use client";
// 1. Check for MediaRecorder support via feature detection
// 2. Request camera + microphone permissions: navigator.mediaDevices.getUserMedia()
// 3. Negotiate MIME type: prefer "video/mp4; codecs=avc1" for cross-platform compatibility
// 4. If not supported, fall back to "video/webm"
// 5. Instantiate MediaRecorder with stream and negotiated mimeType
// 6. Collect chunks via ondataavailable
// 7. On stop, concatenate chunks into single Blob
// 8. Call onRecordingComplete with the blob
```

**UI:**
- Camera preview (full-width, maintains aspect ratio)
- Record/Stop button (red circle, pulsing when recording)
- Timer display (mm:ss)
- Flash/Toggle camera buttons (optional for MVP)
- Error state when permissions denied or API unsupported

### `VideoPlayer`
Secure playback component.

**Props:**
```typescript
interface VideoPlayerProps {
  videoId: string; // UUID in videos table
  storagePath: string;
  exerciseId?: string;
}
```

**Implementation:**
- Fetches signed URL from Server Action on mount
- Renders `<video controls>` with the signed URL as source
- Handles loading, error (expired URL, access denied), and empty states
- Automatically refreshes signed URL if it expires during long viewing

### `ExerciseVideoAttacher`
Allows Providers to attach a video to an exercise (instructional video).

- Embedded in the exercise edit form
- Shows "Record Video" or "Choose from Library" options
- On completion, updates `exercises.video_id` (requires adding column) or links via `videos.exercise_id`

### `PatientFormRecord`
Allows patients to record themselves performing an exercise (form check).

- Shown alongside each exercise during execution
- "Record My Form" button opens RecordVideo in a modal
- Uploads and links video to the current exercise + patient
- Provider can view these in the patient detail page

### `SessionVideoAttacher`
Allows Providers to attach a video directly to a session (not tied to a specific exercise).

- Embedded in the session edit form
- Shows "Record Video" or "Choose from Library" options
- On completion, links video via `videos.session_id`

## MediaRecorder API Details

### Feature Detection
```typescript
function isRecordingSupported(): boolean {
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}
```

### MIME Type Negotiation
```typescript
function getSupportedMimeType(): string {
  const types = [
    "video/mp4; codecs=avc1",
    "video/webm; codecs=vp9,opus",
    "video/webm; codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}
```

### Recording Lifecycle
```
getUserMedia → stream → new MediaRecorder(stream, { mimeType })
  → recorder.start() → chunks[] on ondataavailable
  → recorder.stop() → onstop → new Blob(chunks, { type: mimeType })
  → URL.createObjectURL(blob) for preview
  → Upload to Supabase signed URL
  → Insert videos table metadata
```

## Upload Pipeline

```typescript
async function uploadVideo(blob: Blob): Promise<string> {
  // 1. Call server to get signed upload URL + storage path
  const { url, storagePath } = await getUploadUrl();

  // 2. Upload blob directly to Supabase Storage
  await fetch(url, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": blob.type },
  });

  // 3. Save metadata record
  await saveVideoMetadata({ storagePath, exerciseId });

  return storagePath;
}
```

## Error Handling

- **Permission denied**: show "Camera access required" message with instructions
- **Recording not supported**: show graceful degradation message, suggest using device's native camera app
- **Upload failure**: retry with exponential backoff (max 3 attempts), save blob locally as fallback
- **Storage quota exceeded**: show appropriate error
- **Network offline**: queue upload for when connection resumes

## Database Changes

Add optional video links to exercises and sessions:

```sql
ALTER TABLE public.exercises ADD COLUMN video_id UUID REFERENCES public.videos(id);

ALTER TABLE public.videos ADD COLUMN session_id UUID REFERENCES public.sessions_template(id);
```

The `session_id` column allows videos to be attached directly to a session (e.g., a general instructional video for the whole routine), independent of any specific exercise.

## Test Cases

### Unit: U4 — MediaRecorder graceful degradation
Mock `navigator.mediaDevices.getUserMedia` as `undefined`. Assert `isRecordingSupported()` returns false and UI shows fallback message.

### Integration: I1 — Video RLS isolation
Seed video owned by Patient A + Provider A. Query with Provider B's JWT — assert zero rows. Query with Patient A's JWT — assert video returned.

### Integration: Signed URL upload flow
Mock the signed URL endpoint. Assert upload goes directly to storage URL (not via Next.js server).

### Integration: Session-level video linking
Seed a video linked to a session via `session_id`. Query as the linked patient or provider — assert video is returned. Query as an unlinked user — assert zero rows.

## Acceptance Criteria
- [ ] `RecordVideo` component requests camera permissions and records video
- [ ] Recording uses optimal MIME type for the device
- [ ] Upload uses signed URL, bypassing the Next.js server
- [ ] Video metadata is saved to the `videos` table after upload
- [ ] `VideoPlayer` fetches signed URL and plays video securely
- [ ] Provider can attach instructional videos to exercises
- [ ] Patient can record form-check videos and link them to exercises
- [ ] Provider can view patient-submitted videos in patient detail
- [ ] Provider can attach videos directly to a session (not tied to an exercise)
- [ ] Session-linked videos are visible to both the patient and provider, isolated from others
- [ ] All states: loading, recording, uploading, error, fallback
