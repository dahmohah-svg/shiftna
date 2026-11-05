import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Doctors whose Syndicate card, license and certificate are approved and current. */
export async function getVerifiedDoctors(
  supabase: SupabaseClient<Database>,
  ids: (string | null | undefined)[],
): Promise<Set<string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return new Set();
  const { data } = await supabase.rpc("doctors_verified", { p_ids: unique });
  return new Set((data ?? []).filter((r) => r.verified).map((r) => r.doctor_id));
}
