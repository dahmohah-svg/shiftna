import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { buildDocx, cleanList, qualityCheck } from "@/lib/anaesthesia/docx";
import { SYSTEM_PROMPT, userInstruction } from "@/lib/anaesthesia/prompt";
import { PatientListSchema, patientListJsonSchema } from "@/lib/anaesthesia/schema";
import { PATIENT_LIST_BUCKET, PATIENT_LIST_MAX_BYTES } from "@/lib/constants";

// Reading a long PDF of patient sheets can take a few minutes.
export const maxDuration = 300;

const Body = z.object({
  path: z.string().min(1).max(300),
  notes: z.string().max(4000).default(""),
});

type Fail =
  | "notSignedIn"
  | "notApproved"
  | "invalid"
  | "notConfigured"
  | "fileMissing"
  | "fileTooBig"
  | "refused"
  | "tooLong"
  | "aiFailed"
  | "busy";

function fail(error: Fail, status: number) {
  return Response.json({ error }, { status });
}

/**
 * Takes a PDF the doctor uploaded to their own folder in the private
 * "patient-lists" bucket, reads it with Claude and returns the finished Word
 * file. The PDF is deleted straight after it is read; nothing is stored.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return fail("notSignedIn", 401);
  if (viewer.profile.status !== "approved") return fail("notApproved", 403);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid", 400);
  const { path, notes } = parsed.data;
  if (!path.startsWith(`${viewer.userId}/`) || !path.endsWith(".pdf") || path.includes("..")) {
    return fail("invalid", 400);
  }

  const supabase = await createClient();
  const storage = supabase.storage.from(PATIENT_LIST_BUCKET);

  let pdf: Buffer;
  try {
    const { data, error } = await storage.download(path);
    if (error || !data) return fail("fileMissing", 404);
    if (data.size > PATIENT_LIST_MAX_BYTES) return fail("fileTooBig", 413);
    pdf = Buffer.from(await data.arrayBuffer());
  } finally {
    // Patient data is never kept.
    await storage.remove([path]);
  }

  if (!process.env.ANTHROPIC_API_KEY) return fail("notConfigured", 503);
  const client = new Anthropic();

  let message: Anthropic.Beta.BetaMessage;
  try {
    message = await client.beta.messages
      .stream({
        model: "claude-opus-5-5",
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: {
          effort: "high",
          format: { type: "json_schema", schema: patientListJsonSchema() },
        },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
              },
              { type: "text", text: userInstruction(notes) },
            ],
          },
        ],
      })
      .finalMessage();
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return fail("busy", 429);
    if (error instanceof Anthropic.BadRequestError) return fail("fileTooBig", 413);
    console.error("anaesthesia-list: Claude request failed", error instanceof Anthropic.APIError ? error.status : "");
    return fail("aiFailed", 502);
  }

  if (message.stop_reason === "refusal") return fail("refused", 422);
  if (message.stop_reason === "max_tokens") return fail("tooLong", 422);

  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail("aiFailed", 502);
  }
  const result = PatientListSchema.safeParse(json);
  if (!result.success) return fail("aiFailed", 502);

  const list = cleanList(result.data);
  const docx = await buildDocx(list);
  const date = (list.footerDate || new Date().toLocaleDateString("en-GB")).replaceAll("/", "-");
  const title = (list.listTitle || "Anaesthesia List").replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

  return Response.json({
    fileName: `${title} ${date}.docx`,
    docx: docx.toString("base64"),
    rooms: list.rooms.map((r) => ({ heading: r.heading, count: r.patients.length })),
    reviewItems: list.reviewItems,
    questions: list.questions,
    qualityNotes: qualityCheck(list),
  });
}
