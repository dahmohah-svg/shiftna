import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime, formatNumber } from "@/lib/time";
import { payPerHour, type ShiftWithHospital } from "@/lib/shifts";
import type { TrustLevel } from "@/lib/hospitals";
import HospitalTrustBadge from "./HospitalTrustBadge";
import ShiftStrip from "./ShiftStrip";
import { SubspecialtyIcon } from "./icons";
import { Badge } from "./ui";

export default async function ShiftCard({
  shift,
  mine = false,
  teamName,
  trust,
}: {
  shift: ShiftWithHospital;
  mine?: boolean;
  /** Set when the shift is only visible to one team. */
  teamName?: string | null;
  /** Hospital credibility level, when the list has looked it up. */
  trust?: TrustLevel;
}) {
  const locale = await getLocale();
  const t = await getTranslations("Shifts");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const when = formatDateTime(shift.start_at, locale);

  return (
    <Link
      href={`/shifts/${shift.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-bold text-ink">{shift.hospital?.name}</span>
          <span className="text-sm text-ink-muted">
            {shift.hospital ? o(`city.${shift.hospital.city as "cairo"}`) : null}
            {shift.hospital?.area ? ` · ${shift.hospital.area}` : null}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-lg font-extrabold text-brand-700">
            {formatNumber(shift.pay_egp, locale)} {c("egp")}
          </span>
          <span className="text-xs text-ink-muted">
            {t("perHour", {
              amount: formatNumber(payPerHour(shift.pay_egp, shift.duration_hours), locale),
            })}
          </span>
        </div>
      </div>

      <div className="text-sm font-semibold text-ink">
        {when} · {c("hours", { count: shift.duration_hours })}
      </div>

      <ShiftStrip startAt={shift.start_at} hours={shift.duration_hours} label={when} />

      <div className="flex flex-wrap gap-1.5">
        {shift.urgent ? <Badge tone="danger">{t("urgent")}</Badge> : null}
        {trust ? <HospitalTrustBadge level={trust} /> : null}
        {teamName ? <Badge tone="brand">{t("teamOnly", { team: teamName })}</Badge> : null}
        {mine ? <Badge tone="brand">{t("yourShift")}</Badge> : null}
        <Badge>{o(`shiftType.${shift.type}`)}</Badge>
        <Badge tone="brand">
          <SubspecialtyIcon value={shift.subspecialty} />
          {o(`subspecialty.${shift.subspecialty}`)}
        </Badge>
        {shift.min_grade !== "resident" ? (
          <Badge tone="warn">
            {t("minGrade", { grade: o(`grade.${shift.min_grade as "resident"}`) })}
          </Badge>
        ) : null}
        {shift.payment === "immediate" ? (
          <Badge tone="success">{o("payment.immediate")}</Badge>
        ) : null}
      </div>
    </Link>
  );
}
