import { SLOT_HOURS, type RotaSlot } from "@/lib/constants";
import { cairoToday } from "@/lib/time";

/** "YYYY-MM" from a query value, or the current Cairo month. */
export function parseMonth(v: unknown): string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : cairoToday().slice(0, 7);
}

/** The first day of a "YYYY-MM" month, as YYYY-MM-DD. */
export function monthStart(month: string): string {
  return `${month}-01`;
}

export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Every date of a month, YYYY-MM-DD. */
export function daysOf(month: string): string[] {
  const end = Number(monthEnd(month).slice(8));
  return Array.from({ length: end }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** The Saturday that starts the (Egyptian, Saturday-to-Friday) week of a date. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const back = (d.getUTCDay() + 1) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export function monthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}

export function dayLabel(date: string, locale: string): { weekday: string; day: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const loc = locale === "ar" ? "ar-EG" : "en-GB";
  return {
    weekday: new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" }).format(d),
    day: new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", timeZone: "UTC" }).format(d),
  };
}

export type Duty = { id: string; duty_date: string; slot: RotaSlot; doctor_id: string; note: string | null };

/** Hours per doctor for the month, and the weeks where they pass the warning limit. */
export function hoursByDoctor(duties: Duty[], limit: number) {
  const out = new Map<string, { duties: number; hours: number; heavyWeeks: string[] }>();
  const weekly = new Map<string, number>();
  for (const d of duties) {
    const h = SLOT_HOURS[d.slot] ?? 0;
    const row = out.get(d.doctor_id) ?? { duties: 0, hours: 0, heavyWeeks: [] };
    row.duties += 1;
    row.hours += h;
    out.set(d.doctor_id, row);
    const key = `${d.doctor_id}|${weekStart(d.duty_date)}`;
    weekly.set(key, (weekly.get(key) ?? 0) + h);
  }
  for (const [key, h] of weekly) {
    if (h > limit) {
      const [doctor, week] = key.split("|");
      out.get(doctor)!.heavyWeeks.push(week);
    }
  }
  return out;
}
