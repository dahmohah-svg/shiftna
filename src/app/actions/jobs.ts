"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
import { toErrorKey, type ActionState } from "@/lib/errors";
import { JOB_KINDS, PAY_PERIODS } from "@/lib/constants";

// Job offers from hospital HR to doctors (migration 022). The database
// functions check who may send, answer or withdraw each offer.

const sendSchema = z
  .object({
    doctorId: z.string().uuid(),
    kind: z.enum(JOB_KINDS),
    shiftId: z.string().uuid().or(z.literal("")).optional(),
    title: z.string().trim().min(3).max(120),
    details: z.string().trim().max(2000).optional(),
    payEgp: z
      .string()
      .trim()
      .regex(/^\d{0,7}$/)
      .optional()
      .transform((v) => (v ? Number(v) : null)),
    payPeriod: z.enum(PAY_PERIODS).or(z.literal("")).optional(),
  })
  .refine((v) => v.kind !== "shift" || Boolean(v.shiftId), { path: ["shiftId"] })
  .refine((v) => v.payEgp === null || v.payEgp > 0, { path: ["payEgp"] });

export async function sendJobOffer(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("send_job_offer", {
    p_doctor: v.doctorId,
    p_kind: v.kind,
    p_shift: v.kind === "shift" ? v.shiftId || null : null,
    p_title: v.title,
    p_details: v.details || null,
    p_pay_egp: v.payEgp,
    // A shift offer is paid per shift unless said otherwise.
    p_pay_period: v.payEgp ? v.payPeriod || (v.kind === "shift" ? "shift" : "month") : null,
  });
  if (error || !id) return { error: toErrorKey(error) };

  await flash("jobOfferSent");
  revalidatePath("/", "layout");
  const locale = await getLocale();
  redirect({ href: `/jobs/${id}`, locale });
  return { ok: true };
}

const idSchema = z.string().uuid();

export async function respondJobOffer(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const accept = formData.get("accept") === "1";

  const supabase = await createClient();
  const { data: bookingId, error } = await supabase.rpc("respond_job_offer", {
    p_offer: id.data,
    p_accept: accept,
  });
  if (error) return { error: toErrorKey(error) };

  await flash(accept ? "jobOfferAccepted" : "jobOfferDeclined");
  revalidatePath("/", "layout");
  if (bookingId) {
    const locale = await getLocale();
    redirect({ href: `/bookings/${bookingId}`, locale });
  }
  return { ok: true };
}

export async function withdrawJobOffer(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_job_offer", { p_offer: id.data });
  if (error) return { error: toErrorKey(error) };
  await flash("jobOfferWithdrawn");
  revalidatePath("/", "layout");
  return { ok: true };
}
