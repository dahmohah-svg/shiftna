import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Columns for a job offer with its hospital, the two people and the shift (if any). */
export const JOB_OFFER_COLUMNS =
  "id, kind, title, details, pay_egp, pay_period, status, created_at, responded_at, booking_id, shift_id, hr_id, doctor_id, " +
  "hospital:hospitals!job_offers_hospital_id_fkey(id, name, city), " +
  "doctor:profiles!job_offers_doctor_id_fkey(id, full_name, grade, specialty), " +
  "hr:profiles!job_offers_hr_id_fkey(id, full_name, job_title), " +
  "shift:shifts!job_offers_shift_id_fkey(id, start_at, duration_hours, status)";

export type JobOffer = {
  id: string;
  kind: string;
  title: string;
  details: string | null;
  pay_egp: number | null;
  pay_period: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  created_at: string;
  responded_at: string | null;
  booking_id: string | null;
  shift_id: string | null;
  hr_id: string;
  doctor_id: string;
  hospital: { id: string; name: string; city: string } | null;
  doctor: { id: string; full_name: string; grade: string | null; specialty: string } | null;
  hr: { id: string; full_name: string; job_title: string | null } | null;
  shift: { id: string; start_at: string; duration_hours: number; status: string } | null;
};

/** Job offers the user sent (HR) or received (doctor): waiting ones first, then the newest. */
export async function getMyJobOffers(supabase: Client, userId: string, limit = 30): Promise<JobOffer[]> {
  const { data } = await supabase
    .from("job_offers")
    .select(JOB_OFFER_COLUMNS)
    .or(`hr_id.eq.${userId},doctor_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as unknown as JobOffer[];
  return [...rows].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
}

export async function getJobOffer(supabase: Client, id: string): Promise<JobOffer | null> {
  const { data } = await supabase.from("job_offers").select(JOB_OFFER_COLUMNS).eq("id", id).maybeSingle();
  return (data as unknown as JobOffer | null) ?? null;
}

/** The hospital an approved HR account recruits for, if linked. */
export async function getMyHospital(
  supabase: Client,
  userId: string,
): Promise<{ id: string; name: string; city: string } | null> {
  const { data } = await supabase
    .from("hospital_staff")
    .select("hospital:hospitals!hospital_staff_hospital_id_fkey(id, name, city)")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.hospital as { id: string; name: string; city: string } | null) ?? null;
}
