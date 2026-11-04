import type { Database } from "@/lib/supabase/database.types";

export type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
export type HospitalRow = Database["public"]["Tables"]["hospitals"]["Row"];

export type ShiftWithHospital = ShiftRow & {
  hospital: Pick<HospitalRow, "id" | "name" | "city" | "area" | "verified"> | null;
};

export const SHIFT_WITH_HOSPITAL =
  "*, hospital:hospitals!shifts_hospital_id_fkey(id, name, city, area, verified)" as const;

/** Same, but drops shifts whose hospital does not match a hospital filter. */
export const SHIFT_WITH_HOSPITAL_INNER =
  "*, hospital:hospitals!shifts_hospital_id_fkey!inner(id, name, city, area, verified)" as const;

const GRADE_RANK: Record<string, number> = {
  resident: 1,
  specialist: 2,
  consultant: 3,
};

/** Same rule as the database's grade_rank(): is my grade high enough? */
export function gradeAllows(myGrade: string | null, minGrade: string): boolean {
  return (GRADE_RANK[myGrade ?? ""] ?? 0) >= (GRADE_RANK[minGrade] ?? 0);
}

export function payPerHour(payEgp: number, hours: number): number {
  return Math.round(payEgp / Math.max(hours, 1));
}
