import { z } from "zod";

/**
 * What Claude returns after reading the uploaded PDF. The Word file is built
 * from this by code (docx.ts), so the layout is identical on every list.
 */

// One item inside a bullet. Items are joined with " │ " in the Word file.
// flag: "pending" = yellow (missing/pending), "verify" = yellow + VERIFY,
// "critical" = bold red alert.
const Item = z.object({
  text: z.string(),
  flag: z.enum(["none", "pending", "verify", "critical"]),
});

const Patient = z.object({
  name: z.string(),
  age: z.string(),
  sex: z.string(),
  sexProvisional: z.boolean(),
  fileNo: z.string(),
  caseStatus: z.enum(["none", "CANCELLED", "DELIVERED"]),
  operation: z.string(),
  diagnosis: z.string(),
  sheetAvailable: z.boolean(),
  // 0-6 bullets; each bullet is a list of items.
  bullets: z.array(z.array(Item)),
});

const Room = z.object({
  heading: z.string(),
  // Number of patients the source list shows for this room (quality check).
  sourceCount: z.number(),
  patients: z.array(Patient),
});

export const PatientListSchema = z.object({
  hospital: z.string(),
  listTitle: z.string(),
  dayDate: z.string(),
  // dd/mm/yyyy, for the footer. Empty if the PDF gives no date.
  footerDate: z.string(),
  rooms: z.array(Room),
  // Flagged items for the doctor to review (one short line each).
  reviewItems: z.array(z.string()),
  // Problems that would have been asked about (unreadable pages, missing
  // room/patient/sheet). The list is still built.
  questions: z.array(z.string()),
});

export type PatientList = z.infer<typeof PatientListSchema>;
export type ListPatient = PatientList["rooms"][number]["patients"][number];
export type DetailItem = ListPatient["bullets"][number][number];

/** JSON schema for Claude's structured output. */
export function patientListJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(PatientListSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
