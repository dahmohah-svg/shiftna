import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Phone numbers the signed-in user may see: their own, everyone's for the
 * admin, and the other doctor's in a confirmed booking (if that doctor
 * allows it). The database decides (contact_phones, migration 018).
 */
export async function getContactPhones(
  supabase: SupabaseClient<Database>,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.rpc("contact_phones", { p_ids: unique });
  return new Map((data ?? []).map((r) => [r.user_id, r.phone]));
}
