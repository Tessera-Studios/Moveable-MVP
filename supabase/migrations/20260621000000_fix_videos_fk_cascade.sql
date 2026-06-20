-- Fix FK constraint on videos.exercise_id so that deleting an exercise
-- sets the column to NULL instead of blocking the delete (ON DELETE NO ACTION).
-- Matches the convention already on exercises.video_id (ON DELETE SET NULL).
ALTER TABLE public.videos
  DROP CONSTRAINT videos_exercise_id_fkey,
  ADD CONSTRAINT videos_exercise_id_fkey
    FOREIGN KEY (exercise_id)
    REFERENCES public.exercises(id)
    ON DELETE SET NULL;
