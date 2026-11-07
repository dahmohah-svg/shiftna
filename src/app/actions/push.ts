"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Saves this phone's push subscription for the signed-in user. */
export async function savePushSubscription(sub: unknown, locale: string): Promise<{ ok: boolean }> {
  const parsed = subSchema.safeParse(sub);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  // The same phone may have been used by another account: take it over.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: parsed.data.endpoint,
    user_id: user.id,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    locale: locale === "en" ? "en" : "ar",
  });
  return { ok: !error };
}

export async function deletePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const ep = z.string().url().max(1000).safeParse(endpoint);
  if (!ep.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", ep.data);
  return { ok: !error };
}
