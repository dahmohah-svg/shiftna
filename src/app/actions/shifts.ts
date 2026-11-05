"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
import { toErrorKey, type ActionState } from "@/lib/errors";
import {
  GRADES,
  PAYMENT_TYPES,
  SHIFT_TYPES,
  SPECIALTIES,
  SUBSPECIALTIES,
  subspecialtiesFor,
  WORKLOADS,
} from "@/lib/constants";
import { cairoLocalToISO, nowMs } from "@/lib/time";

const uuid = z.string().uuid();
const bool = z
  .union([z.literal("on"), z.literal("1"), z.literal("true")])
  .optional()
  .transform((v) => Boolean(v));

const postSchema = z
  .object({
    hospitalId: uuid,
    type: z.enum(SHIFT_TYPES),
    startLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    durationHours: z.coerce.number().int().min(1).max(48),
    payEgp: z.coerce.number().int().min(1).max(1_000_000),
    payment: z.enum(PAYMENT_TYPES),
    paymentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal(""))
      .optional(),
    hasCallRoom: bool,
    foodProvided: bool,
    workload: z.enum(WORKLOADS),
    supportStaff: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(1000).optional(),
    urgent: bool,
    specialty: z.enum(SPECIALTIES),
    subspecialty: z.enum(SUBSPECIALTIES),
    minGrade: z.enum(GRADES),
    groupId: uuid.or(z.literal("")).optional(),
  })
  .refine((v) => v.payment === "immediate" || Boolean(v.paymentDate), {
    path: ["paymentDate"],
  })
  .refine((v) => (subspecialtiesFor(v.specialty) as readonly string[]).includes(v.subspecialty), {
    path: ["subspecialty"],
  });

export async function postShift(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const needsDate = parsed.error.issues.some((i) => i.path[0] === "paymentDate");
    return { error: "invalid", message: needsDate ? "paymentDateNeeded" : undefined };
  }
  const v = parsed.data;
  const startAt = cairoLocalToISO(v.startLocal);
  if (!startAt || new Date(startAt).getTime() < nowMs()) {
    return { error: "invalid", message: "startInPast" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };

  const { data, error } = await supabase
    .from("shifts")
    .insert({
      poster_id: user.id,
      hospital_id: v.hospitalId,
      type: v.type,
      start_at: startAt,
      duration_hours: v.durationHours,
      pay_egp: v.payEgp,
      payment: v.payment,
      payment_date: v.payment === "on_date" ? v.paymentDate || null : null,
      has_call_room: v.hasCallRoom,
      food_provided: v.foodProvided,
      workload: v.workload,
      support_staff: v.supportStaff || null,
      notes: v.notes || null,
      urgent: v.urgent,
      specialty: v.specialty,
      subspecialty: v.subspecialty,
      min_grade: v.minGrade,
      // Team-only shift; the database checks the poster is an active member.
      group_id: v.groupId || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: toErrorKey(error) };

  await flash("shiftPosted");
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: `/shifts/${data.id}`, locale });
  return { ok: true };
}

const offerSchema = z.object({
  shiftId: uuid,
  message: z.string().trim().max(500).optional(),
});

export async function sendOffer(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = offerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };

  const { error } = await supabase.from("offers").insert({
    shift_id: parsed.data.shiftId,
    doctor_id: user.id,
    message: parsed.data.message || null,
  });
  if (error) return { error: toErrorKey(error) };

  await flash("offerSent");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Small helper for one-button forms that only carry an id. */
function idFrom(formData: FormData, key = "id"): string | null {
  const parsed = uuid.safeParse(formData.get(key));
  return parsed.success ? parsed.data : null;
}

export async function withdrawOffer(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = idFrom(formData);
  if (!id) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("offers")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { error: toErrorKey(error) };
  await flash("offerWithdrawn");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function acceptOffer(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = idFrom(formData);
  if (!id) return { error: "invalid" };
  const supabase = await createClient();
  const { data: bookingId, error } = await supabase.rpc("accept_offer", {
    p_offer: id,
  });
  if (error || !bookingId) return { error: toErrorKey(error) };
  await flash("bookingConfirmed");
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: `/bookings/${bookingId}`, locale });
  return { ok: true };
}

export async function refuseOffer(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = idFrom(formData);
  if (!id) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("refuse_offer", { p_offer: id });
  if (error) return { error: toErrorKey(error) };
  await flash("offerDeclined");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cancelShift(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = idFrom(formData);
  if (!id) return { error: "invalid" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };
  const { error } = await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("poster_id", user.id)
    .eq("status", "open");
  if (error) return { error: toErrorKey(error) };
  await flash("shiftCancelled");
  revalidatePath("/", "layout");
  return { ok: true };
}
