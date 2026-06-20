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

export interface ProviderFormCheckVideoRow {
  id: string;
  storage_path: string;
  created_at: string;
  exercise_name: string | null;
}

export async function saveProviderFormCheckVideo(
  patientId: string,
  exerciseId: string,
  storagePath: string
): Promise<{ id: string } | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { data: patientRow } = await auth.supabase
    .from("users")
    .select("id")
    .eq("id", patientId)
    .eq("provider_id", auth.userId)
    .single<{ id: string }>();

  if (!patientRow) return { error: "Patient not found or not assigned to you." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("videos")
    .insert({
      uploader_id: auth.userId,
      storage_path: storagePath,
      exercise_id: exerciseId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { error: error?.message ?? "Failed to save video metadata." };
  return { id: data.id };
}

export async function getProviderFormCheckVideosForPatient(
  patientId: string
): Promise<ProviderFormCheckVideoRow[] | { error: string }> {
  const auth = await requireRole("provider");
  if ("error" in auth) return auth;

  const { data: patientRow } = await auth.supabase
    .from("users")
    .select("id")
    .eq("id", patientId)
    .eq("provider_id", auth.userId)
    .single<{ id: string }>();

  if (!patientRow) return { error: "Patient not found or not assigned to you." };

  const admin = createAdminClient();

  const { data: sessionRow } = await admin
    .from("sessions_template")
    .select("id")
    .eq("patient_id", patientId)
    .eq("provider_id", auth.userId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (!sessionRow) return [];

  const { data: exercises, error: exerciseError } = await admin
    .from("exercises")
    .select("id, name, video_id")
    .eq("session_template_id", sessionRow.id);

  if (exerciseError) return { error: exerciseError.message };
  if (!exercises || exercises.length === 0) return [];

  const exerciseIds = exercises.map((e) => e.id as string);

  const { data: videos, error: videosError } = await admin
    .from("videos")
    .select("id, storage_path, created_at, exercise_id")
    .eq("uploader_id", auth.userId)
    .in("exercise_id", exerciseIds)
    .order("created_at", { ascending: false });

  if (videosError) return { error: videosError.message };

  const instructionalVideoIds = new Set(
    exercises
      .filter((e) => e.video_id)
      .map((e) => e.video_id as string)
  );

  const exerciseNameMap = new Map(
    exercises.map((e) => [e.id as string, e.name as string])
  );

  const formCheckVideos = (videos ?? []).filter(
    (v) => !instructionalVideoIds.has(v.id as string)
  );

  return formCheckVideos.map((v) => ({
    id: v.id as string,
    storage_path: v.storage_path as string,
    created_at: v.created_at as string,
    exercise_name: v.exercise_id ? (exerciseNameMap.get(v.exercise_id as string) ?? null) : null,
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

  // Phase 1: Fetch videos without join to include rows where exercise_id IS NULL
  const { data: videos, error } = await admin
    .from("videos")
    .select("id, storage_path, created_at, exercise_id")
    .eq("uploader_id", patientId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  // Phase 2: Extract distinct non-null exercise IDs and fetch exercise names
  const exerciseIds = [...new Set(
    (videos ?? [])
      .map((v) => (v.exercise_id as string | null))
      .filter((id): id is string => id !== null)
  )];

  let exerciseNameMap = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const { data: exercises, error: exerciseError } = await admin
      .from("exercises")
      .select("id, name")
      .in("id", exerciseIds);

    if (exerciseError) return { error: exerciseError.message };

    exerciseNameMap = new Map(
      (exercises ?? []).map((ex) => [ex.id as string, ex.name as string])
    );
  }

  // Phase 3: Map videos to PatientVideoRow, looking up exercise names
  return (videos ?? []).map((row) => ({
    id: row.id as string,
    storage_path: row.storage_path as string,
    created_at: row.created_at as string,
    exercise_name: row.exercise_id ? (exerciseNameMap.get(row.exercise_id as string) ?? null) : null,
  }));
}
