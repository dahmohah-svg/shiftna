import { getLocale, getTranslations } from "next-intl/server";
import { formatNumber } from "@/lib/time";

export type DoctorStats = {
  avg_rating: number | null;
  shifts_done: number | null;
  late_cancels: number | null;
  no_shows: number | null;
  show_up_pct: number | null;
  rank_percentile: number | null;
};

/** Reliability numbers from the doctor_stats database function. */
export default async function StatsGrid({
  stats,
  showRankRow = false,
}: {
  stats: DoctorStats | null;
  showRankRow?: boolean;
}) {
  const t = await getTranslations("Profile");
  const c = await getTranslations("Common");
  const locale = await getLocale();
  const n = (v: number | null | undefined) =>
    v === null || v === undefined ? c("dash") : formatNumber(Number(v), locale);

  const items = [
    { label: t("avgRating"), value: stats?.avg_rating != null ? `${n(stats.avg_rating)} ★` : c("dash") },
    { label: t("shiftsDone"), value: n(stats?.shifts_done) },
    { label: t("showUp"), value: stats?.show_up_pct != null ? `${n(stats.show_up_pct)}%` : c("dash") },
    { label: t("lateCancels"), value: n(stats?.late_cancels) },
    { label: t("noShows"), value: n(stats?.no_shows) },
  ];

  // Rank comes back only for yourself or for Premium members (enforced in the database).
  const rank = stats?.rank_percentile;
  const rankPct = rank != null ? Math.max(1, Math.round(100 - Number(rank)) || 1) : null;

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl bg-page px-3 py-2">
            <dt className="text-xs text-ink-muted">{i.label}</dt>
            <dd className="text-lg font-bold text-ink">{i.value}</dd>
          </div>
        ))}
        {showRankRow || rankPct != null ? (
          <div className="rounded-xl bg-page px-3 py-2">
            <dt className="text-xs text-ink-muted">{t("rank")}</dt>
            <dd className="text-lg font-bold text-ink">
              {rankPct != null ? t("rankValue", { pct: formatNumber(rankPct, locale) }) : c("dash")}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
