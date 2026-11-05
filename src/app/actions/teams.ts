"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { toErrorKey, type ActionState } from "@/lib/errors";

// "Teams" in the app are the private groups from migration 003. Every rule
// (Premium, approval, managers only) is enforced by the database functions.

const uuid = z.string().uuid();

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

const createSchema = z.object({
  name: z.string().trim().min(3).max(80),
  institution: z.string().trim().min(2).max(120),
  hospitalId: uuid.or(z.literal("")).optional(),
  description: z.string().trim().max(500).optional(),
  proofPath: z.string().min(5).max(300),
});

export async function createTeam(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const noProof = parsed.error.issues.some((i) => i.path[0] === "proofPath");
    return { error: "invalid", message: noProof ? "proofNeeded" : undefined };
  }
  const v = parsed.data;
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };
  // The proof must be a file the doctor uploaded to their own private folder.
  if (!v.proofPath.startsWith(`${ctx.userId}/`)) return { error: "invalid" };

  const { data: teamId, error } = await ctx.supabase.rpc("create_group", {
    p_name: v.name,
    p_institution: v.institution,
    // The database accepts no hospital; the generated types do not say so.
    p_hospital: (v.hospitalId || null) as string,
    p_description: v.description || "",
    p_proof_path: v.proofPath,
  });
  if (error || !teamId) return { error: toErrorKey(error) };

  refresh();
  redirect({ href: `/teams/${teamId}`, locale: await getLocale() });
  return { ok: true };
}

const codeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{6,20}$/);

export async function joinTeam(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) return { error: "invalidCode" };
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };

  const { data: teamId, error } = await ctx.supabase.rpc("request_to_join", { p_code: code.data });
  if (error || !teamId) return { error: toErrorKey(error) };

  const { data: me } = await ctx.supabase
    .from("group_members")
    .select("status")
    .eq("group_id", teamId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  refresh();
  if (me?.status === "active") {
    redirect({ href: `/teams/${teamId}`, locale: await getLocale() });
  }
  return { ok: true, message: "requestSent" };
}

const decideSchema = z.object({
  teamId: uuid,
  userId: uuid,
  accept: z.enum(["1", "0"]),
});

/** Manager accepts or declines a join request, or removes a member. */
export async function decideMember(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = decideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };

  const { error } = await ctx.supabase.rpc("decide_member", {
    p_group: parsed.data.teamId,
    p_user: parsed.data.userId,
    p_accept: parsed.data.accept === "1",
  });
  if (error) return { error: toErrorKey(error) };
  refresh();
  return { ok: true };
}

export async function leaveTeam(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const teamId = uuid.safeParse(formData.get("teamId"));
  if (!teamId.success) return { error: "invalid" };
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };

  const { error } = await ctx.supabase.rpc("leave_group", { p_group: teamId.data });
  if (error) return { error: toErrorKey(error) };
  refresh();
  redirect({ href: "/teams", locale: await getLocale() });
  return { ok: true };
}

const reviewSchema = z.object({
  teamId: uuid,
  approve: z.enum(["1", "0"]),
  reason: z.string().trim().max(500).optional(),
});

/** Admin approves or rejects a new team (writes to the audit log). */
export async function reviewTeam(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const approve = parsed.data.approve === "1";
  if (!approve && (parsed.data.reason ?? "").length < 3) return { error: "invalid" };
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };

  const { error } = await ctx.supabase.rpc("admin_review_group", {
    p_group: parsed.data.teamId,
    p_approve: approve,
    p_reason: approve ? "" : parsed.data.reason!,
  });
  if (error) return { error: toErrorKey(error) };
  refresh();
  return { ok: true };
}
