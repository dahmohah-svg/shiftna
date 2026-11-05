"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
import { toErrorKey, type ActionState } from "@/lib/errors";
import { CITIES, REQUIRED_DOCS } from "@/lib/constants";

// Every admin action checks is_admin in the database (RLS / functions)
// and writes a row to audit_log.

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function adminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return null;
  return { supabase, adminId: user.id };
}

async function audit(
  ctx: NonNullable<Awaited<ReturnType<typeof adminClient>>>,
  action: string,
  targetTable: string,
  targetId: string,
  detail?: string | null,
) {
  await ctx.supabase.from("audit_log").insert({
    admin_id: ctx.adminId,
    action,
    target_table: targetTable,
    target_id: targetId,
    detail: detail ?? null,
  });
}

function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}

async function latestDocs(
  ctx: NonNullable<Awaited<ReturnType<typeof adminClient>>>,
  userId: string,
) {
  const { data } = await ctx.supabase
    .from("documents")
    .select("id, type, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const latest = new Map<string, { id: string; type: string; status: string }>();
  for (const d of data ?? []) if (!latest.has(d.type)) latest.set(d.type, d);
  return latest;
}

const approveSchema = z.object({
  userId: uuid,
  syndicateExpiry: date,
  licenseExpiry: date,
});

export async function approveDoctor(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = approveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const ctx = await adminClient();
  if (!ctx) return { error: "notAllowed" };
  const v = parsed.data;

  const latest = await latestDocs(ctx, v.userId);
  // All four documents must be uploaded and none of the latest rejected.
  if (REQUIRED_DOCS.some((t) => !latest.get(t) || latest.get(t)!.status === "rejected")) {
    return { error: "invalid" };
  }

  for (const type of REQUIRED_DOCS) {
    const doc = latest.get(type)!;
    if (doc.status === "approved") continue;
    const expires =
      type === "syndicate_card" ? v.syndicateExpiry : type === "license" ? v.licenseExpiry : null;
    const { error } = await ctx.supabase.rpc("admin_review_document", {
      p_doc: doc.id,
      p_approve: true,
      p_reason: "",
      ...(expires ? { p_expires_on: expires } : {}),
    });
    if (error) return { error: toErrorKey(error) };
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ status: "approved", suspended_reason: null })
    .eq("id", v.userId);
  if (error) return { error: toErrorKey(error) };
  await audit(ctx, "doctor_approved", "profiles", v.userId);
  await flash("doctorApproved");
  return done();
}

const rejectSchema = z.object({
  userId: uuid,
  reason: z.string().trim().min(3).max(500),
  types: z.array(z.enum(REQUIRED_DOCS)).min(1),
});

export async function rejectDoctor(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rejectSchema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
    types: formData.getAll("types"),
  });
  if (!parsed.success) return { error: "invalid" };
  const ctx = await adminClient();
  if (!ctx) return { error: "notAllowed" };
  const v = parsed.data;

  const latest = await latestDocs(ctx, v.userId);
  for (const type of v.types) {
    const doc = latest.get(type);
    if (!doc || doc.status === "rejected") continue;
    // admin_review_document writes its own audit row for each document.
    const { error } = await ctx.supabase.rpc("admin_review_document", {
      p_doc: doc.id,
      p_approve: false,
      p_reason: v.reason,
    });
    if (error) return { error: toErrorKey(error) };
  }
  await audit(ctx, "doctor_rejected", "profiles", v.userId, v.reason);
  await flash("doctorRejected");
  return done();
}

const hospitalSchema = z.object({
  name: z.string().trim().min(2).max(160),
  city: z.enum(CITIES),
  area: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  contact: z.string().trim().max(160).optional(),
  verified: z.literal("on").optional(),
});

export async function addHospital(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = hospitalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const ctx = await adminClient();
  if (!ctx) return { error: "notAllowed" };
  const v = parsed.data;
  const { data, error } = await ctx.supabase
    .from("hospitals")
    .insert({
      name: v.name,
      city: v.city,
      area: v.area || null,
      address: v.address || null,
      contact: v.contact || null,
      verified: v.verified === "on",
    })
    .select("id")
    .single();
  if (error || !data) return { error: toErrorKey(error) };
  await audit(ctx, "hospital_added", "hospitals", data.id, v.name);
  await flash("hospitalAdded");
  return done();
}

export async function setHospitalVerified(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  const verified = formData.get("verified") === "1";
  if (!id.success) return { error: "invalid" };
  const ctx = await adminClient();
  if (!ctx) return { error: "notAllowed" };
  const { error } = await ctx.supabase.from("hospitals").update({ verified }).eq("id", id.data);
  if (error) return { error: toErrorKey(error) };
  await audit(ctx, verified ? "hospital_verified" : "hospital_unverified", "hospitals", id.data);
  await flash("hospitalUpdated");
  return done();
}

const mergeSchema = z.object({ keepId: uuid, removeId: uuid });

/** Moves everything from one hospital onto another, then deletes it. */
export async function mergeHospitals(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = mergeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.keepId === parsed.data.removeId) return { error: "invalid" };
  const ctx = await adminClient();
  if (!ctx) return { error: "notAllowed" };
  // The database function checks is_admin and writes the audit log entry.
  const { error } = await ctx.supabase.rpc("merge_hospitals", {
    p_keep: parsed.data.keepId,
    p_remove: parsed.data.removeId,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("hospitalsMerged");
  return done();
}

export async function decideReport(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  const handled = formData.get("handled") === "1";
  if (!id.success) return { error: "invalid" };
  const ctx = await adminClient();
  if (!ctx) return { error: "notAllowed" };
  const { error } = await ctx.supabase
    .from("reports")
    .update({ status: handled ? "approved" : "rejected" })
    .eq("id", id.data);
  if (error) return { error: toErrorKey(error) };
  await audit(ctx, handled ? "report_handled" : "report_dismissed", "reports", id.data);
  await flash("reportHandled");
  return done();
}

export async function setPremium(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  const premium = formData.get("premium") === "1";
  if (!id.success) return { error: "invalid" };
  const ctx = await adminClient();
  if (!ctx) return { error: "notAllowed" };
  const { error } = await ctx.supabase.from("profiles").update({ is_premium: premium }).eq("id", id.data);
  if (error) return { error: toErrorKey(error) };
  await audit(ctx, premium ? "premium_on" : "premium_off", "profiles", id.data);
  await flash("premiumUpdated");
  return done();
}

export async function suspendDoctor(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "invalid" };
  const ctx = await adminClient();
  if (!ctx) return { error: "notAllowed" };
  if (id.data === ctx.adminId) return { error: "notAllowed" };
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ status: "suspended", suspended_reason: "admin" })
    .eq("id", id.data);
  if (error) return { error: toErrorKey(error) };
  await audit(ctx, "doctor_suspended", "profiles", id.data);
  await flash("accountPaused");
  return done();
}
