import { Moon } from "lucide-react";
import { cairoHour } from "@/lib/time";

/** Hours shown as night on the strip: 22:00 to 08:00 (Cairo time). */
const isNight = (h: number) => h >= 22 || h < 8;

/**
 * 24-hour strip: one box per hour of the day, filled for the hours the
 * shift covers (wrapping past midnight). Shifts over 24h fill the strip.
 * Night hours (22:00 to 08:00) are shaded darker, so night work is obvious.
 */
export default function ShiftStrip({
  startAt,
  hours,
  label,
}: {
  startAt: string;
  hours: number;
  label: string;
}) {
  const start = cairoHour(startAt);
  const covered = new Set<number>();
  for (let i = 0; i < Math.min(hours, 24); i++) covered.add((start + i) % 24);

  return (
    <div role="img" aria-label={label} className="flex flex-col gap-1">
      <div className="flex gap-px overflow-hidden rounded-md" dir="ltr">
        {Array.from({ length: 24 }, (_, h) => {
          const night = isNight(h);
          const cls = covered.has(h) ? (night ? "bg-night-on" : "bg-brand-500") : night ? "bg-night" : "bg-line";
          return <span key={h} className={`h-2.5 flex-1 ${cls}`} />;
        })}
      </div>
      <div className="relative flex justify-between text-[10px] text-ink-muted" dir="ltr" aria-hidden>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
        {/* Moon under the early-morning night hours (between 00 and 06). */}
        <Moon className="absolute top-0.5 h-2.5 w-2.5" style={{ left: "12.5%" }} strokeWidth={2.5} />
      </div>
    </div>
  );
}
