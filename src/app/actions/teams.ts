"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { flash } from "@/lib/flash";
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
  proofPath: z.string().max(300).optional(),
});

export async function createTeam(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };
  // Proof is optional; if given it must be in the doctor's own private folder.
  if (v.proofPath && !v.proofPath.startsWith(`${ctx.userId}/`)) return { error: "invalid" };

  const { data: teamId, error } = await ctx.supabase.rpc("create_group", {
    p_name: v.name,
    p_institution: v.institution,
    // The database accepts no hospital; the generated types do not say so.
    p_hospital: (v.hospitalId || null) as string,
    p_description: v.description || "",
    p_proof_path: v.proofPath || "",
  });
  if (error || !teamId) return { error: toErrorKey(error) };

  await flash("teamSubmitted");
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

  await flash(me?.status === "active" ? "teamJoined" : "joinRequested");
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
  await flash("memberUpdated");
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
  await flash("leftTeam");
  refresh();
  redirect({ href: "/teams", locale: await getLocale() });
  return { ok: true };
}

const teamStateSchema = z.object({
  teamId: uuid,
  action: z.enum(["verify", "unverify", "pause", "resume"]),
  reason: z.string().trim().max(500).optional(),
});

/** Admin: verify, remove verification, pause or resume a team (audit logged). */
export async function setTeamState(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = teamStateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  if (v.action === "pause" && (v.reason ?? "").length < 3) return { error: "invalid" };
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };

  const { error } = await ctx.supabase.rpc("admin_set_team", {
    p_group: v.teamId,
    p_action: v.action,
    p_reason: v.action === "pause" ? v.reason : undefined,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("teamReviewed");
  refresh();
  return { ok: true };
}

const memberSchema = z.object({ teamId: uuid, userId: uuid });

/** Manager makes a new invite code; the old code and link stop working. */
export async function renewInviteCode(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const teamId = uuid.safeParse(formData.get("teamId"));
  if (!teamId.success) return { error: "invalid" };
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };

  const { error } = await ctx.supabase.rpc("renew_invite_code", { p_group: teamId.data });
  if (error) return { error: toErrorKey(error) };
  await flash("codeRenewed");
  refresh();
  return { ok: true };
}

/** Manager puts back a doctor they removed or declined. */
export async function readdMember(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };

  const { error } = await ctx.supabase.rpc("readd_member", {
    p_group: parsed.data.teamId,
    p_user: parsed.data.userId,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("memberReadded");
  refresh();
  return { ok: true };
}

/** Manager lets a doctor who left ask to join again with the code. */
export async function allowRejoin(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const ctx = await signedIn();
  if (!ctx) return { error: "notAllowed" };

  const { error } = await ctx.supabase.rpc("allow_rejoin", {
    p_group: parsed.data.teamId,
    p_user: parsed.data.userId,
  });
  if (error) return { error: toErrorKey(error) };
  await flash("rejoinAllowed");
  refresh();
  return { ok: true };
}
