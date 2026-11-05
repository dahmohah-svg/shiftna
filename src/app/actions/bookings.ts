"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
import { toErrorKey, type ActionState } from "@/lib/errors";

const uuid = z.string().uuid();

/** Loads the booking and the caller's role in it, or null if not a party. */
async function loadBooking(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, shift:shifts!bookings_shift_id_fkey(id, hospital_id, poster_id, status)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return null;
  const role =
    booking.doctor_id === user.id ? "doctor" : booking.poster_id === user.id ? "poster" : null;
  if (!role) return null;
  return { supabase, booking, role, userId: user.id } as const;
}

function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markCompleted(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const ctx = await loadBooking(id.data);
  if (!ctx) return { error: "notYourBooking" };
  const { supabase, booking, role } = ctx;
  if (booking.cancelled_at) return { error: "alreadyCancelled" };

  const patch = role === "doctor" ? { doctor_completed: true } : { poster_completed: true };
  const { error } = await supabase.from("bookings").update(patch).eq("id", booking.id);
  if (error) return { error: toErrorKey(error) };

  // When both sides have confirmed, the poster closes the shift.
  const bothDone =
    (role === "doctor" || booking.doctor_completed) &&
    (role === "poster" || booking.poster_completed);
  if (bothDone && role === "poster") {
    await supabase.from("shifts").update({ status: "completed" }).eq("id", booking.shift_id);
  }
  await flash("markedCompleted");
  return done();
}

export async function setPaid(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  const paid = formData.get("paid") === "1";
  if (!id.success) return { error: "invalid" };
  const ctx = await loadBooking(id.data);
  if (!ctx || ctx.role !== "doctor") return { error: "notAllowed" };
  const { error } = await ctx.supabase
    .from("bookings")
    .update({ payment_status: paid ? "paid" : "pending" })
    .eq("id", ctx.booking.id);
  if (error) return { error: toErrorKey(error) };
  await flash("paymentUpdated");
  return done();
}

export async function markNoShow(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const ctx = await loadBooking(id.data);
  if (!ctx || ctx.role !== "poster") return { error: "notAllowed" };
  const { error } = await ctx.supabase
    .from("bookings")
    .update({ doctor_no_show: true })
    .eq("id", ctx.booking.id);
  if (error) return { error: toErrorKey(error) };
  await flash("noShowRecorded");
  return done();
}

const cancelSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(3).max(500),
});

export async function cancelBooking(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", {
    p_booking: parsed.data.id,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("bookingCancelled");
  return done();
}

const score = z.coerce.number().int().min(1).max(5);
const ratingSchema = z.object({
  id: uuid,
  s1: score,
  s2: score,
  s3: score,
  comment: z.string().trim().max(1000).optional(),
});

export async function submitRating(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ratingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const ctx = await loadBooking(parsed.data.id);
  if (!ctx) return { error: "notYourBooking" };
  const { supabase, booking, role, userId } = ctx;

  // Poster rates the doctor; doctor rates the hospital.
  const target =
    role === "poster"
      ? { to_user: booking.doctor_id, to_hospital: null }
      : { to_user: null, to_hospital: booking.shift?.hospital_id ?? null };
  if (!target.to_user && !target.to_hospital) return { error: "generic" };

  const { error } = await supabase.from("ratings").insert({
    booking_id: booking.id,
    from_user: userId,
    ...target,
    score_1: parsed.data.s1,
    score_2: parsed.data.s2,
    score_3: parsed.data.s3,
    comment: parsed.data.comment || null,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("ratingSubmitted");
  return done();
}

const reportSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(5).max(1000),
});

export async function fileReport(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const ctx = await loadBooking(parsed.data.id);
  if (!ctx) return { error: "notYourBooking" };
  const { error } = await ctx.supabase.from("reports").insert({
    booking_id: ctx.booking.id,
    reporter_id: ctx.userId,
    reason: parsed.data.reason,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("reportSent");
  return { ok: true };
}
