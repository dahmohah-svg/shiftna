import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Credibility levels, from the database function hospital_trust(). */
export const TRUST_LEVELS = ["verified", "trusted", "active", "new"] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export type HospitalTrust = {
  level: TrustLevel;
  shiftsPosted: number;
  posters: number;
  completed: number;
};

/** Credibility for several hospitals in one call, keyed by hospital id. */
export async function getHospitalTrust(
  supabase: SupabaseClient<Database>,
  ids: (string | null | undefined)[],
): Promise<Map<string, HospitalTrust>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, HospitalTrust>();
  if (unique.length === 0) return out;
  const { data } = await supabase.rpc("hospital_trust", { p_ids: unique });
  for (const r of data ?? []) {
    const level = (TRUST_LEVELS as readonly string[]).includes(r.level) ? (r.level as TrustLevel) : "new";
    out.set(r.hospital_id, {
      level,
      shiftsPosted: r.shifts_posted,
      posters: r.posters,
      completed: r.completed,
    });
  }
  return out;
}
