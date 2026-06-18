-- Phase 6: Realtime Chat additions

-- 1. is_read column (DEFAULT false so existing rows are treated as unread-legacy)
ALTER TABLE public.messages
  ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;

-- 2. Enable Postgres Changes subscriptions on messages
--    Without this ALTER PUBLICATION, channel.on('postgres_changes', ...) fires nothing.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 3. Allow the receiver to mark messages as read.
--    The existing messages_access policy has WITH CHECK (sender_id = auth.uid()),
--    which blocks any UPDATE by the receiver. A dedicated policy is required.
CREATE POLICY messages_mark_read ON public.messages
  FOR UPDATE TO authenticated
  USING (receiver_id = (SELECT auth.uid()))
  WITH CHECK (receiver_id = (SELECT auth.uid()));

-- 4. Partial index for fast unread-count queries
--    (receiver_id, is_read) WHERE is_read = false avoids full-table scans.
CREATE INDEX idx_messages_unread ON public.messages(receiver_id, is_read)
  WHERE is_read = false;
