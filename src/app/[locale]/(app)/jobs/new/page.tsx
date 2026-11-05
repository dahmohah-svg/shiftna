import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import JobOfferForm from "@/components/JobOfferForm";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Card, Notice, PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireHr } from "@/lib/viewer";
import { getMyHospital } from "@/lib/jobs";
import { gradeAllows } from "@/lib/shifts";
import { MAX_JOB_OFFERS_PER_DAY, type Specialty } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

/** HR: write a job offer to one doctor. */
export default async function NewJobOfferPage({ params, searchParams }: PageProps<"/[locale]/jobs/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireHr(locale);
  const sp = await searchParams;
  const doctorId = typeof sp.doctor === "string" ? sp.doctor : "";
  if (!/^[0-9a-f-]{36}$/i.test(doctorId)) notFound();

  const t = await getTranslations("Jobs");
  const h = await getTranslations("Hr");
  const o = await getTranslations("Options");
  const c = await getTranslations("Common");
  const supabase = await createClient();

  const [hospital, { data: doctor }, { data: verified }] = await Promise.all([
    getMyHospital(supabase, viewer.userId),
    supabase
      .from("profiles")
      .select("id, full_name, grade, specialty, city, account_type, open_to_offers, offer_note")
      .eq("id", doctorId)
      .maybeSingle(),
    supabase.rpc("doctors_verified", { p_ids: [doctorId] }),
  ]);
  if (!doctor || doctor.account_type !== "doctor") notFound();

  const { data: openShifts } = hospital
    ? await supabase
        .from("shifts")
        .select("id, start_at, duration_hours, min_grade, specialty")
        .eq("hospital_id", hospital.id)
        .eq("poster_id", viewer.userId)
        .eq("status", "open")
        .gte("start_at", new Date().toISOString())
        .order("start_at")
        .limit(30)
    : { data: [] };
  const shifts = (openShifts ?? [])
    .filter((s) => gradeAllows(doctor.grade, s.min_grade))
    .map((s) => ({
      id: s.id,
      label: `${formatDateTime(s.start_at, locale)} · ${c("hours", { count: s.duration_hours, n: formatNumber(s.duration_hours, locale) })} · ${o(`specialty.${s.specialty as Specialty}`)}`,
    }));
  const defaultShift = typeof sp.shift === "string" && shifts.some((s) => s.id === sp.shift) ? sp.shift : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("newTitle")}</PageTitle>
      <Card className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-lg font-bold">
          {doctor.full_name}
          {verified?.[0]?.verified ? <VerifiedBadge compact /> : null}
        </span>
        <span className="text-sm text-ink-muted">
          {o(`specialty.${doctor.specialty as Specialty}`)}
          {doctor.grade ? ` · ${o(`grade.${doctor.grade as "resident"}`)}` : null}
          {doctor.city ? ` · ${o(`city.${doctor.city as "cairo"}`)}` : null}
        </span>
        {doctor.offer_note ? <p className="pt-2 text-sm text-ink">{doctor.offer_note}</p> : null}
      </Card>
      {!hospital ? (
        <Notice tone="warn">{h("noHospital")}</Notice>
      ) : !doctor.open_to_offers ? (
        <Notice tone="warn">{t("notTaking")}</Notice>
      ) : (
        <Card>
          <JobOfferForm doctorId={doctor.id} shifts={shifts} defaultShift={defaultShift} />
          <p className="pt-3 text-xs text-ink-muted">
            {t("limitNote", { n: formatNumber(MAX_JOB_OFFERS_PER_DAY, locale) })}
          </p>
        </Card>
      )}
    </div>
  );
}
