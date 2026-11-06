import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export const LOGBOOK_COLUMNS =
  "id, user_id, entry_date, procedure, role, subspecialty, cases_count, hours, hospital_name, note, verified, booking_id, sign_status, sign_team_id, signed_by, signed_at, sign_note, hospital:hospitals!logbook_entries_hospital_id_fkey(name)";

export type LogbookEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  procedure: string | null;
  role: string | null;
  subspecialty: string;
  cases_count: number | null;
  hours: number | null;
  hospital_name: string | null;
  note: string | null;
  verified: boolean;
  booking_id: string | null;
  sign_status: "none" | "requested" | "signed" | "returned";
  sign_team_id: string | null;
  signed_by: string | null;
  signed_at: string | null;
  sign_note: string | null;
  hospital: { name: string } | null;
};

/** Names for the people and teams an entry mentions. */
export async function logbookNames(supabase: Client, entries: LogbookEntry[]) {
  const people = [...new Set(entries.flatMap((e) => [e.signed_by, e.user_id]).filter(Boolean))] as string[];
  const teams = [...new Set(entries.map((e) => e.sign_team_id).filter(Boolean))] as string[];
  const [{ data: p }, { data: g }] = await Promise.all([
    people.length ? supabase.from("profiles").select("id, full_name, grade").in("id", people) : Promise.resolve({ data: [] }),
    teams.length ? supabase.from("groups").select("id, name").in("id", teams) : Promise.resolve({ data: [] }),
  ]);
  return {
    person: new Map((p ?? []).map((x) => [x.id, x as { id: string; full_name: string; grade: string | null }])),
    team: new Map((g ?? []).map((x) => [x.id, x.name as string])),
  };
}
