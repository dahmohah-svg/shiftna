"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { toErrorKey, type ActionState } from "@/lib/errors";
import { CITIES } from "@/lib/constants";

const schema = z.object({
  name: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(z.string().min(3).max(120)),
  city: z.enum(CITIES),
  area: z.string().trim().max(120).optional(),
});

/** Escapes % and _ so a name can be matched exactly with ilike. */
function exact(v: string) {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Any approved doctor adds a hospital (unverified until the admin checks it),
 * then returns to the post form with it selected. If the hospital already
 * exists in that city, the existing one is selected instead.
 */
export async function addHospitalAsDoctor(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAllowed" };

  const { data: existing } = await supabase
    .from("hospitals")
    .select("id")
    .eq("city", v.city)
    .ilike("name", exact(v.name))
    .maybeSingle();

  let id = existing?.id;
  if (!id) {
    const { data, error } = await supabase
      .from("hospitals")
      .insert({ name: v.name, city: v.city, area: v.area || null, added_by: user.id, verified: false })
      .select("id")
      .single();
    if (error || !data) return { error: toErrorKey(error) };
    id = data.id;
  }

  revalidatePath("/", "layout");
  redirect({ href: `/post?hospital=${id}${existing ? "&existing=1" : ""}`, locale: await getLocale() });
  return { ok: true };
}
