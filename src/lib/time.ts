// All shift times are Cairo time, whatever the phone's time zone.
export const TZ = "Africa/Cairo";

/** Minutes Cairo is ahead of UTC at a given moment (handles summer time). */
function cairoOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT+03:00"
  const m = parts?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 120;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** "2026-11-05T20:00" typed in a form (Cairo time) -> ISO string in UTC. */
export function cairoLocalToISO(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes so the offset is right on summer-time change days.
  let offset = cairoOffsetMinutes(new Date(asUtc));
  offset = cairoOffsetMinutes(new Date(asUtc - offset * 60_000));
  return new Date(asUtc - offset * 60_000).toISOString();
}

/** Hour of day (0-23) in Cairo for an ISO time. */
export function cairoHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-GB").format(n);
}

/** Today's date in Cairo as YYYY-MM-DD. */
export function cairoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Current time in ms. Server pages render per request, so this is stable. */
export function nowMs(): number {
  return Date.now();
}
