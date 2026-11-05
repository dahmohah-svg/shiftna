import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ActionButton from "@/components/ActionButton";
import VerifiedBadge from "@/components/VerifiedBadge";
import { ShieldCheck } from "lucide-react";
import { getVerifiedDoctors } from "@/lib/doctors";
import { getContactPhones } from "@/lib/contacts";
import Chat from "@/components/Chat";
import { CancelBookingForm, RatingForm, ReportForm } from "@/components/BookingForms";
import ShiftStrip from "@/components/ShiftStrip";
import { Badge, buttonClass, Card, DetailRow, EmptyState, Notice, SectionTitle } from "@/components/ui";
import { markCompleted, markNoShow, setPaid } from "@/app/actions/bookings";
import { createClient } from "@/lib/supabase/server";
import { requireApproved } from "@/lib/viewer";
import { formatDate, formatDateTime, formatNumber, nowMs } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

export default async function BookingPage({ params }: PageProps<"/[locale]/bookings/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const t = await getTranslations("Booking");
  const sh = await getTranslations("Shift");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "*, shift:shifts!bookings_shift_id_fkey(*, hospital:hospitals!shifts_hospital_id_fkey(id, name, city, area, address, contact))",
    )
    .eq("id", id)
    .maybeSingle();
  const shift = booking?.shift;
  if (!booking || !shift) return <EmptyState>{t("notFound")}</EmptyState>;

  const isDoctor = booking.doctor_id === viewer.userId;
  const isPoster = booking.poster_id === viewer.userId;
  const otherId = isDoctor ? booking.poster_id : booking.doctor_id;

  const [{ data: other }, { data: messages }, { data: ratings }, verified, phones] = await Promise.all([
    supabase.from("profiles").select("id, full_name, grade").eq("id", otherId).maybeSingle(),
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase.from("ratings").select("*").eq("booking_id", booking.id),
    getVerifiedDoctors(supabase, [otherId]),
    getContactPhones(supabase, [otherId]),
  ]);

  const cancelled = Boolean(booking.cancelled_at);
  const myCompleted = isDoctor ? booking.doctor_completed : booking.poster_completed;
  const bothCompleted = booking.doctor_completed && booking.poster_completed;
  const myRating = ratings?.find((r) => r.from_user === viewer.userId);
  const visibleRatings = (ratings ?? []).filter((r) => r.visible);
  const startMs = new Date(shift.start_at).getTime();
  const late = startMs - nowMs() < 24 * 3600 * 1000;
  const started = nowMs() >= startMs;
  const when = formatDateTime(shift.start_at, locale);
  const hospital = shift.hospital;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/activity" className="text-sm font-semibold text-brand-700">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {c("back")}
      </Link>

      {cancelled ? (
        <Notice tone="danger">
          {t("cancelledBy", { reason: booking.cancel_reason ?? "" })}
          {booking.late_cancel ? <><br />{t("lateCancel")}</> : null}
        </Notice>
      ) : (
        <Notice tone="success">✓ {t("confirmed")}</Notice>
      )}

      <Card className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold">{hospital?.name}</h1>
        <p className="text-sm text-ink-muted">
          {hospital ? o(`city.${hospital.city as "cairo"}`) : null}
          {hospital?.area ? ` · ${hospital.area}` : null}
          {hospital?.address ? ` · ${hospital.address}` : null}
        </p>
        <ShiftStrip startAt={shift.start_at} hours={shift.duration_hours} label={when} />
        <dl>
          <DetailRow label={sh("when")}>{when}</DetailRow>
          <DetailRow label={sh("duration")}>{c("hours", { count: shift.duration_hours, n: formatNumber(shift.duration_hours, locale) })}</DetailRow>
          <DetailRow label={sh("pay")}>{formatNumber(shift.pay_egp, locale)} {c("egp")}</DetailRow>
          <DetailRow label={sh("payment")}>
            {shift.payment === "on_date" && shift.payment_date
              ? sh("paymentDate", { date: formatDate(shift.payment_date, locale) })
              : o("payment.immediate")}
          </DetailRow>
          <DetailRow label={t("payment")}>{o(`payStatus.${booking.payment_status}`)}</DetailRow>
          {hospital?.contact ? (
            <DetailRow label={t("hospitalContact")}>
              <span dir="ltr">{hospital.contact}</span>
            </DetailRow>
          ) : null}
          <DetailRow label={isDoctor ? t("poster") : t("doctor")}>
            <span className="inline-flex items-center gap-1.5">
              <Link href={`/doctors/${other?.id}`} className="text-brand-700 underline">
                {other?.full_name}
              </Link>
              {verified.has(otherId) ? <VerifiedBadge compact /> : null}
            </span>
            {phones.get(otherId) ? (
              <a href={`tel:${phones.get(otherId)}`} className="block text-xs text-ink-muted" dir="ltr">
                {phones.get(otherId)}
              </a>
            ) : (
              <span className="block text-xs text-ink-muted">{t("chatOnly")}</span>
            )}
          </DetailRow>
        </dl>
        {!cancelled ? (
          <a href={`/${locale}/bookings/${booking.id}/calendar`} className={buttonClass.secondary}>
            {t("addToCalendar")}
          </a>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t("chat")}</SectionTitle>
        <p className="-mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
          {t("chatNote")}
        </p>
        <Chat bookingId={booking.id} me={viewer.userId} initial={messages ?? []} disabled={cancelled} />
      </Card>

      {!cancelled ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("completion")}</SectionTitle>
          {bothCompleted ? (
            <Notice tone="success">{t("bothCompleted")}</Notice>
          ) : myCompleted ? (
            <Notice>{t("youCompleted")} {t("waitingOther")}</Notice>
          ) : started ? (
            <ActionButton action={markCompleted} fields={{ id: booking.id }}>
              {t("markCompleted")}
            </ActionButton>
          ) : (
            <p className="text-sm text-ink-muted">{when}</p>
          )}

          {isDoctor && started ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-sm font-semibold">{t("gotPaid")}</p>
              <div className="flex items-center gap-2">
                <Badge tone={booking.payment_status === "paid" ? "success" : "warn"}>
                  {o(`payStatus.${booking.payment_status}`)}
                </Badge>
              </div>
              {booking.payment_status !== "disputed" ? (
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton action={setPaid} fields={{ id: booking.id, paid: "1" }} variant={booking.payment_status === "paid" ? "secondary" : "primary"}>
                    {t("markPaid")}
                  </ActionButton>
                  <ActionButton action={setPaid} fields={{ id: booking.id, paid: "0" }} variant="secondary">
                    {t("markUnpaid")}
                  </ActionButton>
                </div>
              ) : null}
            </div>
          ) : null}

          {isPoster && started && !booking.doctor_completed ? (
            booking.doctor_no_show ? (
              <Notice tone="warn">{t("noShowMarked")}</Notice>
            ) : (
              <ActionButton action={markNoShow} fields={{ id: booking.id }} variant="danger" confirm={t("noShowConfirm")}>
                {t("noShow")}
              </ActionButton>
            )
          ) : null}

          {!started ? (
            <CancelBookingForm bookingId={booking.id} late={late} isDoctor={isDoctor} />
          ) : null}
        </Card>
      ) : null}

      {bothCompleted && !cancelled ? (
        <Card className="flex flex-col gap-3">
          <SectionTitle>{t("rateTitle")}</SectionTitle>
          {myRating ? (
            <Notice tone="success">{t("ratingSubmitted")}</Notice>
          ) : (
            <RatingForm bookingId={booking.id} ratesDoctor={isPoster} />
          )}
          {visibleRatings.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-sm font-semibold">{t("ratingsVisible")}</p>
              {visibleRatings.map((r) => {
                const aboutDoctor = Boolean(r.to_user);
                const labels = aboutDoctor
                  ? [t("skill"), t("reliability"), t("punctuality")]
                  : [t("payAsAgreed"), t("paidOnTime"), t("workloadAsDescribed")];
                return (
                  <div key={r.id} className="rounded-xl bg-page p-3 text-sm">
                    <p className="font-semibold">{aboutDoctor ? t("doctor") : sh("hospital")}</p>
                    <p>
                      {labels[0]}: {r.score_1}★ · {labels[1]}: {r.score_2}★ · {labels[2]}: {r.score_3}★
                    </p>
                    {r.comment ? <p className="pt-1 text-ink-muted">{r.comment}</p> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="flex justify-center">
        <ReportForm bookingId={booking.id} />
      </div>
    </div>
  );
}
