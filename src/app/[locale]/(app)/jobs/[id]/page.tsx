import { getTranslations, setRequestLocale } from "next-intl/server";
import { Building2, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import ActionButton from "@/components/ActionButton";
import Chat from "@/components/Chat";
import { Badge, buttonClass, Card, DetailRow, EmptyState, Notice, SectionTitle } from "@/components/ui";
import { respondJobOffer, withdrawJobOffer } from "@/app/actions/jobs";
import { createClient } from "@/lib/supabase/server";
import { getContactPhones } from "@/lib/contacts";
import { getJobOffer } from "@/lib/jobs";
import { requireApproved } from "@/lib/viewer";
import type { Specialty } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

const STATUS_TONE = { pending: "warn", accepted: "success", declined: "neutral", withdrawn: "neutral" } as const;

export default async function JobOfferPage({ params }: PageProps<"/[locale]/jobs/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireApproved(locale);
  const t = await getTranslations("Jobs");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const supabase = await createClient();

  const job = /^[0-9a-f-]{36}$/i.test(id) ? await getJobOffer(supabase, id) : null;
  if (!job) return <EmptyState>{t("notFound")}</EmptyState>;

  const isHrSide = job.hr_id === viewer.userId;
  const otherId = isHrSide ? job.doctor_id : job.hr_id;
  const [{ data: messages }, phones] = await Promise.all([
    supabase
      .from("job_messages")
      .select("id, sender_id, body, created_at")
      .eq("job_offer_id", job.id)
      .order("created_at", { ascending: true })
      .limit(500),
    getContactPhones(supabase, [otherId]),
  ]);
  const phone = phones.get(otherId);
  const pending = job.status === "pending";
  const chatOpen = pending || job.status === "accepted";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/activity" className="text-sm font-semibold text-brand-700">
        <span aria-hidden className="inline-block rtl:rotate-180">‹</span> {c("back")}
      </Link>

      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Building2 className="h-6 w-6" strokeWidth={2.25} />
            </span>
            <div className="flex min-w-0 flex-col">
              <h1 className="text-xl font-extrabold">{job.title}</h1>
              <span className="text-sm text-ink-muted">{t("from", { hospital: job.hospital?.name ?? "—" })}</span>
            </div>
          </div>
          <Badge tone={STATUS_TONE[job.status]}>{o(`jobStatus.${job.status}`)}</Badge>
        </div>

        <dl>
          <DetailRow label={t("kind")}>{o(`jobKind.${job.kind as "shift"}`)}</DetailRow>
          {job.shift ? (
            <DetailRow label={t("shift")}>
              <Link href={`/shifts/${job.shift.id}`} className="text-brand-700 underline">
                {formatDateTime(job.shift.start_at, locale)} · {c("hours", { count: job.shift.duration_hours, n: formatNumber(job.shift.duration_hours, locale) })}
              </Link>
            </DetailRow>
          ) : null}
          {job.pay_egp ? (
            <DetailRow label={t("payLabel")}>
              {formatNumber(job.pay_egp, locale)} {c("egp")}
              {job.pay_period ? ` ${o(`payPeriod.${job.pay_period as "month"}`)}` : null}
            </DetailRow>
          ) : null}
          {isHrSide ? (
            <DetailRow label={t("doctor")}>
              <Link href={`/doctors/${job.doctor_id}`} className="text-brand-700 underline">{job.doctor?.full_name}</Link>
              {job.doctor ? (
                <span className="block text-xs font-normal text-ink-muted">
                  {o(`specialty.${job.doctor.specialty as Specialty}`)}
                  {job.doctor.grade ? ` · ${o(`grade.${job.doctor.grade as "resident"}`)}` : null}
                </span>
              ) : null}
            </DetailRow>
          ) : (
            <DetailRow label={t("sentBy")}>
              {job.hr?.full_name}
              {job.hr?.job_title ? <span className="block text-xs font-normal text-ink-muted">{job.hr.job_title}</span> : null}
            </DetailRow>
          )}
          <DetailRow label={t("sentAt")}>{formatDateTime(job.created_at, locale)}</DetailRow>
          {phone ? (
            <DetailRow label={t("phone")}>
              <a href={`tel:${phone}`} dir="ltr" className="inline-flex items-center gap-1 text-brand-700 underline">
                <Phone className="h-4 w-4" aria-hidden /> {phone}
              </a>
            </DetailRow>
          ) : null}
        </dl>

        {job.details ? <p className="rounded-xl bg-page p-3 text-sm leading-relaxed whitespace-pre-line text-ink">{job.details}</p> : null}

        {pending && !isHrSide ? (
          <div className="flex flex-col gap-2">
            {job.kind === "shift" ? <Notice tone="brand">{t("acceptShiftNote")}</Notice> : null}
            <div className="grid grid-cols-2 gap-2">
              <ActionButton action={respondJobOffer} fields={{ id: job.id, accept: "1" }}>{t("accept")}</ActionButton>
              <ActionButton action={respondJobOffer} fields={{ id: job.id, accept: "0" }} variant="secondary" confirm={t("declineConfirm")}>
                {t("decline")}
              </ActionButton>
            </div>
          </div>
        ) : null}
        {pending && isHrSide ? (
          <ActionButton action={withdrawJobOffer} fields={{ id: job.id }} variant="secondary" confirm={t("withdrawConfirm")}>
            {t("withdraw")}
          </ActionButton>
        ) : null}
        {job.booking_id ? (
          <Link href={`/bookings/${job.booking_id}`} className={buttonClass.primary}>{t("openBooking")}</Link>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t("chatTitle")}</SectionTitle>
        <p className="text-xs text-ink-muted">{chatOpen ? t("chatNote") : t("chatClosed")}</p>
        <Chat jobOfferId={job.id} me={viewer.userId} initial={messages ?? []} disabled={!chatOpen} />
      </Card>
    </div>
  );
}
