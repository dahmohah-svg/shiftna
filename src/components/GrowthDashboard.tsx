import { getTranslations } from "next-intl/server";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ColumnChart, LineChart, RankedBars } from "./GrowthCharts";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/time";
import type { City } from "@/lib/constants";

/** Period choices for the dashboard, in weeks. */
export const GROWTH_RANGES = [4, 12, 26] as const;

type Summary = {
  doctors_approved: number;
  doctors_pending: number;
  open_shifts_now: number;
  hospitals_verified: number;
  hospitals_unverified: number;
  teams_active: number;
  median_hours_to_fill: number | null;
  cities: { city: string; shifts: number }[];
};

function StatTile({
  label,
  value,
  note,
  delta,
}: {
  label: string;
  value: string;
  note?: string;
  /** Change vs the previous period; good says whether this direction is good. */
  delta?: { text: string; dir: "up" | "down" | "flat"; good: boolean | null };
}) {
  const Icon = delta?.dir === "up" ? ArrowUpRight : delta?.dir === "down" ? ArrowDownRight : Minus;
  const tone = !delta || delta.good === null ? "text-ink-muted" : delta.good ? "text-emerald-700" : "text-red-700";
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-3xl font-bold text-ink">{value}</span>
      {delta ? (
        <span className={`flex items-center gap-1 text-xs font-semibold ${tone}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {delta.text}
        </span>
      ) : null}
      {note ? <span className="text-xs text-ink-muted">{note}</span> : null}
    </div>
  );
}

export default async function GrowthDashboard({ locale, weeks }: { locale: string; weeks: number }) {
  const t = await getTranslations("Growth");
  const o = await getTranslations("Options");
  const supabase = await createClient();
  const n = (x: number) => formatNumber(x, locale);
  const pct = (x: number) => `${formatNumber(Math.round(x), locale)}%`;
  const hrs = (x: number) => t("hours", { n: formatNumber(Math.round(x * 10) / 10, locale) });

  // Twice the period, so every headline number can compare with the period before.
  const [{ data: rows, error }, { data: rawSummary }] = await Promise.all([
    supabase.rpc("admin_growth", { p_weeks: weeks * 2 }),
    supabase.rpc("admin_growth_summary", { p_weeks: weeks }),
  ]);
  if (error || !rows) return <p className="text-sm text-ink-muted">{t("unavailable")}</p>;

  const all = rows;
  const cur = all.slice(-weeks);
  const prev = all.slice(0, Math.max(0, all.length - weeks));
  const sum = (list: typeof all, k: "signups" | "shifts_posted" | "shifts_filled" | "completed" | "cancelled") =>
    list.reduce((a, r) => a + (r[k] ?? 0), 0);
  const summary = (rawSummary ?? {}) as Partial<Summary>;

  const labels = cur.map((r) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${r.week_start}T00:00:00Z`),
    ),
  );

  const change = (
    now: number,
    before: number,
    upIsGood: boolean,
    unit: "count" | "points" = "count",
    against: string = t("vsPrevious"),
  ) => {
    const diff = now - before;
    const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    const shown = unit === "points" ? t("points", { n: n(Math.abs(Math.round(diff))) }) : n(Math.abs(diff));
    return {
      text: diff === 0 ? t("noChange") : `${diff > 0 ? "+" : "−"}${shown} ${against}`,
      dir: dir as "up" | "down" | "flat",
      good: diff === 0 ? null : (diff > 0) === upIsGood,
    };
  };

  const thisWeek = cur[cur.length - 1];
  const lastWeek = cur[cur.length - 2];
  const posted = sum(cur, "shifts_posted");
  const filled = sum(cur, "shifts_filled");
  const postedPrev = sum(prev, "shifts_posted");
  const filledPrev = sum(prev, "shifts_filled");
  const fillRate = posted ? (filled / posted) * 100 : 0;
  const fillRatePrev = postedPrev ? (filledPrev / postedPrev) * 100 : 0;
  const signups = sum(cur, "signups");

  return (
    <section className="flex flex-col gap-4">
      {/* One filter row, above everything it scopes. */}
      <nav className="flex gap-2" aria-label={t("range")}>
        {GROWTH_RANGES.map((w) => (
          <Link
            key={w}
            href={`/admin?tab=growth&weeks=${w}`}
            aria-current={w === weeks ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${w === weeks ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-ink-muted"}`}
          >
            {t("lastWeeks", { count: w, n: n(w) })}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label={t("activeThisWeek")}
          value={n(thisWeek?.active_doctors ?? 0)}
          delta={lastWeek ? change(thisWeek.active_doctors, lastWeek.active_doctors, true, "count", t("vsLastWeek")) : undefined}
        />
        <StatTile
          label={t("doctors")}
          value={n(summary.doctors_approved ?? 0)}
          note={t("doctorsNote", { pending: n(summary.doctors_pending ?? 0), signups: n(signups) })}
        />
        <StatTile label={t("shiftsPosted")} value={n(posted)} delta={change(posted, postedPrev, true)} />
        <StatTile
          label={t("fillRate")}
          value={posted ? pct(fillRate) : "—"}
          note={t("fillRateNote", { filled: n(filled), posted: n(posted) })}
          delta={posted && postedPrev ? change(fillRate, fillRatePrev, true, "points") : undefined}
        />
        <StatTile
          label={t("timeToFill")}
          value={summary.median_hours_to_fill != null ? hrs(Number(summary.median_hours_to_fill)) : "—"}
          note={t("timeToFillNote")}
        />
        <StatTile label={t("openNow")} value={n(summary.open_shifts_now ?? 0)} note={t("openNowNote")} />
      </div>

      <LineChart title={t("chartActive")} subtitle={t("chartActiveSub")} labels={labels} values={cur.map((r) => r.active_doctors)} format={{ locale }} />
      <ColumnChart
        title={t("chartShifts")}
        subtitle={t("chartShiftsSub")}
        labels={labels}
        series={[
          { name: t("posted"), color: "context", values: cur.map((r) => r.shifts_posted) },
          { name: t("filled"), color: "accent", values: cur.map((r) => r.shifts_filled) },
        ]}
        format={{ locale }}
      />
      <ColumnChart
        title={t("chartSignups")}
        subtitle={t("chartSignupsSub")}
        labels={labels}
        series={[{ name: t("signups"), color: "accent", values: cur.map((r) => r.signups) }]}
        format={{ locale }}
      />
      <LineChart
        title={t("chartTimeToFill")}
        subtitle={t("chartTimeToFillSub")}
        labels={labels}
        values={cur.map((r) => (r.median_hours_to_fill == null ? null : Number(r.median_hours_to_fill)))}
        format={{ locale, template: t("hours", { n: "{n}" }) }}
      />
      <RankedBars
        title={t("chartCities")}
        subtitle={t("chartCitiesSub", { count: weeks, n: n(weeks) })}
        rows={(summary.cities ?? []).map((c) => ({ label: o(`city.${c.city as City}`), value: c.shifts }))}
        format={{ locale }}
        empty={t("noData")}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label={t("hospitalsVerified")} value={n(summary.hospitals_verified ?? 0)} />
        <StatTile label={t("hospitalsUnverified")} value={n(summary.hospitals_unverified ?? 0)} />
        <StatTile label={t("teams")} value={n(summary.teams_active ?? 0)} />
      </div>

      {/* The table view: every number in the charts, without hovering. */}
      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-semibold text-brand-700">{t("table")}</summary>
        <div className="overflow-x-auto pt-3">
          <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="text-xs text-ink-muted">
                {["week", "signups", "active", "posted", "filled", "medianHours", "completed", "cancelled"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1.5 text-start font-semibold">
                    {t(`col.${h}` as "col.week")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...cur].reverse().map((r, i) => (
                <tr key={r.week_start} className="border-t border-line">
                  <td className="whitespace-nowrap px-2 py-1.5">{labels[labels.length - 1 - i]}</td>
                  <td className="px-2 py-1.5">{n(r.signups)}</td>
                  <td className="px-2 py-1.5">{n(r.active_doctors)}</td>
                  <td className="px-2 py-1.5">{n(r.shifts_posted)}</td>
                  <td className="px-2 py-1.5">{n(r.shifts_filled)}</td>
                  <td className="px-2 py-1.5">{r.median_hours_to_fill == null ? "—" : hrs(Number(r.median_hours_to_fill))}</td>
                  <td className="px-2 py-1.5">{n(r.completed)}</td>
                  <td className="px-2 py-1.5">{n(r.cancelled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="text-xs text-ink-muted">{t("footnote")}</p>
    </section>
  );
}
