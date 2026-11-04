import { createClient } from "@/lib/supabase/server";

function ics(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string): string {
  return s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
}

// "Add to calendar": a small .ics file for a confirmed booking.
export async function GET(
  _req: Request,
  { params }: RouteContext<"/[locale]/bookings/[id]/calendar">,
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, cancelled_at, shift:shifts!bookings_shift_id_fkey(start_at, duration_hours, hospital:hospitals!shifts_hospital_id_fkey(name, address))")
    .eq("id", id)
    .maybeSingle();
  const shift = booking?.shift;
  if (!booking || !shift || booking.cancelled_at) {
    return new Response("Not found", { status: 404 });
  }
  const start = new Date(shift.start_at);
  const end = new Date(start.getTime() + shift.duration_hours * 3600_000);
  const name = shift.hospital?.name ?? "Shift";
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shiftna//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@shiftna`,
    `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(start)}`,
    `DTEND:${ics(end)}`,
    `SUMMARY:${esc(`Shiftna: ${name}`)}`,
    shift.hospital?.address ? `LOCATION:${esc(shift.hospital.address)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="shiftna-${booking.id.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
