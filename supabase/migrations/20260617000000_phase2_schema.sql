-- Phase 2: Authentication & Data Layer
-- Run this in the Supabase SQL Editor or via the CLI.

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('provider', 'patient');
CREATE TYPE execution_status AS ENUM ('pending', 'completed');

-- ============================================================
-- TABLES
-- ============================================================

-- users: extends auth.users with app-specific role and provider linkage
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  provider_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users
  ADD CONSTRAINT check_patient_has_provider
  CHECK (role != 'patient' OR provider_id IS NOT NULL);

-- invitation_codes: one-time tokens linking patients to providers
CREATE TABLE public.invitation_codes (
  code TEXT PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.users(id),
  is_consumed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_invitation_codes_provider ON public.invitation_codes(provider_id);

-- sessions_template: provider-authored exercise blueprints
CREATE TABLE public.sessions_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.users(id),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  name TEXT NOT NULL,
  provider_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- exercises: individual movements within a session template
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_template_id UUID NOT NULL REFERENCES public.sessions_template(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER NOT NULL CHECK (sets > 0),
  reps INTEGER NOT NULL CHECK (reps > 0),
  patient_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- session_executions: daily completed instances
CREATE TABLE public.session_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_template_id UUID NOT NULL REFERENCES public.sessions_template(id),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  status execution_status DEFAULT 'pending',
  ease_score INTEGER CHECK (ease_score BETWEEN 1 AND 5),
  pain_score INTEGER CHECK (pain_score BETWEEN 1 AND 5),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- videos: metadata for Supabase Storage objects
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES public.users(id),
  exercise_id UUID REFERENCES public.exercises(id),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- messages: chat log
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id),
  receiver_id UUID NOT NULL REFERENCES public.users(id),
  content TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_participants ON public.messages(sender_id, receiver_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GRANT TABLE ACCESS TO AUTHENTICATED ROLE
-- (required for Data API exposure)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitation_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions_template TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- users: own row + providers can read their patients
CREATE POLICY users_own ON public.users
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY users_provider_reads_patients ON public.users
  FOR SELECT
  TO authenticated
  USING (provider_id = (SELECT auth.uid()));

-- invitation_codes: providers manage their own codes; codes are readable for validation
CREATE POLICY invitation_codes_provider ON public.invitation_codes
  FOR ALL
  TO authenticated
  USING (provider_id = (SELECT auth.uid()))
  WITH CHECK (provider_id = (SELECT auth.uid()));

-- Allow any authenticated user to SELECT a code by its PK (for signup validation)
CREATE POLICY invitation_codes_read_for_signup ON public.invitation_codes
  FOR SELECT
  TO authenticated
  USING (true);

-- sessions_template: providers manage; patients read their own
CREATE POLICY sessions_provider ON public.sessions_template
  FOR ALL
  TO authenticated
  USING (provider_id = (SELECT auth.uid()))
  WITH CHECK (provider_id = (SELECT auth.uid()));

CREATE POLICY sessions_patient ON public.sessions_template
  FOR SELECT
  TO authenticated
  USING (patient_id = (SELECT auth.uid()));

-- exercises: cascade from session ownership
CREATE POLICY exercises_provider ON public.exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions_template
      WHERE id = session_template_id
        AND provider_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions_template
      WHERE id = session_template_id
        AND provider_id = (SELECT auth.uid())
    )
  );

CREATE POLICY exercises_patient ON public.exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions_template
      WHERE id = session_template_id
        AND patient_id = (SELECT auth.uid())
    )
  );

-- session_executions: patients manage their own; providers read their patients'
CREATE POLICY executions_patient ON public.session_executions
  FOR ALL
  TO authenticated
  USING (patient_id = (SELECT auth.uid()))
  WITH CHECK (patient_id = (SELECT auth.uid()));

CREATE POLICY executions_provider ON public.session_executions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions_template
      WHERE id = session_template_id
        AND provider_id = (SELECT auth.uid())
    )
  );

-- videos: uploader + linked session participants
CREATE POLICY videos_access ON public.videos
  FOR ALL
  TO authenticated
  USING (
    uploader_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.exercises e
      JOIN public.sessions_template s ON e.session_template_id = s.id
      WHERE e.id = exercise_id
        AND (s.patient_id = (SELECT auth.uid()) OR s.provider_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (uploader_id = (SELECT auth.uid()));

-- messages: only sender and receiver
CREATE POLICY messages_access ON public.messages
  FOR ALL
  TO authenticated
  USING (
    sender_id = (SELECT auth.uid()) OR receiver_id = (SELECT auth.uid())
  )
  WITH CHECK (sender_id = (SELECT auth.uid()));
