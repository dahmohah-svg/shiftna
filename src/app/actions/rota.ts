"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
import { toErrorKey, type ActionState } from "@/lib/errors";
import { ROTA_SLOTS } from "@/lib/constants";
import { daysOf, weekdayOf } from "@/lib/rota";

// Team rota (migration 023). Row Level Security and the database functions
// decide who may edit, publish, approve and swap.

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function done(): ActionState {
  revalidatePath("/[locale]/teams/[id]/rota", "page");
  return { ok: true };
}

const addSchema = z.object({
  teamId: uuid,
  month,
  doctorId: uuid,
  slot: z.enum(ROTA_SLOTS),
  from: date,
  to: date,
  // Weekdays to fill between the two dates (0 = Sunday); none means every day.
  days: z.array(z.coerce.number().int().min(0).max(6)).max(7),
});

/** Adds one duty, or the same duty on many days of the month. */
export async function addDuties(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addSchema.safeParse({
    teamId: formData.get("teamId"),
    month: formData.get("month"),
    doctorId: formData.get("doctorId"),
    slot: formData.get("slot"),
    from: formData.get("from"),
    to: formData.get("to") || formData.get("from"),
    days: formData.getAll("days"),
  });
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  if (v.to < v.from) return { error: "invalid" };

  const dates = daysOf(v.month).filter(
    (d) => d >= v.from && d <= v.to && (v.days.length === 0 || v.days.includes(weekdayOf(d))),
  );
  if (dates.length === 0) return { error: "invalid", message: "noDays" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };
  const { error } = await supabase.from("team_duties").upsert(
    dates.map((d) => ({ group_id: v.teamId, duty_date: d, slot: v.slot, doctor_id: v.doctorId, created_by: user.id })),
    { onConflict: "group_id,duty_date,slot,doctor_id", ignoreDuplicates: true },
  );
  if (error) return { error: toErrorKey(error) };
  await flash("dutiesAdded");
  return done();
}

export async function removeDuty(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error, count } = await supabase.from("team_duties").delete({ count: "exact" }).eq("id", id.data);
  if (error) return { error: toErrorKey(error) };
  if (!count) return { error: "notAllowed" };
  return done();
}

const monthSchema = z.object({ teamId: uuid, month });

/** Publishes the month, or sends it to the team's supervisor for approval. */
export async function submitRota(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = monthSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_rota", {
    p_group: parsed.data.teamId,
    p_month: `${parsed.data.month}-01`,
  });
  if (error) return { error: toErrorKey(error) };
  await flash(data === "published" ? "rotaPublished" : "rotaSubmitted");
  return done();
}

const decideSchema = z.object({
  teamId: uuid,
  month,
  approve: z.enum(["0", "1"]),
  note: z.string().trim().max(300).optional(),
});

/** Supervisor: approve the month, or return it with a note. */
export async function decideRota(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = decideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_rota", {
    p_group: v.teamId,
    p_month: `${v.month}-01`,
    p_approve: v.approve === "1",
    p_note: v.note ?? null,
  });
  if (error) return { error: toErrorKey(error) };
  await flash(v.approve === "1" ? "rotaPublished" : "rotaReturned");
  return done();
}

/** Team owner: make a member a supervisor, or stop. */
export async function setSupervisor(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ teamId: uuid, userId: uuid, on: z.enum(["0", "1"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_team_supervisor", {
    p_group: parsed.data.teamId,
    p_user: parsed.data.userId,
    p_on: parsed.data.on === "1",
  });
  if (error) return { error: toErrorKey(error) };
  await flash("memberUpdated");
  revalidatePath("/[locale]/teams/[id]", "page");
  return { ok: true };
}

const swapSchema = z.object({
  teamId: uuid,
  month,
  dutyId: uuid,
  targetId: uuid,
  targetDutyId: uuid.or(z.literal("")).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function requestSwap(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = swapSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_swap", {
    p_duty: v.dutyId,
    p_target: v.targetId,
    p_target_duty: v.targetDutyId || null,
    p_note: v.note ?? null,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("swapRequested");
  revalidatePath("/[locale]/teams/[id]/rota", "page");
  const locale = await getLocale();
  redirect({ href: `/teams/${v.teamId}/rota?month=${v.month}`, locale });
  return { ok: true };
}

const answerSchema = z.object({ id: uuid, yes: z.enum(["0", "1"]) });

/** The colleague accepts or declines a swap request. */
export async function answerSwap(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = answerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_swap", { p_swap: parsed.data.id, p_accept: parsed.data.yes === "1" });
  if (error) return { error: toErrorKey(error) };
  await flash(parsed.data.yes === "1" ? "swapAccepted" : "swapDeclined");
  return done();
}

/** A supervisor (or a manager when the team has none) approves or rejects a swap. */
export async function decideSwap(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = answerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_swap", { p_swap: parsed.data.id, p_approve: parsed.data.yes === "1" });
  if (error) return { error: toErrorKey(error) };
  await flash(parsed.data.yes === "1" ? "swapApproved" : "swapRejected");
  return done();
}

export async function cancelSwap(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_swap", { p_swap: id.data });
  if (error) return { error: toErrorKey(error) };
  await flash("swapCancelled");
  return done();
}
