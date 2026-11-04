import { cairoHour } from "@/lib/time";

/**
 * 24-hour strip: one box per hour of the day, filled for the hours the
 * shift covers (wrapping past midnight). Shifts over 24h fill the strip.
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
        {Array.from({ length: 24 }, (_, h) => (
          <span
            key={h}
            className={`h-2.5 flex-1 ${covered.has(h) ? "bg-brand-500" : "bg-line"}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-ink-muted" dir="ltr" aria-hidden>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}
