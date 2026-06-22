import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getExportStats, generatePdf } from "../lib";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!patientId || !from || !to) {
    return new Response("Missing required query parameters", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: patient } = await supabase
    .from("users")
    .select("id, email, created_at, provider_id")
    .eq("id", patientId)
    .eq("provider_id", user.id)
    .single<{
      id: string;
      email: string | null;
      created_at: string;
      provider_id: string | null;
    }>();

  if (!patient) return new Response("Forbidden", { status: 403 });

  const stats = await getExportStats(supabase, patientId, from, to);
  const pdfBuffer = await generatePdf(patient, stats, from, to);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${patientId}-stats.pdf"`,
    },
  });
}
