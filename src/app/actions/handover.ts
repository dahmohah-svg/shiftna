"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
import { toErrorKey, type ActionState } from "@/lib/errors";
import { HANDOVER_CONDITIONS } from "@/lib/constants";

// Case handover inside a team (migration 024). Row Level Security keeps
// handovers to the team's active members.

const uuid = z.string().uuid();
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const handoverSchema = z.object({
  teamId: uuid,
  patient: z.string().trim().min(1).max(120),
  age: z
    .string()
    .trim()
    .regex(/^\d{0,3}$/)
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || v <= 130),
  bed: text(40),
  diagnosis: text(300),
  condition: z.enum(HANDOVER_CONDITIONS),
  tasks: text(2000),
  notes: text(2000),
  toDoctorId: uuid.or(z.literal("")).optional(),
});

function done(): ActionState {
  revalidatePath("/[locale]/teams/[id]/handover", "page");
  return { ok: true };
}

export async function createHandover(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = handoverSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };
  const { error } = await supabase.from("team_handovers").insert({
    group_id: v.teamId,
    author_id: user.id,
    to_doctor_id: v.toDoctorId || null,
    patient: v.patient,
    age: v.age,
    bed: v.bed,
    diagnosis: v.diagnosis,
    condition: v.condition,
    tasks: v.tasks,
    notes: v.notes,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("handoverSent");
  return done();
}

export async function receiveHandover(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_handover", { p_handover: id.data });
  if (error) return { error: toErrorKey(error) };
  await flash("handoverReceived");
  return done();
}

export async function closeHandover(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const close = formData.get("close") !== "0";
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_handover", { p_handover: id.data, p_close: close });
  if (error) return { error: toErrorKey(error) };
  await flash(close ? "handoverClosed" : "handoverReopened");
  return done();
}

const commentSchema = z.object({ handoverId: uuid, body: z.string().trim().min(1).max(1000) });

export async function addHandoverComment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };
  const { error } = await supabase
    .from("handover_comments")
    .insert({ handover_id: parsed.data.handoverId, author_id: user.id, body: parsed.data.body });
  if (error) return { error: toErrorKey(error) };
  return done();
}
