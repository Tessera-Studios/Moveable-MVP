import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";

interface ExportStats {
  totalCompleted: number;
  avgEase: number;
  avgPain: number;
  complianceRate: number;
  streak: number;
  recentSessions: Array<{
    completed_at: string;
    ease_score: number | null;
    pain_score: number | null;
  }>;
}

function calculateStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const dateSet = new Set(completedDates);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "UTC" });
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "UTC",
  });
  const startDate = dateSet.has(today) ? today : dateSet.has(yesterday) ? yesterday : null;
  if (!startDate) return 0;
  let streak = 0;
  const cursor = new Date(startDate + "T12:00:00Z");
  while (true) {
    const ds = cursor.toLocaleDateString("en-CA", { timeZone: "UTC" });
    if (!dateSet.has(ds)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

async function getExportStats(
  supabase: SupabaseClient,
  patientId: string,
  from: string,
  to: string
): Promise<ExportStats> {
  const { data: rows } = await supabase
    .from("session_executions")
    .select("completed_at, ease_score, pain_score")
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .gte("completed_at", from)
    .lte("completed_at", to + "T23:59:59Z")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  const sessions = (rows ?? []) as Array<{
    completed_at: string;
    ease_score: number | null;
    pain_score: number | null;
  }>;

  const totalCompleted = sessions.length;

  const easeRows = sessions.filter((s) => s.ease_score !== null);
  const painRows = sessions.filter((s) => s.pain_score !== null);
  const avgEase =
    easeRows.length > 0
      ? easeRows.reduce((sum, s) => sum + (s.ease_score as number), 0) / easeRows.length
      : 0;
  const avgPain =
    painRows.length > 0
      ? painRows.reduce((sum, s) => sum + (s.pain_score as number), 0) / painRows.length
      : 0;

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const daysInRange =
    Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const complianceRate = daysInRange > 0 ? totalCompleted / daysInRange : 0;

  const { data: allRows } = await supabase
    .from("session_executions")
    .select("completed_at")
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .not("completed_at", "is", null);

  const allDates = (allRows ?? []).map((r: { completed_at: string }) =>
    new Date(r.completed_at).toLocaleDateString("en-CA", { timeZone: "UTC" })
  );
  const streak = calculateStreak(allDates);

  return {
    totalCompleted,
    avgEase,
    avgPain,
    complianceRate,
    streak,
    recentSessions: sessions.slice(0, 10),
  };
}

async function generatePdf(
  patient: { id: string; email: string | null; created_at: string },
  stats: ExportStats,
  from: string,
  to: string
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
    doc
      .fontSize(22)
      .text("Move Able — Patient Progress Report", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(11)
      .fillColor("#666666")
      .text(
        `Generated: ${new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}`,
        { align: "center" }
      );
    doc.fillColor("#000000").moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(1);

    // Patient Info
    doc.fontSize(14).text("Patient Information");
    doc.moveDown(0.3);
    doc.fontSize(11);
    doc.text(`Email: ${patient.email ?? "Unknown"}`);
    doc.text(`Report Period: ${from} to ${to}`);
    doc.text(
      `Member Since: ${new Date(patient.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}`
    );
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(1);

    // Summary Metrics
    doc.fontSize(14).text("Summary");
    doc.moveDown(0.3);
    doc.fontSize(11);
    doc.text(`Total Sessions Completed: ${stats.totalCompleted}`);
    doc.text(`Current Daily Streak: ${stats.streak} day${stats.streak !== 1 ? "s" : ""}`);
    doc.text(`Compliance Rate: ${(stats.complianceRate * 100).toFixed(1)}%`);
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(1);

    // Score Analysis
    doc.fontSize(14).text("Patient-Reported Scores");
    doc.moveDown(0.3);
    doc.fontSize(11);
    if (stats.totalCompleted === 0) {
      doc.text("No sessions recorded in this period.");
    } else {
      doc.text(`Average Ease Score (1–5): ${stats.avgEase.toFixed(1)}`);
      doc.text(`Average Pain Score (1–5): ${stats.avgPain.toFixed(1)}`);
    }
    doc.moveDown(1);

    // Recent Sessions Log
    if (stats.recentSessions.length > 0) {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
      doc.moveDown(1);
      doc.fontSize(14).text("Recent Sessions (up to 10)");
      doc.moveDown(0.3);
      doc.fontSize(10);
      for (const s of stats.recentSessions) {
        const date = new Date(s.completed_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const ease = s.ease_score !== null ? `Ease ${s.ease_score}/5` : "—";
        const pain = s.pain_score !== null ? `Pain ${s.pain_score}/5` : "—";
        doc.text(`${date}   ${ease}   ${pain}`);
      }
      doc.moveDown(1);
    }

    // Footer
    doc.moveDown(2);
    doc
      .fontSize(9)
      .fillColor("#888888")
      .text("Confidential — For clinical use only", { align: "center" });

    doc.end();
  });
}

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
