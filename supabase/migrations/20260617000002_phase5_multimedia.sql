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
