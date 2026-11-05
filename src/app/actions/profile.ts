"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
import { toErrorKey, type ActionState } from "@/lib/errors";
import { ACCOUNT_TYPES, CITIES, DOC_TYPES, GRADES, SPECIALTIES } from "@/lib/constants";

const detailsSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,16}$/)
    .or(z.literal("")),
  // Account type, grade and specialty are locked once approved (the database keeps them).
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  grade: z.enum(GRADES).optional(),
  specialty: z.enum(SPECIALTIES).optional(),
  // Approved HR take the city of their hospital, so the form leaves it out.
  city: z.enum(CITIES).optional(),
  jobTitle: z.string().trim().min(2).max(120).optional(),
  hrHospital: z.string().trim().min(2).max(160).optional(),
});

export async function saveDetails(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };

  const v = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: v.fullName,
      phone: v.phone.replace(/\s/g, "") || null,
      ...(v.accountType ? { account_type: v.accountType } : {}),
      ...(v.accountType !== "hr" && v.grade ? { grade: v.grade } : {}),
      ...(v.accountType !== "hr" && v.specialty ? { specialty: v.specialty } : {}),
      ...(v.city ? { city: v.city } : {}),
      ...(v.jobTitle ? { job_title: v.jobTitle } : {}),
      ...(v.hrHospital ? { hr_hospital_name: v.hrHospital } : {}),
    })
    .eq("id", user.id);
  if (error) return { error: toErrorKey(error) };

  await flash("detailsSaved");
  revalidatePath("/", "layout");
  return { ok: true };
}

const docSchema = z.object({
  type: z.enum(DOC_TYPES),
  path: z.string().min(10).max(300),
});

/**
 * Records a document the browser just uploaded to the private bucket.
 * The path must sit inside the user's own folder.
 */
export async function recordDocument(
  type: string,
  path: string,
): Promise<ActionState> {
  const parsed = docSchema.safeParse({ type, path });
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };

  const safe = new RegExp(
    `^${user.id}/${parsed.data.type}-\\d+\\.(jpg|jpeg|png|webp|heic|pdf)$`,
  );
  if (!safe.test(parsed.data.path)) return { error: "invalid" };

  const { error } = await supabase.from("documents").insert({
    user_id: user.id,
    type: parsed.data.type,
    file_path: parsed.data.path,
  });
  if (error) return { error: toErrorKey(error) };

  await flash("documentUploaded");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Whether doctors I'm booked with can see my phone number. */
export async function setShowPhone(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const show = formData.get("show") === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };
  const { error } = await supabase.from("profiles").update({ show_phone: show }).eq("id", user.id);
  if (error) return { error: toErrorKey(error) };
  await flash("privacyUpdated");
  revalidatePath("/", "layout");
  return { ok: true };
}

const offersSchema = z.object({
  open: z.enum(["0", "1"]).optional(),
  note: z.string().trim().max(200).optional(),
});

/** Doctors: whether hospital HR can find them and send job offers, and what they look for. */
export async function setJobOffers(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = offersSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };
  const { error } = await supabase
    .from("profiles")
    .update({
      ...(parsed.data.open ? { open_to_offers: parsed.data.open === "1" } : {}),
      ...(parsed.data.note !== undefined ? { offer_note: parsed.data.note || null } : {}),
    })
    .eq("id", user.id);
  if (error) return { error: toErrorKey(error) };
  await flash("jobOffersUpdated");
  revalidatePath("/", "layout");
  return { ok: true };
}
