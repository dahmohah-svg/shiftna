import { getTranslations, setRequestLocale } from "next-intl/server";
import Avatar from "@/components/Avatar";
import { Building2, Send, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import VerifiedBadge from "@/components/VerifiedBadge";
import { buttonClass, Card, EmptyState, Notice, PageTitle, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { requireHr } from "@/lib/viewer";
import { getMyHospital } from "@/lib/jobs";
import { CITIES, GRADES, SPECIALTIES, type Specialty } from "@/lib/constants";
import { formatNumber } from "@/lib/time";
import type { Locale } from "@/i18n/routing";

function pick<T extends readonly string[]>(list: T, v: unknown): T[number] | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : null;
}

/** Hospital HR: find doctors who are open to job offers. */
export default async function HrPage({ params, searchParams }: PageProps<"/[locale]/hr">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const viewer = await requireHr(locale);
  const sp = await searchParams;
  const t = await getTranslations("Hr");
  const o = await getTranslations("Options");
  const supabase = await createClient();
  const n = (x: number) => formatNumber(x, locale);

  const hospital = await getMyHospital(supabase, viewer.userId);
  // The hospital's city by default; "all" searches every city.
  const city = sp.city === "all" ? null : (pick(CITIES, sp.city) ?? (hospital?.city as (typeof CITIES)[number] | undefined) ?? null);
  const specialty = pick(SPECIALTIES, sp.spec);
  const minGrade = pick(GRADES, sp.grade);
  // Coming from one of the hospital's shifts: offers default to that shift.
  const shiftId = typeof sp.shift === "string" && /^[0-9a-f-]{36}$/i.test(sp.shift) ? sp.shift : null;

  const { data } = await supabase.rpc("search_doctors", {
    ...(specialty ? { p_specialty: specialty } : {}),
    ...(city ? { p_city: city } : {}),
    ...(minGrade ? { p_min_grade: minGrade } : {}),
    p_limit: 60,
  });
  const doctors = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t("title")}</PageTitle>

      {hospital ? (
        <Card className="flex items-center gap-3">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Building2 className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-ink-muted">{t("recruitFor")}</span>
            <span className="truncate font-bold">{hospital.name}</span>
            <span className="text-xs text-ink-muted">{o(`city.${hospital.city as "cairo"}`)}</span>
          </div>
          <Link href="/post" className={`${buttonClass.secondary} ms-auto min-h-10 shrink-0 px-3 py-1.5 text-sm`}>
            {t("postShift")}
          </Link>
        </Card>
      ) : (
        <Notice tone="warn">{t("noHospital")}</Notice>
      )}

      <form method="get" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        {shiftId ? <input type="hidden" name="shift" value={shiftId} /> : null}
        <p className="text-sm text-ink-muted">{t("intro")}</p>
        <Select name="spec" defaultValue={specialty ?? ""} aria-label={t("specialty")}>
          <option value="">{t("anySpecialty")}</option>
          {SPECIALTIES.map((x) => (
            <option key={x} value={x}>{o(`specialty.${x}`)}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select name="city" defaultValue={city ?? "all"} aria-label={t("city")}>
            <option value="all">{t("anyCity")}</option>
            {CITIES.map((x) => (
              <option key={x} value={x}>{o(`city.${x}`)}</option>
            ))}
          </Select>
          <Select name="grade" defaultValue={minGrade ?? ""} aria-label={t("minGrade")}>
            <option value="">{t("anyGrade")}</option>
            {GRADES.map((x) => (
              <option key={x} value={x}>{t("gradeOrAbove", { grade: o(`grade.${x}`) })}</option>
            ))}
          </Select>
        </div>
        <button type="submit" className={buttonClass.primary}>{t("search")}</button>
      </form>

      <p className="text-sm font-semibold text-ink-muted" aria-live="polite">
        {t("results", { count: doctors.length, n: n(doctors.length) })}
      </p>

      {doctors.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {doctors.map((d) => (
            <li key={d.doctor_id}>
              <Card className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/doctors/${d.doctor_id}`} className="flex min-w-0 items-center gap-3">
                    <Avatar name={d.full_name} url={d.photo_url} size={48} />
                    <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 font-bold text-ink">
                      <span className="truncate">{d.full_name}</span>
                      {d.verified ? <VerifiedBadge compact /> : null}
                    </span>
                    <span className="text-sm text-ink-muted">
                      {o(`specialty.${d.specialty as Specialty}`)}
                      {d.grade ? ` · ${o(`grade.${d.grade as "resident"}`)}` : null}
                      {d.city ? ` · ${o(`city.${d.city as "cairo"}`)}` : null}
                    </span>
                    </span>
                  </Link>
                  {d.avg_rating != null ? (
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-ink">
                      <Star className="h-4 w-4 text-amber-500" aria-hidden fill="currentColor" />
                      {n(Number(d.avg_rating))}
                    </span>
                  ) : null}
                </div>
                {d.offer_note ? <p className="rounded-lg bg-page p-2 text-sm text-ink">{d.offer_note}</p> : null}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-muted">
                    {t("shiftsDone", { n: n(Number(d.shifts_done)) })}
                    {d.show_up_pct != null ? ` · ${t("showUp", { n: n(Number(d.show_up_pct)) })}` : null}
                  </span>
                  {hospital ? (
                    <Link href={`/jobs/new?doctor=${d.doctor_id}${shiftId ? `&shift=${shiftId}` : ""}`} className={`${buttonClass.primary} min-h-10 px-3 py-1.5 text-sm`}>
                      <Send className="h-4 w-4" aria-hidden />
                      {t("sendOffer")}
                    </Link>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
