import { createClient } from "@/lib/supabase/server";
import { ZipArchive } from "archiver";
import { getExportStats, generatePdf } from "../lib";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as Record<string, unknown>).patientIds) ||
    (body as Record<string, unknown[]>).patientIds.length === 0 ||
    !(body as Record<string, unknown[]>).patientIds.every(
      (id) => typeof id === "string"
    )
  ) {
    return new Response(
      "Body must include a non-empty patientIds array of strings",
      { status: 400 }
    );
  }

  const patientIds = (body as { patientIds: string[] }).patientIds;

  const from = "2024-01-01";
  const to = new Date().toISOString().slice(0, 10);

  const pdfs: Array<{ id: string; buffer: Buffer }> = [];

  for (const patientId of patientIds) {
    const { data: patient } = await supabase
      .from("users")
      .select("id, email, created_at")
      .eq("id", patientId)
      .eq("provider_id", user.id)
      .single<{ id: string; email: string | null; created_at: string }>();

    if (!patient) continue;

    const stats = await getExportStats(supabase, patientId, from, to);
    const buffer = await generatePdf(patient, stats, from, to);
    pdfs.push({ id: patientId, buffer });
  }

  if (pdfs.length === 0) {
    return new Response("No accessible patients found", { status: 404 });
  }

  const zipBuffer = await buildZip(pdfs);

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="patients-export.zip"',
    },
  });
}

function buildZip(
  pdfs: Array<{ id: string; buffer: Buffer }>
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    for (const { id, buffer } of pdfs) {
      archive.append(buffer, { name: `patient-${id}-stats.pdf` });
    }

    archive.finalize().catch(reject);
  });
}
