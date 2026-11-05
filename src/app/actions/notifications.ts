"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toErrorKey, type ActionState } from "@/lib/errors";
import { CITIES, MAX_ALERTS, SHIFT_TYPES, SUBSPECIALTIES } from "@/lib/constants";

/** Marks every unread notification of the signed-in user as read. */
export async function markAllRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
}

const optional = <T extends readonly [string, ...string[]]>(list: T) =>
  z
    .enum(list)
    .or(z.literal(""))
    .optional()
    .transform((v) => (v ? v : null));

const flag = z
  .union([z.literal("on"), z.literal("1")])
  .optional()
  .transform((v) => Boolean(v));

const alertSchema = z.object({
  city: optional(CITIES),
  type: optional(SHIFT_TYPES),
  subspecialty: optional(SUBSPECIALTIES),
  minPay: z
    .string()
    .trim()
    .regex(/^\d{0,7}$/)
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  immediateOnly: flag,
  urgentOnly: flag,
});

export async function createAlert(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = alertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };

  const row = {
    city: v.city,
    shift_type: v.type,
    subspecialty: v.subspecialty,
    min_pay_egp: v.minPay,
    immediate_only: v.immediateOnly,
    urgent_only: v.urgentOnly,
  };

  const { data: existing } = await supabase
    .from("saved_alerts")
    .select("city, shift_type, subspecialty, min_pay_egp, immediate_only, urgent_only")
    .eq("user_id", user.id);
  const mine = existing ?? [];
  if (mine.length >= MAX_ALERTS) return { error: "invalid", message: "tooManyAlerts" };
  const same = (a: Record<keyof typeof row, unknown>) =>
    (Object.keys(row) as (keyof typeof row)[]).every((k) => a[k] === row[k]);
  if (mine.some(same)) return { error: "invalid", message: "duplicateAlert" };

  const { error } = await supabase.from("saved_alerts").insert({ user_id: user.id, ...row });
  if (error) return { error: toErrorKey(error) };

  revalidatePath("/[locale]/notifications", "page");
  return { ok: true };
}

export async function deleteAlert(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.from("saved_alerts").delete().eq("id", id.data);
  if (error) return { error: toErrorKey(error) };

  revalidatePath("/[locale]/notifications", "page");
  return { ok: true };
}
