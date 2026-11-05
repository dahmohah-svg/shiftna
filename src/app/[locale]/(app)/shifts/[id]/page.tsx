import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ActionButton from "@/components/ActionButton";
import OfferForm from "@/components/OfferForm";
import ShiftStrip from "@/components/ShiftStrip";
import StatsGrid from "@/components/StatsGrid";
import HospitalTrustBadge from "@/components/HospitalTrustBadge";
import TrustBadge from "@/components/TrustBadge";
import {
  Badge,
  buttonClass,
  Card,
  DetailRow,
  EmptyState,
  Notice,
  SectionTitle,
} from "@/components/ui";
import { acceptOffer, cancelShift, refuseOffer, withdrawOffer } from "@/app/actions/shifts";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import { gradeAllows, payPerHour, SHIFT_WITH_HOSPITAL, type ShiftWithHospital } from "@/lib/shifts";
import { getHospitalTrust } from "@/lib/hospitals";
import { formatDate, formatDateTime, formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

export default async function ShiftPage({ params }: PageProps<"/[locale]/shifts/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const t = await getTranslations("Shift");
  const s = await getTranslations("Shifts");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("shifts")
    .select(`${SHIFT_WITH_HOSPITAL}, team:groups!shifts_group_id_fkey(id, name)`)
    .eq("id", id)
    .maybeSingle();
  const shift = raw as unknown as (ShiftWithHospital & { team: { id: string; name: string } | null }) | null;
  if (!shift) {
    return <EmptyState>{t("notFound")}</EmptyState>;
  }

  const isPoster = shift.poster_id === viewer.userId;
  const [{ data: poster }, { data: hospitalRatings }, { data: booking }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, grade").eq("id", shift.poster_id).maybeSingle(),
    supabase.from("hospital_ratings").select("*").eq("hospital_id", shift.hospital_id).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, doctor_id, poster_id")
      .eq("shift_id", shift.id)
      .is("cancelled_at", null)
      .maybeSingle(),
  ]);

  const when = formatDateTime(shift.start_at, locale);
  const yesNo = (v: boolean) => (v ? c("yes") : c("no"));

  // ---- What the viewer can do ----
  let actionArea: React.ReactNode = null;
  if (booking && (booking.doctor_id === viewer.userId || booking.poster_id === viewer.userId)) {
    actionArea = (
      <Link href={`/bookings/${booking.id}`} className={buttonClass.primary}>
        {t("booking")}
      </Link>
    );
  } else if (isPoster) {
    const { data: offers } = await supabase
      .from("offers")
      .select("id, status, message, created_at, doctor:profiles!offers_doctor_id_fkey(id, full_name, grade)")
      .eq("shift_id", shift.id)
      .order("created_at", { ascending: true });
    const pending = (offers ?? []).filter((x) => x.status === "pending");
    const stats = await Promise.all(
      pending.map(async (x) => {
        const [{ data: st }, { data: tr }] = await Promise.all([
          supabase.rpc("doctor_stats", { p_doctor: x.doctor!.id }),
          supabase.rpc("doctor_trust", { p_doctor: x.doctor!.id }),
        ]);
        return { st: st?.[0] ?? null, tr: tr?.[0] ?? null };
      }),
    );

    actionArea = (
      <Card className="flex flex-col gap-3">
        <SectionTitle>
          {t("offersTitle")} · {s("offersCount", { count: pending.length })}
        </SectionTitle>
        {shift.status === "open" && pending.length > 0 ? (
          <Notice>{t("acceptConfirm")}</Notice>
        ) : null}
        {pending.length === 0 ? <p className="text-sm text-ink-muted">{t("noOffers")}</p> : null}
        {pending.map((x, i) => (
          <div key={x.id} className="flex flex-col gap-3 rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-bold">{x.doctor?.full_name}</span>
                <span className="text-xs text-ink-muted">
                  {x.doctor?.grade ? o(`grade.${x.doctor.grade as "resident"}`) : null}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrustBadge badge={stats[i].tr?.badge} />
                {stats[i].tr?.docs_verified ? <Badge tone="success">✓</Badge> : null}
              </div>
            </div>
            {x.message ? <p className="rounded-lg bg-page p-2 text-sm">{x.message}</p> : null}
            <StatsGrid stats={stats[i].st} />
            <Link href={`/doctors/${x.doctor?.id}`} className="text-sm font-semibold text-brand-700 underline">
              {t("viewProfile")}
            </Link>
            {shift.status === "open" ? (
              <div className="grid grid-cols-2 gap-2">
                <ActionButton action={acceptOffer} fields={{ id: x.id }} confirm={t("acceptConfirm")}>
                  {t("accept")}
                </ActionButton>
                <ActionButton action={refuseOffer} fields={{ id: x.id }} variant="secondary">
                  {t("refuse")}
                </ActionButton>
              </div>
            ) : null}
          </div>
        ))}
        {shift.status === "open" ? (
          <ActionButton
            action={cancelShift}
            fields={{ id: shift.id }}
            variant="danger"
            confirm={t("cancelShiftConfirm")}
          >
            {t("cancelShift")}
          </ActionButton>
        ) : null}
      </Card>
    );
  } else {
    const { data: myOffer } = await supabase
      .from("offers")
      .select("id, status")
      .eq("shift_id", shift.id)
      .eq("doctor_id", viewer.userId)
      .maybeSingle();

    if (myOffer) {
      actionArea = (
        <Card className="flex flex-col gap-3">
          <p className="font-semibold">
            {t("yourOffer", { status: o(`offerStatus.${myOffer.status}`) })}
          </p>
          {myOffer.status === "pending" ? (
            <ActionButton action={withdrawOffer} fields={{ id: myOffer.id }} variant="secondary">
              {t("withdraw")}
            </ActionButton>
          ) : null}
        </Card>
      );
    } else if (shift.status === "open") {
      const myGrade = viewer.profile.grade;
      if (!gradeAllows(myGrade, shift.min_grade)) {
        actionArea = (
          <Card className="flex flex-col gap-3">
            <button type="button" disabled className={buttonClass.primary}>{t("sendOffer")}</button>
            <Notice tone="warn">
              {t("gradeBlocked", {
                grade: o(`grade.${shift.min_grade as "resident"}`),
                mine: myGrade ? o(`grade.${myGrade as "resident"}`) : c("dash"),
              })}
            </Notice>
          </Card>
        );
      } else {
        const [{ data: overlap }, { data: fatigue }] = await Promise.all([
          supabase.rpc("doctor_has_overlap", { p_doctor: viewer.userId, p_shift: shift.id }),
          supabase.rpc("fatigue_check", { p_shift: shift.id }),
        ]);
        actionArea = overlap ? (
          <Card className="flex flex-col gap-3">
            <button type="button" disabled className={buttonClass.primary}>{t("sendOffer")}</button>
            <Notice tone="danger">{t("overlapBlocked")}</Notice>
          </Card>
        ) : (
          <Card>
            <OfferForm shiftId={shift.id} fatigueWarning={Boolean(fatigue?.[0]?.warn)} />
          </Card>
        );
      }
    }
  }

  const hr = hospitalRatings;
  const trust = (await getHospitalTrust(supabase, [shift.hospital_id])).get(shift.hospital_id);
  const ht = await getTranslations("Hospitals");
  const enoughReviews = (hr?.review_count ?? 0) >= 3;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/shifts" className="text-sm font-semibold text-brand-700">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {c("back")}
      </Link>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {shift.urgent ? <Badge tone="danger">{s("urgent")}</Badge> : null}
          {shift.team ? <Badge tone="brand">{s("teamOnly", { team: shift.team.name })}</Badge> : null}
          <Badge>{o(`shiftType.${shift.type}`)}</Badge>
          <Badge>{o(`shiftStatus.${shift.status}`)}</Badge>
          {trust ? <HospitalTrustBadge level={trust.level} /> : null}
        </div>
        <h1 className="text-2xl font-extrabold">{shift.hospital?.name}</h1>
        <p className="text-sm text-ink-muted">
          {shift.hospital ? o(`city.${shift.hospital.city as "cairo"}`) : null}
          {shift.hospital?.area ? ` · ${shift.hospital.area}` : null}
        </p>
        <ShiftStrip startAt={shift.start_at} hours={shift.duration_hours} label={when} />
        <dl>
          <DetailRow label={t("when")}>{when}</DetailRow>
          <DetailRow label={t("duration")}>{c("hours", { count: shift.duration_hours })}</DetailRow>
          <DetailRow label={t("pay")}>
            {formatNumber(shift.pay_egp, locale)} {c("egp")} ·{" "}
            {s("perHour", { amount: formatNumber(payPerHour(shift.pay_egp, shift.duration_hours), locale) })}
          </DetailRow>
          <DetailRow label={t("payment")}>
            {shift.payment === "on_date" && shift.payment_date
              ? t("paymentDate", { date: formatDate(shift.payment_date, locale) })
              : o("payment.immediate")}
          </DetailRow>
          <DetailRow label={t("subspecialty")}>{o(`subspecialty.${shift.subspecialty}`)}</DetailRow>
          <DetailRow label={t("minGrade")}>{o(`grade.${shift.min_grade as "resident"}`)}</DetailRow>
        </dl>
      </Card>

      <Card>
        <SectionTitle>{t("conditions")}</SectionTitle>
        <dl>
          <DetailRow label={t("callRoom")}>{yesNo(shift.has_call_room)}</DetailRow>
          <DetailRow label={t("food")}>{yesNo(shift.food_provided)}</DetailRow>
          <DetailRow label={t("workload")}>{o(`workload.${shift.workload}`)}</DetailRow>
          {shift.support_staff ? <DetailRow label={t("supportStaff")}>{shift.support_staff}</DetailRow> : null}
        </dl>
        {shift.notes ? (
          <div className="pt-3">
            <p className="text-sm text-ink-muted">{t("notes")}</p>
            <p className="whitespace-pre-line text-sm">{shift.notes}</p>
          </div>
        ) : null}
      </Card>

      {trust ? (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle>{ht("credibility")}</SectionTitle>
            <HospitalTrustBadge level={trust.level} />
          </div>
          <p className="text-sm">{ht(`levelHelp.${trust.level}`)}</p>
          <p className="text-xs text-ink-muted">
            {trust.shiftsPosted === 0
              ? ht("noActivity")
              : ht("activity", { shifts: trust.shiftsPosted, posters: trust.posters, completed: formatNumber(trust.completed, locale) })}
          </p>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>{t("hospitalRatings")}</SectionTitle>
        {enoughReviews ? (
          <div className="flex flex-col gap-2">
            {(
              [
                ["payAsAgreed", hr?.pay_as_agreed],
                ["paidOnTime", hr?.paid_on_time],
                ["workloadAsDescribed", hr?.workload_as_described],
              ] as const
            ).map(([key, val]) => (
              <div key={key} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>{t(key)}</span>
                  <span className="font-semibold">{val != null ? formatNumber(Number(val), locale) : c("dash")} / 5</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${(Number(val ?? 0) / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{t("notEnoughReviews")}</p>
        )}
      </Card>

      {poster ? (
        <Card className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-ink-muted">{t("postedBy")}</span>
            <span className="font-bold">{isPoster ? c("you") : poster.full_name}</span>
            {poster.grade ? <span className="text-xs text-ink-muted">{o(`grade.${poster.grade as "resident"}`)}</span> : null}
          </div>
          {!isPoster ? (
            <Link href={`/doctors/${poster.id}`} className={buttonClass.secondary}>
              {t("viewProfile")}
            </Link>
          ) : null}
        </Card>
      ) : null}

      {actionArea}
    </div>
  );
}
