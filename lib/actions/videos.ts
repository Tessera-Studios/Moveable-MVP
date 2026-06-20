"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  void exerciseId; // exerciseId influences metadata, not the storage path

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
  exerciseId: string
): Promise<{ id: string } | { error: string }> {
  if (!exerciseId) return { error: "exerciseId is required." };

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
      exercise_id: exerciseId,
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
    exercise_name: (row.exercises as unknown as { name: string } | null)?.name ?? null,
  }));
}

export async function getPatientVideosForProvider(
  patientId: string
): Promise<PatientVideoRow[] | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  // Verify the patient belongs to this provider before fetching their videos
  const { data: patientRow } = await auth.supabase
    .from("users")
    .select("id")
    .eq("id", patientId)
    .eq("provider_id", auth.userId)
    .single<{ id: string }>();

  if (!patientRow) return { error: "Patient not found or not assigned to you." };

  // Use admin client to bypass RLS — authorization already verified above
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("videos")
    .select("id, storage_path, created_at, exercises(name)")
    .eq("uploader_id", patientId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  return (data ?? []).map((row) => ({
    id: row.id as string,
    storage_path: row.storage_path as string,
    created_at: row.created_at as string,
    exercise_name: (row.exercises as unknown as { name: string } | null)?.name ?? null,
  }));
}
