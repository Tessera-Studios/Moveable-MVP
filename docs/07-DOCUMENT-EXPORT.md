# Phase 7: Document Export & Analytics

## Goals
- Implement server-side PDF generation for patient statistics
- Build data aggregation queries for compliance, pain, ease metrics
- Add export button to the Provider patient detail page
- Stream generated PDF as a secure download
- Ensure the document is a valid, properly formatted PDF

## Tech Stack
- PDFKit (Node.js PDF generation library)
- Next.js API Routes or Route Handlers
- Server-side data aggregation (SQL)

## API Route

### `GET /api/export/patient-stats?patientId=UUID&from=DATE&to=DATE`

**Flow:**
1. Authenticate the requesting user (must be a Provider)
2. Verify the Provider is linked to the specified patient
3. Fetch aggregate data from PostgreSQL
4. Build PDF document using PDFKit
5. Set response headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="patient-stats.pdf"`
6. Pipe the PDF stream to the response
7. Log the export for audit trail

```typescript
// src/app/api/export/patient-stats/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // 1. Authenticate
  const supabase = createServerClient(...);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // 2. Verify relationship
  const { data: patient } = await supabase
    .from("users")
    .select("provider_id")
    .eq("id", patientId)
    .single();
  if (patient?.provider_id !== user.id) return new Response("Forbidden", { status: 403 });

  // 3. Fetch aggregate data
  const stats = await getPatientStats(patientId, from, to);

  // 4. Generate PDF
  const pdfBuffer = await generatePdf(patient, stats);

  // 5. Return as downloadable PDF
  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${patientId}-stats.pdf"`,
    },
  });
}
```

## Data Aggregation

```typescript
async function getPatientStats(patientId: string, from: string, to: string) {
  const supabase = createServerClient(...);

  // Total sessions completed
  const { count: totalCompleted } = await supabase
    .from("session_executions")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .gte("completed_at", from)
    .lte("completed_at", to);

  // Average ease and pain scores
  const { data: avgScores } = await supabase
    .from("session_executions")
    .select("ease_score, pain_score, completed_at")
    .eq("patient_id", patientId)
    .eq("status", "completed")
    .gte("completed_at", from)
    .lte("completed_at", to);

  const avgEase = avgScores.reduce((a, s) => a + s.ease_score, 0) / avgScores.length;
  const avgPain = avgScores.reduce((a, s) => a + s.pain_score, 0) / avgScores.length;

  // Compliance rate (days completed / days in range)
  const daysInRange = differenceInDays(new Date(to), new Date(from)) + 1;
  const complianceRate = totalCompleted / daysInRange;

  // Current streak
  const streak = calculateStreak(patientId);

  return { totalCompleted, avgEase, avgPain, complianceRate, streak };
}
```

## PDF Generation

```typescript
import PDFDocument from "pdfkit";

async function generatePdf(patient: any, stats: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
    doc.fontSize(24).text("Move Able - Patient Progress Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Patient ID: ${patient.id}`);
    doc.text(`Report Period: ${stats.from} to ${stats.to}`);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`);
    doc.moveDown(2);

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Key Metrics
    doc.fontSize(18).text("Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(14);
    doc.text(`Total Sessions Completed: ${stats.totalCompleted}`);
    doc.text(`Current Streak: ${stats.streak} days`);
    doc.text(`Compliance Rate: ${(stats.complianceRate * 100).toFixed(1)}%`);
    doc.moveDown();

    // Scores
    doc.fontSize(18).text("Patient-Reported Scores", { underline: true });
    doc.moveDown();
    doc.fontSize(14);
    doc.text(`Average Ease Score (1-5): ${stats.avgEase.toFixed(1)}`);
    doc.text(`Average Pain Score (1-5): ${stats.avgPain.toFixed(1)}`);
    doc.moveDown(2);

    // Footer
    doc.fontSize(10).text("Confidential - For clinical use only", { align: "center" });

    doc.end();
  });
}
```

## PDF Template Content

The generated PDF should include:
1. **Header**: "Move Able - Patient Progress Report", generation date, report period
2. **Patient Info**: Patient ID, Provider name, date of birth (if available)
3. **Summary Metrics**:
   - Total sessions completed
   - Current daily streak
   - Compliance rate (percentage of days with completed sessions in the period)
4. **Score Analysis**:
   - Average ease score
   - Average pain score
   - Score trend (last 10 sessions comparison)
5. **Session Log** (optional for MVP): table of recent sessions with dates and scores

## Export Button (Provider UI)

Add to `/provider/patients/[patientId]`:

```tsx
"use client";

function ExportButton({ patientId }: { patientId: string }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(
        `/api/export/patient-stats?patientId=${patientId}&from=2024-01-01&to=${new Date().toISOString().split("T")[0]}`
      );
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patient-${patientId}-stats.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      // Show error toast
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button onClick={handleExport} isLoading={exporting}>
      Export Statistics to PDF
    </Button>
  );
}
```

## Compliance Considerations

The Move Able MVP does not implement formal HIPAA, GDPR, or other healthcare data compliance frameworks. The following are noted for future iterations:

- PDF exports contain patient-identifiable data (Patient ID, scores). In a production clinical setting, exports may require PII anonymization, audit trails, and access logging.
- The `export_logs` table (below) provides a basic audit trail foundation but is optional for MVP.
- No data encryption at rest is enforced beyond what Supabase provides by default. No BAAs (Business Associate Agreements) are assumed.

**For MVP**, the export feature is treated as a functional prototype. Compliance hardening is deferred until a正式的 production deployment.

## Audit Trail

For compliance, log each export:

```sql
CREATE TABLE public.export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.users(id),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  exported_at TIMESTAMPTZ DEFAULT now(),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL
);
```

Insert a log entry on each successful export. This is optional for MVP but important for production.

## Test Cases

### E2E: E2 — PDF export
Login as Provider, navigate to patient detail, click "Export to PDF". Assert response has status 200, `Content-Type: application/pdf`. Assert downloaded file is a valid PDF containing the patient's name/ID.

### Integration: Export authorization
Request the export API with an unauthenticated request → 401. Request with Provider B's session for Provider A's patient → 403.

### Integration: PDF content validation
Mock stats data. Call the PDF generation function. Assert output buffer starts with `%PDF` magic bytes. Assert text content includes expected metrics.

## Acceptance Criteria
- [ ] Provider can export patient stats as PDF from the patient detail page
- [ ] API route authenticates and authorizes the request
- [ ] PDF includes: patient ID, report period, total sessions, streak, compliance rate, average ease/pain scores
- [ ] PDF is a valid document (starts with `%PDF`, parsable by standard readers)
- [ ] Download triggers with correct filename and Content-Type
- [ ] Unauthorized requests are rejected with 401/403
- [ ] Export is logged for audit trail (optional for MVP)
