"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
import { toErrorKey, type ActionState } from "@/lib/errors";
import { LOGBOOK_ROLES, SUBSPECIALTIES } from "@/lib/constants";

// Training logbook and supervisor sign-off (migration 025).

const uuid = z.string().uuid();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const optionalInt = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d{0,4}$/)
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || v <= max);

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  procedure: z.string().trim().min(2).max(120),
  subspecialty: z.enum(SUBSPECIALTIES),
  role: z.enum(LOGBOOK_ROLES),
  cases: optionalInt(500),
  hours: optionalInt(48),
  hospital: optionalText(160),
  note: optionalText(500),
});

function done(): ActionState {
  revalidatePath("/[locale]/logbook", "page");
  revalidatePath("/[locale]/teams/[id]/logbook", "page");
  return { ok: true };
}

export async function addLogbookEntry(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };
  const { error } = await supabase.from("logbook_entries").insert({
    user_id: user.id,
    entry_date: v.date,
    procedure: v.procedure,
    subspecialty: v.subspecialty,
    role: v.role,
    cases_count: v.cases ?? 1,
    hours: v.hours,
    hospital_name: v.hospital,
    note: v.note,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("logbookAdded");
  return done();
}

export async function deleteLogbookEntry(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error, count } = await supabase.from("logbook_entries").delete({ count: "exact" }).eq("id", id.data);
  if (error) return { error: toErrorKey(error) };
  if (!count) return { error: "notAllowed" };
  await flash("logbookDeleted");
  return done();
}

const requestSchema = z.object({ ids: z.array(uuid).min(1).max(200), teamId: uuid });

/** Send the chosen entries to a team's supervisor for sign-off. */
export async function requestSignoff(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestSchema.safeParse({ ids: formData.getAll("ids"), teamId: formData.get("teamId") });
  if (!parsed.success) return { error: "invalid", message: "chooseEntries" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_logbook_signoff", { p_entries: parsed.data.ids, p_team: parsed.data.teamId });
  if (error) return { error: toErrorKey(error) };
  await flash("logbookRequested");
  return done();
}

const signSchema = z.object({
  ids: z.array(uuid).min(1).max(200),
  decision: z.enum(["sign", "return"]),
  note: z.string().trim().max(300).optional(),
});

/** Supervisor: sign the chosen entries, or return them with a note. */
export async function signEntries(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signSchema.safeParse({
    ids: formData.getAll("ids"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  if (v.decision === "return" && !v.note) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_logbook_entries", {
    p_entries: v.ids,
    p_sign: v.decision === "sign",
    p_note: v.note ?? null,
  });
  if (error) return { error: toErrorKey(error) };
  await flash(v.decision === "sign" ? "logbookSigned" : "logbookReturned");
  return done();
}
