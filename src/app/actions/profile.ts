"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toErrorKey, type ActionState } from "@/lib/errors";
import { CITIES, GRADES, REQUIRED_DOCS } from "@/lib/constants";

const detailsSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,16}$/)
    .or(z.literal("")),
  grade: z.enum(GRADES),
  city: z.enum(CITIES),
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

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone.replace(/\s/g, "") || null,
      grade: parsed.data.grade,
      city: parsed.data.city,
    })
    .eq("id", user.id);
  if (error) return { error: toErrorKey(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

const docSchema = z.object({
  type: z.enum(REQUIRED_DOCS),
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

  revalidatePath("/", "layout");
  return { ok: true };
}
